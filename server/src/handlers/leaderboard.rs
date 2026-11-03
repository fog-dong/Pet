use crate::auth::AuthUser;
use crate::response::ApiResponse;
use crate::state::AppState;
use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;
use chrono::{Datelike, Utc};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;

const TYPES: &[&str] = &["reputation", "collection", "weekly", "friends"];
const DEFAULT_PAGE_SIZE: i64 = 20;
const MAX_PAGE_SIZE: i64 = 100;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LeaderboardBody {
    #[serde(rename = "type")]
    pub board_type: Option<String>,
    pub period: Option<String>,
    pub limit: Option<i64>,
    pub page: Option<i64>,
    pub page_size: Option<i64>,
}

pub async fn leaderboard(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    Json(body): Json<LeaderboardBody>,
) -> (StatusCode, Json<ApiResponse<Value>>) {
    let board_type = match body.board_type {
        Some(t) if TYPES.contains(&t.as_str()) => t,
        _ => return ApiResponse::fail(1002, "INVALID_PARAM"),
    };
    let page = body.page.unwrap_or(1);
    if page < 1 {
        return ApiResponse::fail(1002, "INVALID_PARAM");
    }
    let size = body.limit.or(body.page_size).unwrap_or(DEFAULT_PAGE_SIZE);
    if size < 1 || size > MAX_PAGE_SIZE {
        return ApiResponse::fail(1002, "INVALID_PARAM");
    }

    if board_type == "friends" {
        return ApiResponse::ok(json!({
            "entries": [],
            "self": null,
            "total": 0,
            "page": 1,
            "pageSize": size
        }));
    }

    let period = body.period.unwrap_or_else(|| {
        if board_type == "weekly" {
            iso_week_key()
        } else {
            "all".into()
        }
    });

    let total: i64 = sqlx::query_as::<_, (i64,)>(
        "SELECT COUNT(*) FROM leaderboard WHERE type = $1 AND period = $2",
    )
    .bind(&board_type)
    .bind(&period)
    .fetch_one(&state.db)
    .await
    .map(|r| r.0)
    .unwrap_or(0);

    let offset = (page - 1) * size;
    let rows: Vec<(String, i32, Option<String>)> = sqlx::query_as(
        r#"
        SELECT openid, score, nickname FROM leaderboard
        WHERE type = $1 AND period = $2
        ORDER BY score DESC, updated_at ASC
        OFFSET $3 LIMIT $4
        "#,
    )
    .bind(&board_type)
    .bind(&period)
    .bind(offset)
    .bind(size)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let entries: Vec<Value> = rows
        .into_iter()
        .enumerate()
        .map(|(i, (openid, score, nickname))| {
            let mut entry = json!({
                "rank": offset + i as i64 + 1,
                "displayId": mask_id(&openid),
                "score": score
            });
            if let Some(n) = nickname {
                entry
                    .as_object_mut()
                    .unwrap()
                    .insert("nickname".into(), json!(n));
            }
            entry
        })
        .collect();

    let self_entry = if let Ok(Some((score,))) = sqlx::query_as::<_, (i32,)>(
        "SELECT score FROM leaderboard WHERE type = $1 AND period = $2 AND openid = $3",
    )
    .bind(&board_type)
    .bind(&period)
    .bind(&user.openid)
    .fetch_optional(&state.db)
    .await
    {
        let ahead: i64 = sqlx::query_as::<_, (i64,)>(
            "SELECT COUNT(*) FROM leaderboard WHERE type = $1 AND period = $2 AND score > $3",
        )
        .bind(&board_type)
        .bind(&period)
        .bind(score)
        .fetch_one(&state.db)
        .await
        .map(|r| r.0)
        .unwrap_or(0);
        Some(json!({
            "rank": ahead + 1,
            "displayId": mask_id(&user.openid),
            "score": score
        }))
    } else {
        None
    };

    ApiResponse::ok(json!({
        "entries": entries,
        "self": self_entry,
        "total": total,
        "page": page,
        "pageSize": size
    }))
}

fn mask_id(openid: &str) -> String {
    if openid.len() <= 6 {
        "wx_***".into()
    } else {
        format!(
            "{}***{}",
            &openid[..3],
            &openid[openid.len().saturating_sub(3)..]
        )
    }
}

fn iso_week_key() -> String {
    let now = Utc::now();
    format!("{:04}-W{:02}", now.iso_week().year(), now.iso_week().week())
}
