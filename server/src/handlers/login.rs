use crate::auth::{issue_access_token, wx_code_to_openid};
use crate::response::{now_ms, ApiResponse};
use crate::state::AppState;
use crate::version::MIN_CLIENT_VERSION;
use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginBody {
    /// 微信 wx.login code；开发模式可用任意非空串。
    pub code: Option<String>,
    pub scene: Option<String>,
    pub version: Option<String>,
    pub channel: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginData {
    pub token: String,
    pub is_new_user: bool,
    pub server_time: i64,
    pub min_version: String,
}

pub async fn login(
    State(state): State<Arc<AppState>>,
    Json(body): Json<LoginBody>,
) -> (StatusCode, Json<ApiResponse<LoginData>>) {
    if let Some(channel) = &body.channel {
        if channel != "android" && channel != "ios" && channel != "dev" {
            return ApiResponse::fail(1002, "INVALID_PARAM");
        }
    }
    if let Some(version) = &body.version {
        if version.is_empty() {
            return ApiResponse::fail(1002, "INVALID_PARAM");
        }
    }

    let code = body.code.unwrap_or_default();
    if code.trim().is_empty() {
        return ApiResponse::fail(1002, "INVALID_PARAM");
    }

    let openid = match wx_code_to_openid(&state.auth, &state.http, &code).await {
        Ok(v) => v,
        Err(_) => return ApiResponse::fail(1002, "INVALID_PARAM"),
    };

    let now = now_ms();
    let scene = body.scene.unwrap_or_default();
    let is_new = match ensure_user(&state, &openid, &scene, now).await {
        Ok(v) => v,
        Err(e) => {
            tracing::error!(?e, "login ensure_user failed");
            return ApiResponse::fail(1002, "INVALID_PARAM");
        }
    };

    let token = match issue_access_token(&state.auth, &openid) {
        Ok(t) => t,
        Err(_) => return ApiResponse::fail(1002, "INVALID_PARAM"),
    };

    ApiResponse::ok(LoginData {
        token,
        is_new_user: is_new,
        server_time: now,
        min_version: MIN_CLIENT_VERSION.into(),
    })
}

async fn ensure_user(
    state: &AppState,
    openid: &str,
    scene: &str,
    now: i64,
) -> Result<bool, sqlx::Error> {
    let existing: Option<(String,)> =
        sqlx::query_as("SELECT openid FROM users WHERE openid = $1")
            .bind(openid)
            .fetch_optional(&state.db)
            .await?;

    if existing.is_some() {
        sqlx::query("UPDATE users SET last_login_at = $2, last_scene = $3 WHERE openid = $1")
            .bind(openid)
            .bind(now)
            .bind(scene)
            .execute(&state.db)
            .await?;
        return Ok(false);
    }

    let resources = json!({
        "coins": 500,
        "hearts": 20,
        "beds": 0,
        "medicine": {},
        "trainingPoints": 0,
        "fragments": 0,
        "updatedAt": now
    });

    let mut tx = state.db.begin().await?;
    sqlx::query(
        r#"
        INSERT INTO users (
            openid, created_at, last_login_at, last_scene, status,
            revision, resources, reputation, flags
        ) VALUES ($1,$2,$2,$3,'active',0,$4,0,'{}'::jsonb)
        ON CONFLICT (openid) DO NOTHING
        "#,
    )
    .bind(openid)
    .bind(now)
    .bind(scene)
    .bind(resources)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO hospital_state (
            openid, level, beds, rooms, doctors, decorations,
            adoption_slots, reputation, season_state, revision, updated_at
        ) VALUES ($1,1,0,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,0,0,'{}'::jsonb,0,$2)
        ON CONFLICT (openid) DO NOTHING
        "#,
    )
    .bind(openid)
    .bind(now)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(true)
}
