use crate::auth::AuthUser;
use crate::response::{now_ms, shanghai_date, ApiResponse};
use crate::state::AppState;
use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;
use serde::Deserialize;
use serde_json::{json, Map, Value};
use std::sync::Arc;

const MAX_EVENTS: usize = 60;
const MAX_PROPS: usize = 8;
const MAX_VALUE_LENGTH: usize = 64;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackBody {
    pub batch_id: Option<String>,
    pub events: Option<Vec<Value>>,
}

pub async fn track_event(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    Json(body): Json<TrackBody>,
) -> (StatusCode, Json<ApiResponse<Value>>) {
    let batch_id = match body.batch_id {
        Some(s) if !s.is_empty() && s.len() <= 64 => s,
        _ => return ApiResponse::fail(1002, "INVALID_PARAM"),
    };
    let raw_events = match body.events {
        Some(e) if !e.is_empty() && e.len() <= MAX_EVENTS => e,
        _ => return ApiResponse::fail(1002, "INVALID_PARAM"),
    };

    let events: Vec<Value> = raw_events.into_iter().filter_map(clean_event).collect();
    if events.is_empty() {
        return ApiResponse::fail(1002, "INVALID_PARAM");
    }

    let now = now_ms();
    let doc_id = format!("{}:{}", user.openid, batch_id);

    if let Ok(Some((count,))) =
        sqlx::query_as::<_, (i32,)>("SELECT count FROM track_events WHERE id = $1")
            .bind(&doc_id)
            .fetch_optional(&state.db)
            .await
    {
        return ApiResponse::ok(json!({ "accepted": count }));
    }

    let count = events.len() as i32;
    let result = sqlx::query(
        r#"
        INSERT INTO track_events (id, openid, batch_id, events, count, platform_date, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (id) DO NOTHING
        "#,
    )
    .bind(&doc_id)
    .bind(&user.openid)
    .bind(&batch_id)
    .bind(Value::Array(events))
    .bind(count)
    .bind(shanghai_date(now))
    .bind(now)
    .execute(&state.db)
    .await;

    match result {
        Ok(r) if r.rows_affected() == 0 => {
            let accepted =
                sqlx::query_as::<_, (i32,)>("SELECT count FROM track_events WHERE id = $1")
                    .bind(&doc_id)
                    .fetch_one(&state.db)
                    .await
                    .map(|r| r.0)
                    .unwrap_or(count);
            ApiResponse::ok(json!({ "accepted": accepted }))
        }
        Ok(_) => ApiResponse::ok(json!({ "accepted": count })),
        Err(e) => {
            tracing::error!(?e, "trackEvent insert");
            ApiResponse::fail(1002, "INVALID_PARAM")
        }
    }
}

fn is_ident(s: &str, max: usize) -> bool {
    if s.is_empty() || s.len() > max {
        return false;
    }
    s.chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '_')
}

fn clean_event(raw: Value) -> Option<Value> {
    let obj = raw.as_object()?;
    let event = obj.get("event")?.as_str()?;
    if !is_ident(event, 40) {
        return None;
    }
    let at = obj.get("at").and_then(|v| v.as_i64()).unwrap_or(0);
    let props = clean_props(obj.get("props"));
    Some(json!({ "event": event, "props": props, "at": at }))
}

fn clean_props(raw: Option<&Value>) -> Map<String, Value> {
    let mut out = Map::new();
    let Some(Value::Object(map)) = raw else {
        return out;
    };
    for (key, value) in map.iter().take(MAX_PROPS) {
        if !is_ident(key, 24) {
            continue;
        }
        if let Some(cleaned) = clean_value(value) {
            out.insert(key.clone(), cleaned);
        }
    }
    out
}

fn clean_value(value: &Value) -> Option<Value> {
    match value {
        Value::Bool(b) => Some(Value::Bool(*b)),
        Value::Number(n) if n.as_f64().is_some_and(|f| f.is_finite()) => {
            Some(Value::Number(n.clone()))
        }
        Value::String(s) => {
            let trimmed = if s.len() > MAX_VALUE_LENGTH {
                s.chars().take(MAX_VALUE_LENGTH).collect()
            } else {
                s.clone()
            };
            Some(Value::String(trimmed))
        }
        _ => None,
    }
}
