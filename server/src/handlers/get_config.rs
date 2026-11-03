use crate::auth::AuthUser;
use crate::response::ApiResponse;
use crate::state::AppState;
use crate::version::MIN_CLIENT_VERSION;
use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;

const CONFIG_KEYS: &[&str] = &[
    "cases",
    "skus",
    "ad_slots",
    "activities",
    "affection",
    "collection",
    "quality",
    "resource_manifest",
];

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetConfigBody {
    pub version: Option<i32>,
    pub gray_tags: Option<Vec<String>>,
}

pub async fn get_config(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    Json(body): Json<GetConfigBody>,
) -> (StatusCode, Json<ApiResponse<Value>>) {
    if let Some(v) = body.version {
        if v < 0 {
            return ApiResponse::fail(1002, "INVALID_PARAM");
        }
    }
    let tags = body.gray_tags.unwrap_or_default();

    let rows: Vec<(String, i32, Option<Value>, Value, i32)> = match sqlx::query_as(
        r#"
        SELECT config_key, version, payload, gray_tags, gray_percent
        FROM config WHERE status = 'active'
        LIMIT 100
        "#,
    )
    .fetch_all(&state.db)
    .await
    {
        Ok(v) => v,
        Err(e) => {
            tracing::error!(?e, "getConfig query");
            return ApiResponse::fail(1002, "INVALID_PARAM");
        }
    };

    let mut latest: HashMap<String, (i32, Option<Value>, Value, i32)> = HashMap::new();
    for (key, version, payload, gray_tags, gray_percent) in rows {
        if !CONFIG_KEYS.contains(&key.as_str()) {
            continue;
        }
        let replace = latest
            .get(&key)
            .map(|(v, _, _, _)| version > *v)
            .unwrap_or(true);
        if replace {
            latest.insert(key, (version, payload, gray_tags, gray_percent));
        }
    }

    let mut version = 0;
    for (v, _, _, _) in latest.values() {
        version = version.max(*v);
    }

    if body.version == Some(version) {
        return ApiResponse::ok(json!({
            "version": version,
            "configs": {},
            "forceUpdate": false,
            "minVersion": MIN_CLIENT_VERSION
        }));
    }

    let tag_set: HashSet<&str> = tags.iter().map(|s| s.as_str()).collect();
    let mut configs = serde_json::Map::new();
    for (key, (ver, payload, gray_tags, gray_percent)) in latest {
        let _ = ver;
        if is_eligible(&gray_tags, gray_percent, &tag_set, &user.openid) {
            configs.insert(key, payload.unwrap_or(Value::Null));
        }
    }

    ApiResponse::ok(json!({
        "version": version,
        "configs": configs,
        "forceUpdate": false,
        "minVersion": MIN_CLIENT_VERSION
    }))
}

fn bucket_of(openid: &str) -> i32 {
    let mut hash: i32 = 0;
    for b in openid.bytes() {
        hash = (hash.wrapping_mul(31).wrapping_add(b as i32)).rem_euclid(100);
    }
    hash
}

fn is_eligible(gray_tags: &Value, percent: i32, tags: &HashSet<&str>, openid: &str) -> bool {
    let list: Vec<&str> = gray_tags
        .as_array()
        .map(|arr| arr.iter().filter_map(|v| v.as_str()).collect())
        .unwrap_or_default();
    if list.is_empty() {
        return percent >= 100;
    }
    if list.iter().any(|t| tags.contains(t)) {
        return true;
    }
    bucket_of(openid) < percent
}
