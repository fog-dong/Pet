use crate::auth::AuthUser;
use crate::response::ApiResponse;
use crate::state::AppState;
use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;
use serde::Deserialize;
use serde_json::Value;
use std::sync::Arc;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateOrderBody {
    pub sku_id: Option<String>,
    pub client_order_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PayCallbackBody {
    pub platform_payload: Option<Value>,
}

/// W1–W4：固定返回 PAY_UNAVAILABLE，不创建真实订单。
pub async fn create_order(
    State(_state): State<Arc<AppState>>,
    _user: AuthUser,
    Json(body): Json<CreateOrderBody>,
) -> (StatusCode, Json<ApiResponse<Value>>) {
    match body.sku_id {
        Some(s) if !s.is_empty() => {}
        _ => return ApiResponse::fail(1002, "INVALID_PARAM"),
    }
    match body.client_order_id {
        Some(s) if !s.is_empty() => {}
        _ => return ApiResponse::fail(1002, "INVALID_PARAM"),
    }
    ApiResponse::fail(3002, "PAY_UNAVAILABLE")
}

/// W1–W4：固定返回 PAY_UNAVAILABLE，不验签、不发货。
pub async fn pay_callback(
    State(_state): State<Arc<AppState>>,
    _user: AuthUser,
    Json(body): Json<PayCallbackBody>,
) -> (StatusCode, Json<ApiResponse<Value>>) {
    match body.platform_payload {
        Some(Value::Object(_)) => {}
        _ => return ApiResponse::fail(1002, "INVALID_PARAM"),
    }
    ApiResponse::fail(3002, "PAY_UNAVAILABLE")
}
