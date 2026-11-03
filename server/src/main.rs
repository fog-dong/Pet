mod auth;
mod handlers;
mod pending_monitor;
mod response;
mod seed;
mod state;
mod version;

use axum::{extract::State, http::StatusCode, response::IntoResponse, routing::get, Json, Router};
use serde::Serialize;
use state::AppState;
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber::EnvFilter;

#[derive(Serialize)]
struct HealthBody {
    status: &'static str,
    api_version: &'static str,
    min_client_version: &'static str,
}

async fn health(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    if sqlx::query("SELECT 1").execute(&state.db).await.is_err() {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(HealthBody {
                status: "db_unavailable",
                api_version: version::API_VERSION,
                min_client_version: version::MIN_CLIENT_VERSION,
            }),
        )
            .into_response();
    }
    (
        StatusCode::OK,
        Json(HealthBody {
            status: "ok",
            api_version: version::API_VERSION,
            min_client_version: version::MIN_CLIENT_VERSION,
        }),
    )
        .into_response()
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive("info".parse().unwrap()))
        .init();

    let database_url = std::env::var("DATABASE_URL").unwrap_or_else(|_| {
        "postgres://pet:pet@127.0.0.1:5432/pet".to_string()
    });

    let db = sqlx::postgres::PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await
        .expect("连接 PostgreSQL 失败");

    sqlx::migrate!("./migrations")
        .run(&db)
        .await
        .expect("数据库迁移失败");

    seed::ensure_default_config(&db)
        .await
        .expect("写入配置种子失败");

    pending_monitor::spawn(db.clone());

    let state = Arc::new(AppState {
        db,
        auth: auth::AuthConfig::from_env(),
        http: reqwest::Client::new(),
    });

    let app = Router::new()
        .route("/health", get(health))
        .merge(handlers::routes())
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .with_state(state);

    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(3000);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("pet-server listening on {addr}");
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("bind 失败");
    axum::serve(listener, app).await.expect("serve 失败");
}
