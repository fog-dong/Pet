use crate::response::now_ms;
use sqlx::PgPool;
use std::time::Duration;

const PENDING_TTL_MS: i64 = 7 * 24 * 3600 * 1000;
const NEAR_EXPIRY_MS: i64 = 2 * 24 * 3600 * 1000;
/// 默认每小时扫一次；可用 PENDING_MONITOR_SECS 覆盖（本地联调用更短间隔）。
const DEFAULT_INTERVAL_SECS: u64 = 3600;

pub fn spawn(db: PgPool) {
    let secs = std::env::var("PENDING_MONITOR_SECS")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(DEFAULT_INTERVAL_SECS)
        .max(30);
    tokio::spawn(async move {
        let mut ticker = tokio::time::interval(Duration::from_secs(secs));
        loop {
            ticker.tick().await;
            if let Err(e) = scan_once(&db).await {
                tracing::warn!(?e, "pendingMonitor 扫描失败");
            }
        }
    });
}

async fn scan_once(db: &PgPool) -> Result<(), sqlx::Error> {
    let now = now_ms();
    let expired_before = now - PENDING_TTL_MS;
    let near_before = now - (PENDING_TTL_MS - NEAR_EXPIRY_MS);

    let total: i64 = sqlx::query_as::<_, (i64,)>("SELECT COUNT(*) FROM sync_pending")
        .fetch_one(db)
        .await?
        .0;
    let expired: i64 = sqlx::query_as::<_, (i64,)>(
        "SELECT COUNT(*) FROM sync_pending WHERE COALESCE(first_seen_at, created_at) <= $1",
    )
    .bind(expired_before)
    .fetch_one(db)
    .await?
    .0;
    let near_or_expired: i64 = sqlx::query_as::<_, (i64,)>(
        "SELECT COUNT(*) FROM sync_pending WHERE COALESCE(first_seen_at, created_at) <= $1",
    )
    .bind(near_before)
    .fetch_one(db)
    .await?
    .0;
    let near_expiry = near_or_expired - expired;

    if near_expiry > 0 || expired > 0 {
        tracing::warn!(
            event = "pending_aging",
            total,
            near_expiry,
            expired,
            "sync_pending 积压老化"
        );
    } else {
        tracing::debug!(total, "pendingMonitor ok");
    }
    Ok(())
}
