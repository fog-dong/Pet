use crate::auth::AuthUser;
use crate::response::{now_ms, ApiResponse};
use crate::state::AppState;
use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveGameBody {
    pub revision: Option<i64>,
    pub snapshot: Option<Value>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveGameData {
    pub revision: i64,
    pub server_time: i64,
}

pub async fn save_game(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    Json(body): Json<SaveGameBody>,
) -> (StatusCode, Json<ApiResponse<SaveGameData>>) {
    let revision = match body.revision {
        Some(r) if r >= 1 => r,
        _ => return ApiResponse::fail(1002, "INVALID_PARAM"),
    };
    let snapshot = match body.snapshot {
        Some(Value::Object(map)) => map,
        _ => return ApiResponse::fail(1002, "INVALID_PARAM"),
    };

    let now = now_ms();
    let openid = user.openid;

    let mut tx = match state.db.begin().await {
        Ok(t) => t,
        Err(_) => return ApiResponse::fail(1006, "TRANSACTION_RETRY_EXHAUSTED"),
    };

    let user_exists: Option<(i64,)> =
        match sqlx::query_as("SELECT revision FROM users WHERE openid = $1")
            .bind(&openid)
            .fetch_optional(&mut *tx)
            .await
        {
            Ok(v) => v,
            Err(_) => return ApiResponse::fail(1001, "SESSION_INVALID"),
        };
    if user_exists.is_none() {
        return ApiResponse::fail(1001, "SESSION_INVALID");
    }

    let current: i64 = sqlx::query_as::<_, (i64,)>(
        "SELECT COALESCE(revision, 0) FROM hospital_state WHERE openid = $1",
    )
    .bind(&openid)
    .fetch_optional(&mut *tx)
    .await
    .ok()
    .flatten()
    .map(|r| r.0)
    .unwrap_or(0);

    if revision <= current {
        let _ = tx.rollback().await;
        return ApiResponse::fail_with(
            1004,
            "DUPLICATE",
            SaveGameData {
                revision: current,
                server_time: now,
            },
        );
    }

    // W15-1：忽略 snapshot.resources；只同步医院状态字段。
    let level = snapshot
        .get("level")
        .and_then(|v| v.as_i64())
        .unwrap_or(1) as i32;
    let beds = snapshot
        .get("beds")
        .and_then(|v| v.as_i64())
        .unwrap_or(0) as i32;
    let rooms = snapshot.get("rooms").cloned().unwrap_or(Value::Array(vec![]));
    let doctors = snapshot
        .get("doctors")
        .cloned()
        .unwrap_or(Value::Array(vec![]));
    let decorations = snapshot
        .get("decorations")
        .cloned()
        .unwrap_or(Value::Array(vec![]));
    let adoption_slots = snapshot
        .get("adoptionSlots")
        .and_then(|v| v.as_i64())
        .unwrap_or(0) as i32;
    let reputation = snapshot
        .get("reputation")
        .and_then(|v| v.as_i64())
        .unwrap_or(0) as i32;
    let season_state = snapshot
        .get("seasonState")
        .cloned()
        .unwrap_or(Value::Object(Default::default()));

    if let Err(e) = sqlx::query(
        r#"
        INSERT INTO hospital_state (
            openid, level, beds, rooms, doctors, decorations,
            adoption_slots, reputation, season_state, revision, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (openid) DO UPDATE SET
            level = EXCLUDED.level,
            beds = EXCLUDED.beds,
            rooms = EXCLUDED.rooms,
            doctors = EXCLUDED.doctors,
            decorations = EXCLUDED.decorations,
            adoption_slots = EXCLUDED.adoption_slots,
            reputation = EXCLUDED.reputation,
            season_state = EXCLUDED.season_state,
            revision = EXCLUDED.revision,
            updated_at = EXCLUDED.updated_at
        "#,
    )
    .bind(&openid)
    .bind(level)
    .bind(beds)
    .bind(rooms)
    .bind(doctors)
    .bind(decorations)
    .bind(adoption_slots)
    .bind(reputation)
    .bind(season_state)
    .bind(revision)
    .bind(now)
    .execute(&mut *tx)
    .await
    {
        tracing::error!(?e, "saveGame hospital upsert");
        return ApiResponse::fail(1006, "TRANSACTION_RETRY_EXHAUSTED");
    }

    if let Err(_) = sqlx::query("UPDATE users SET revision = $2 WHERE openid = $1")
        .bind(&openid)
        .bind(revision)
        .execute(&mut *tx)
        .await
    {
        return ApiResponse::fail(1006, "TRANSACTION_RETRY_EXHAUSTED");
    }

    if tx.commit().await.is_err() {
        return ApiResponse::fail(1006, "TRANSACTION_RETRY_EXHAUSTED");
    }

    ApiResponse::ok(SaveGameData {
        revision,
        server_time: now,
    })
}
