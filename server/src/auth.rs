use crate::response::ApiResponse;
use crate::state::AppState;
use crate::version;
use axum::extract::FromRequestParts;
use axum::http::header::AUTHORIZATION;
use axum::http::request::Parts;
use axum::http::StatusCode;
use axum::Json;
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::Arc;

#[derive(Clone)]
pub struct AuthConfig {
    pub jwt_secret: String,
    pub access_ttl_secs: u64,
    pub wx_app_id: Option<String>,
    pub wx_secret: Option<String>,
}

impl AuthConfig {
    pub fn from_env() -> Self {
        let jwt_secret = match std::env::var("JWT_SECRET") {
            Ok(s) if !s.trim().is_empty() => s,
            _ => {
                tracing::warn!("JWT_SECRET 未设置，使用仅适合本地的默认值");
                "pet-dev-jwt-secret-change-me".to_string()
            }
        };
        Self {
            jwt_secret,
            access_ttl_secs: version::ACCESS_TOKEN_TTL_SECS,
            wx_app_id: std::env::var("WX_APPID").ok().filter(|s| !s.trim().is_empty()),
            wx_secret: std::env::var("WX_SECRET").ok().filter(|s| !s.trim().is_empty()),
        }
    }

    pub fn wechat_enabled(&self) -> bool {
        self.wx_app_id.is_some() && self.wx_secret.is_some()
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct AccessClaims {
    sub: String,
    exp: i64,
    iat: i64,
    typ: String,
}

#[derive(Clone, Debug)]
pub struct AuthUser {
    pub openid: String,
}

impl FromRequestParts<Arc<AppState>> for AuthUser {
    type Rejection = (StatusCode, Json<ApiResponse<()>>);

    async fn from_request_parts(
        parts: &mut Parts,
        state: &Arc<AppState>,
    ) -> Result<Self, Self::Rejection> {
        let raw = parts
            .headers
            .get(AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .ok_or_else(|| ApiResponse::<()>::fail(1001, "SESSION_INVALID"))?;
        let token = raw
            .strip_prefix("Bearer ")
            .or_else(|| raw.strip_prefix("bearer "))
            .ok_or_else(|| ApiResponse::<()>::fail(1001, "SESSION_INVALID"))?;
        let openid = verify_access_token(&state.auth, token)
            .map_err(|_| ApiResponse::<()>::fail(1001, "SESSION_INVALID"))?;
        Ok(AuthUser { openid })
    }
}

pub fn verify_access_token(auth: &AuthConfig, token: &str) -> Result<String, String> {
    let mut validation = Validation::default();
    validation.validate_exp = true;
    let data = decode::<AccessClaims>(
        token,
        &DecodingKey::from_secret(auth.jwt_secret.as_bytes()),
        &validation,
    )
    .map_err(|_| "token 无效或已过期".to_string())?;
    if data.claims.typ != "access" {
        return Err("token 类型错误".into());
    }
    Ok(data.claims.sub)
}

pub fn issue_access_token(auth: &AuthConfig, openid: &str) -> Result<String, String> {
    let now = Utc::now();
    let exp = now + Duration::seconds(auth.access_ttl_secs as i64);
    let claims = AccessClaims {
        sub: openid.to_string(),
        iat: now.timestamp(),
        exp: exp.timestamp(),
        typ: "access".to_string(),
    };
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(auth.jwt_secret.as_bytes()),
    )
    .map_err(|e| e.to_string())
}

fn hash_code(code: &str) -> String {
    let mut h = Sha256::new();
    h.update(code.as_bytes());
    hex::encode(h.finalize())
}

pub async fn wx_code_to_openid(
    auth: &AuthConfig,
    http: &reqwest::Client,
    code: &str,
) -> Result<String, String> {
    let code = code.trim();
    if code.is_empty() {
        return Err("code 不能为空".into());
    }

    if auth.wechat_enabled() {
        let app_id = auth.wx_app_id.as_ref().unwrap();
        let secret = auth.wx_secret.as_ref().unwrap();
        let url = format!(
            "https://api.weixin.qq.com/sns/jscode2session?appid={}&secret={}&js_code={}&grant_type=authorization_code",
            app_id, secret, code
        );
        let resp = http
            .get(&url)
            .send()
            .await
            .map_err(|_| "微信登录服务不可达".to_string())?
            .json::<serde_json::Value>()
            .await
            .map_err(|_| "微信登录响应异常".to_string())?;
        if let Some(err) = resp.get("errcode").and_then(|v| v.as_i64()) {
            if err != 0 {
                let msg = resp
                    .get("errmsg")
                    .and_then(|v| v.as_str())
                    .unwrap_or("微信登录失败");
                return Err(format!("微信登录失败: {}", msg));
            }
        }
        return resp
            .get("openid")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .ok_or_else(|| "微信未返回 openid".into());
    }

    tracing::warn!("未配置 WX_APPID/WX_SECRET，使用开发 openid（勿用于生产）");
    Ok(format!(
        "dev:{}",
        hash_code(code).chars().take(24).collect::<String>()
    ))
}
