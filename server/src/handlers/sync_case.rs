use super::case_formula::{DiagnosisInput, TreatmentInput};
use super::sync_catalog::{clear_pending, load_case_catalog, mark_pending};
use super::sync_settle::{settle, SettleErr};
use crate::auth::AuthUser;
use crate::response::{now_ms, ApiResponse};
use crate::state::AppState;
use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;
use serde::Deserialize;
use serde_json::Value;
use std::sync::Arc;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncCaseBody {
    pub case_session_id: Option<String>,
    pub case_id: Option<String>,
    pub diagnosis: Option<DiagnosisInput>,
    pub treatment: Option<TreatmentInput>,
    pub duration_ms: Option<i64>,
    /// 追加字段：本局是否领养；旧客户端不传视为 false。
    pub adopted: Option<bool>,
}

pub async fn sync_case_result(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    Json(body): Json<SyncCaseBody>,
) -> (StatusCode, Json<ApiResponse<Value>>) {
    let case_session_id = match body.case_session_id {
        Some(s) if !s.is_empty() && s.len() <= 64 => s,
        _ => return ApiResponse::fail(1002, "INVALID_PARAM"),
    };
    let case_id = match body.case_id {
        Some(s) if !s.is_empty() && s.len() <= 64 => s,
        _ => return ApiResponse::fail(1002, "INVALID_PARAM"),
    };
    let diagnosis = match body.diagnosis {
        Some(d) if matches!(d.dtype.as_str(), "auscultation" | "xray" | "lab") => d,
        _ => return ApiResponse::fail(1002, "INVALID_PARAM"),
    };
    let treatment = match body.treatment {
        Some(t) if matches!(t.result.as_str(), "success" | "partial" | "fail") => t,
        _ => return ApiResponse::fail(1002, "INVALID_PARAM"),
    };
    let duration_ms = match body.duration_ms {
        Some(d) if (0..=24 * 3600 * 1000).contains(&d) => d,
        _ => return ApiResponse::fail(1002, "INVALID_PARAM"),
    };
    let adopted = body.adopted.unwrap_or(false);

    let catalog = match load_case_catalog(&state).await {
        Ok(Some(c)) => c,
        Ok(None) => {
            let _ = mark_pending(&state, &user.openid, &case_session_id, &case_id).await;
            return ApiResponse::fail(2002, "INVALID_STATE");
        }
        Err(_) => return ApiResponse::fail(2002, "INVALID_STATE"),
    };
    let item = match catalog.into_iter().find(|c| c.case_id == case_id) {
        Some(i) => i,
        None => {
            let _ = mark_pending(&state, &user.openid, &case_session_id, &case_id).await;
            return ApiResponse::fail(2002, "INVALID_STATE");
        }
    };

    match settle(
        &state,
        &user.openid,
        &case_session_id,
        &case_id,
        &diagnosis,
        &treatment,
        duration_ms,
        &item,
        adopted,
        now_ms(),
    )
    .await
    {
        Ok(data) => {
            let _ = clear_pending(&state, &user.openid, &case_session_id).await;
            ApiResponse::ok(data)
        }
        Err(SettleErr::NoUser) => ApiResponse::fail(1001, "SESSION_INVALID"),
        Err(SettleErr::Conflict) => ApiResponse::fail(1006, "TRANSACTION_RETRY_EXHAUSTED"),
    }
}
