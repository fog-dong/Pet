use crate::auth::AuthUser;
use crate::response::{now_ms, shanghai_date, ApiResponse};
use crate::state::AppState;
use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;

const RESOURCE_TYPES: &[&str] = &["medicine", "bed", "heart"];
const TARGET_DAILY_LIMIT: i32 = 5;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssistBody {
    pub friend_openid: Option<String>,
    pub resource_type: Option<String>,
    pub nonce: Option<String>,
}

pub async fn assist(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    Json(body): Json<AssistBody>,
) -> (StatusCode, Json<ApiResponse<Value>>) {
    let helper_id = match body.friend_openid {
        Some(s) if !s.is_empty() && s != user.openid => s,
        _ => return ApiResponse::fail(1002, "INVALID_PARAM"),
    };
    let resource_type = body.resource_type.unwrap_or_else(|| "heart".into());
    if !RESOURCE_TYPES.contains(&resource_type.as_str()) {
        return ApiResponse::fail(1002, "INVALID_PARAM");
    }
    let nonce = match body.nonce {
        Some(s) if !s.is_empty() => s,
        _ => return ApiResponse::fail(1002, "INVALID_PARAM"),
    };

    let now = now_ms();
    let date = shanghai_date(now);
    let target_id = user.openid;
    let pair_id = format!("{target_id}_{helper_id}_{date}");
    let daily_id = format!("{target_id}_{date}");

    let mut tx = match state.db.begin().await {
        Ok(t) => t,
        Err(_) => return ApiResponse::fail(1006, "TRANSACTION_RETRY_EXHAUSTED"),
    };

    let existing: Option<(String,)> =
        match sqlx::query_as("SELECT id FROM assist_pairs WHERE id = $1")
            .bind(&pair_id)
            .fetch_optional(&mut *tx)
            .await
        {
            Ok(v) => v,
            Err(_) => return ApiResponse::fail(1006, "TRANSACTION_RETRY_EXHAUSTED"),
        };
    if existing.is_some() {
        let count: i32 = sqlx::query_as::<_, (i32,)>("SELECT count FROM assist_daily WHERE id = $1")
            .bind(&daily_id)
            .fetch_optional(&mut *tx)
            .await
            .ok()
            .flatten()
            .map(|r| r.0)
            .unwrap_or(0);
        let _ = tx.commit().await;
        return ApiResponse::ok(json!({
            "granted": false,
            "assisted": false,
            "reason": "ALREADY_ASSISTED",
            "dailyCount": count,
            "resources": null
        }));
    }

    let count: i32 = sqlx::query_as::<_, (i32,)>("SELECT count FROM assist_daily WHERE id = $1")
        .bind(&daily_id)
        .fetch_optional(&mut *tx)
        .await
        .ok()
        .flatten()
        .map(|r| r.0)
        .unwrap_or(0);

    if count >= TARGET_DAILY_LIMIT {
        let _ = tx.rollback().await;
        return ApiResponse::fail(1005, "TODAY_ASSIST_LIMIT");
    }

    let next = count + 1;
    if sqlx::query(
        r#"
        INSERT INTO assist_daily (id, target_id, date, count, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$5)
        ON CONFLICT (id) DO UPDATE SET count = EXCLUDED.count, updated_at = EXCLUDED.updated_at
        "#,
    )
    .bind(&daily_id)
    .bind(&target_id)
    .bind(&date)
    .bind(next)
    .bind(now)
    .execute(&mut *tx)
    .await
    .is_err()
    {
        return ApiResponse::fail(1006, "TRANSACTION_RETRY_EXHAUSTED");
    }

    if sqlx::query(
        r#"
        INSERT INTO assist_pairs (id, target_id, helper_id, date, resource_type, nonce, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        "#,
    )
    .bind(&pair_id)
    .bind(&target_id)
    .bind(&helper_id)
    .bind(&date)
    .bind(&resource_type)
    .bind(&nonce)
    .bind(now)
    .execute(&mut *tx)
    .await
    .is_err()
    {
        return ApiResponse::fail(1006, "TRANSACTION_RETRY_EXHAUSTED");
    }

    if tx.commit().await.is_err() {
        return ApiResponse::fail(1006, "TRANSACTION_RETRY_EXHAUSTED");
    }

    ApiResponse::ok(json!({
        "granted": true,
        "assisted": true,
        "reason": null,
        "dailyCount": next,
        "resources": null
    }))
}
