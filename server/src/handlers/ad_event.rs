use crate::auth::AuthUser;
use crate::response::{now_ms, shanghai_date, ApiResponse};
use crate::state::AppState;
use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;

const SCENES: &[&str] = &[
    "extra_check",
    "extra_inspection",
    "accelerate",
    "double_reward",
    "free_slot",
    "extra_medicine",
    "extra_bed",
];
const GLOBAL_DAILY_LIMIT: i32 = 10;
const NEW_USER_DAILY_LIMIT: i32 = 5;
const NEW_USER_WINDOW_MS: i64 = 24 * 60 * 60 * 1000;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdEventBody {
    pub ad_session_id: Option<String>,
    pub ad_unit_id: Option<String>,
    pub scene: Option<String>,
    pub is_ended: Option<bool>,
}

pub async fn ad_event(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    Json(body): Json<AdEventBody>,
) -> (StatusCode, Json<ApiResponse<Value>>) {
    let ad_session_id = match body.ad_session_id {
        Some(s) if !s.is_empty() && s.len() <= 64 => s,
        _ => return ApiResponse::fail(1002, "INVALID_PARAM"),
    };
    let ad_unit_id = match body.ad_unit_id {
        Some(s) if !s.is_empty() => s,
        _ => return ApiResponse::fail(1002, "INVALID_PARAM"),
    };
    let scene = match body.scene {
        Some(s) if SCENES.contains(&s.as_str()) => s,
        _ => return ApiResponse::fail(1002, "INVALID_PARAM"),
    };
    let is_ended = match body.is_ended {
        Some(v) => v,
        None => return ApiResponse::fail(1002, "INVALID_PARAM"),
    };

    let now = now_ms();
    let platform_date = shanghai_date(now);
    let openid = user.openid;
    let idem = format!("{openid}:{ad_session_id}");
    let daily_id = format!("{openid}_{platform_date}");

    let limit = if is_ended {
        daily_limit(&state, &openid, now).await
    } else {
        0
    };

    let mut tx = match state.db.begin().await {
        Ok(t) => t,
        Err(_) => return ApiResponse::fail(1006, "TRANSACTION_RETRY_EXHAUSTED"),
    };

    if let Ok(Some((granted, daily_count))) =
        sqlx::query_as::<_, (bool, i32)>("SELECT granted, daily_count FROM ad_events WHERE id = $1")
            .bind(&idem)
            .fetch_optional(&mut *tx)
            .await
    {
        let _ = tx.commit().await;
        return ApiResponse::ok(json!({
            "granted": granted,
            "reward": null,
            "todayCount": daily_count
        }));
    }

    let count: i32 = if is_ended {
        sqlx::query_as::<_, (i32,)>("SELECT count FROM ad_daily WHERE id = $1")
            .bind(&daily_id)
            .fetch_optional(&mut *tx)
            .await
            .ok()
            .flatten()
            .map(|r| r.0)
            .unwrap_or(0)
    } else {
        0
    };

    let granted = is_ended && count < limit;
    let daily_count = if granted { count + 1 } else { count };

    if granted {
        if sqlx::query(
            r#"
            INSERT INTO ad_daily (id, openid, date, count, created_at, updated_at)
            VALUES ($1,$2,$3,$4,$5,$5)
            ON CONFLICT (id) DO UPDATE SET count = EXCLUDED.count, updated_at = EXCLUDED.updated_at
            "#,
        )
        .bind(&daily_id)
        .bind(&openid)
        .bind(&platform_date)
        .bind(daily_count)
        .bind(now)
        .execute(&mut *tx)
        .await
        .is_err()
        {
            return ApiResponse::fail(1006, "TRANSACTION_RETRY_EXHAUSTED");
        }
    }

    if sqlx::query(
        r#"
        INSERT INTO ad_events (
            id, idempotency_key, ad_session_id, openid, ad_unit_id, scene,
            is_ended, reward, granted, daily_count, platform_date, created_at, reconciled
        ) VALUES ($1,$1,$2,$3,$4,$5,$6,NULL,$7,$8,$9,$10,FALSE)
        "#,
    )
    .bind(&idem)
    .bind(&ad_session_id)
    .bind(&openid)
    .bind(&ad_unit_id)
    .bind(&scene)
    .bind(is_ended)
    .bind(granted)
    .bind(daily_count)
    .bind(&platform_date)
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
        "granted": granted,
        "reward": null,
        "todayCount": daily_count
    }))
}

async fn daily_limit(state: &AppState, openid: &str, now: i64) -> i32 {
    let created: i64 = sqlx::query_as::<_, (i64,)>("SELECT created_at FROM users WHERE openid = $1")
        .bind(openid)
        .fetch_optional(&state.db)
        .await
        .ok()
        .flatten()
        .map(|r| r.0)
        .unwrap_or(0);
    if created > 0 && now - created < NEW_USER_WINDOW_MS {
        NEW_USER_DAILY_LIMIT
    } else {
        GLOBAL_DAILY_LIMIT
    }
}
