use axum::http::StatusCode;
use axum::Json;
use serde::Serialize;

/// 冻结返回包：业务码走 body.code，HTTP 恒为 200（健康检查除外）。
#[derive(Debug, Serialize)]
pub struct ApiResponse<T: Serialize> {
    pub code: i32,
    pub msg: String,
    pub data: Option<T>,
    #[serde(rename = "serverTime", skip_serializing_if = "Option::is_none")]
    pub server_time: Option<i64>,
}

impl<T: Serialize> ApiResponse<T> {
    pub fn ok(data: T) -> (StatusCode, Json<ApiResponse<T>>) {
        (
            StatusCode::OK,
            Json(ApiResponse {
                code: 0,
                msg: "ok".into(),
                data: Some(data),
                server_time: Some(now_ms()),
            }),
        )
    }

    pub fn fail(code: i32, msg: &str) -> (StatusCode, Json<ApiResponse<T>>) {
        (
            StatusCode::OK,
            Json(ApiResponse {
                code,
                msg: msg.into(),
                data: None,
                server_time: Some(now_ms()),
            }),
        )
    }

    pub fn fail_with(code: i32, msg: &str, data: T) -> (StatusCode, Json<ApiResponse<T>>) {
        (
            StatusCode::OK,
            Json(ApiResponse {
                code,
                msg: msg.into(),
                data: Some(data),
                server_time: Some(now_ms()),
            }),
        )
    }
}

pub fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

/// 北京时间日期 yyyy-MM-dd（与云函数 shanghaiDate 一致）。
pub fn shanghai_date(now_ms: i64) -> String {
    let shifted = now_ms + 8 * 3600 * 1000;
    chrono::DateTime::from_timestamp_millis(shifted)
        .map(|dt| dt.format("%Y-%m-%d").to_string())
        .unwrap_or_else(|| "1970-01-01".into())
}
