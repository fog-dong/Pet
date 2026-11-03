use crate::auth::AuthUser;
use crate::response::{now_ms, shanghai_date, ApiResponse};
use crate::state::AppState;
use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;

const MAX_PET_COUNT: i64 = 20;
const CLOCK_SLACK_MS: i64 = 5 * 60 * 1000;
const COINS_PER_PET_HOUR: i64 = 4;
const MAX_HOURS_PER_CLAIM: i64 = 6;
const MAX_DAILY_CLAIMS: i32 = 2;
const HOUR_MS: i64 = 3600 * 1000;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaimBody {
    pub last_claim_time: Option<i64>,
}

pub async fn claim_habitat(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    Json(body): Json<ClaimBody>,
) -> (StatusCode, Json<ApiResponse<Value>>) {
    let now = now_ms();
    let last_claim_time = match body.last_claim_time {
        Some(t) if t >= 0 => t,
        _ => return ApiResponse::fail(1002, "INVALID_PARAM"),
    };
    if last_claim_time > now + CLOCK_SLACK_MS {
        return ApiResponse::fail(1002, "INVALID_PARAM");
    }

    let adopted: i64 = sqlx::query_as::<_, (i64,)>(
        r#"
        SELECT COUNT(*) FROM pets
        WHERE status = 'adopted' AND adopted_by = $1
        "#,
    )
    .bind(&user.openid)
    .fetch_one(&state.db)
    .await
    .map(|r| r.0.min(MAX_PET_COUNT))
    .unwrap_or(0);

    let platform_date = shanghai_date(now);
    match settle(
        &state,
        &user.openid,
        last_claim_time,
        adopted,
        now,
        &platform_date,
    )
    .await
    {
        Ok((hours, coins)) => ApiResponse::ok(json!({ "hours": hours, "coins": coins })),
        Err(ClaimErr::NoUser) => ApiResponse::fail(1001, "SESSION_INVALID"),
        Err(ClaimErr::Limited) => ApiResponse::fail(1003, "RATE_LIMITED"),
        Err(ClaimErr::Conflict) => ApiResponse::fail(1006, "TRANSACTION_RETRY_EXHAUSTED"),
    }
}

enum ClaimErr {
    NoUser,
    Limited,
    Conflict,
}

async fn settle(
    state: &AppState,
    openid: &str,
    client_last: i64,
    adopted_count: i64,
    now: i64,
    platform_date: &str,
) -> Result<(i64, i64), ClaimErr> {
    let mut tx = state.db.begin().await.map_err(|_| ClaimErr::Conflict)?;

    let user_row: Option<(Value,)> =
        sqlx::query_as("SELECT resources FROM users WHERE openid = $1")
            .bind(openid)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|_| ClaimErr::Conflict)?;
    let mut resources = user_row.ok_or(ClaimErr::NoUser)?.0;

    let recorded: i64 =
        sqlx::query_as::<_, (i64,)>("SELECT last_claim_at FROM habitat_state WHERE openid = $1")
            .bind(openid)
            .fetch_optional(&mut *tx)
            .await
            .ok()
            .flatten()
            .map(|r| r.0)
            .unwrap_or(0);

    let earliest = now - MAX_HOURS_PER_CLAIM * HOUR_MS;
    let start = if recorded > 0 {
        recorded
    } else {
        client_last.max(earliest).min(now)
    };
    let hours = ((now - start) / HOUR_MS).clamp(0, MAX_HOURS_PER_CLAIM);
    if hours == 0 {
        let _ = tx.commit().await;
        return Ok((0, 0));
    }

    let day_id = format!("{openid}_{platform_date}");
    let today_count: i32 =
        sqlx::query_as::<_, (i32,)>("SELECT count FROM habitat_claims WHERE id = $1")
            .bind(&day_id)
            .fetch_optional(&mut *tx)
            .await
            .ok()
            .flatten()
            .map(|r| r.0)
            .unwrap_or(0);
    if today_count >= MAX_DAILY_CLAIMS {
        let _ = tx.rollback().await;
        return Err(ClaimErr::Limited);
    }

    let coins = hours * COINS_PER_PET_HOUR * adopted_count;
    let res = resources.as_object_mut().ok_or(ClaimErr::Conflict)?;
    let cur = res.get("coins").and_then(|v| v.as_i64()).unwrap_or(0);
    res.insert("coins".into(), json!(cur + coins));
    res.insert("updatedAt".into(), json!(now));

    sqlx::query("UPDATE users SET resources = $2 WHERE openid = $1")
        .bind(openid)
        .bind(&resources)
        .execute(&mut *tx)
        .await
        .map_err(|_| ClaimErr::Conflict)?;

    sqlx::query(
        r#"
        INSERT INTO habitat_state (openid, last_claim_at, updated_at)
        VALUES ($1,$2,$2)
        ON CONFLICT (openid) DO UPDATE SET last_claim_at = EXCLUDED.last_claim_at, updated_at = EXCLUDED.updated_at
        "#,
    )
    .bind(openid)
    .bind(now)
    .execute(&mut *tx)
    .await
    .map_err(|_| ClaimErr::Conflict)?;

    let prev_hours: i32 =
        sqlx::query_as::<_, (i32,)>("SELECT hours FROM habitat_claims WHERE id = $1")
            .bind(&day_id)
            .fetch_optional(&mut *tx)
            .await
            .ok()
            .flatten()
            .map(|r| r.0)
            .unwrap_or(0);
    let prev_coins: i32 =
        sqlx::query_as::<_, (i32,)>("SELECT coins FROM habitat_claims WHERE id = $1")
            .bind(&day_id)
            .fetch_optional(&mut *tx)
            .await
            .ok()
            .flatten()
            .map(|r| r.0)
            .unwrap_or(0);

    sqlx::query(
        r#"
        INSERT INTO habitat_claims (id, openid, date, count, hours, coins, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (id) DO UPDATE SET
            count = EXCLUDED.count,
            hours = EXCLUDED.hours,
            coins = EXCLUDED.coins,
            updated_at = EXCLUDED.updated_at
        "#,
    )
    .bind(&day_id)
    .bind(openid)
    .bind(platform_date)
    .bind(today_count + 1)
    .bind(prev_hours + hours as i32)
    .bind(prev_coins + coins as i32)
    .bind(now)
    .execute(&mut *tx)
    .await
    .map_err(|_| ClaimErr::Conflict)?;

    tx.commit().await.map_err(|_| ClaimErr::Conflict)?;
    Ok((hours, coins))
}
