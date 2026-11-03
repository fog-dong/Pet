use chrono::{Datelike, Utc};
use sqlx::Postgres;
use sqlx::Transaction;

pub async fn upsert_leaderboards(
    tx: &mut Transaction<'_, Postgres>,
    openid: &str,
    stars: i32,
    now: i64,
) -> Result<(), sqlx::Error> {
    let rep_delta = stars.max(0);
    sqlx::query("UPDATE users SET reputation = reputation + $2 WHERE openid = $1")
        .bind(openid)
        .bind(rep_delta)
        .execute(&mut **tx)
        .await?;

    let reputation: i32 =
        sqlx::query_as::<_, (i32,)>("SELECT reputation FROM users WHERE openid = $1")
            .bind(openid)
            .fetch_one(&mut **tx)
            .await?
            .0;

    let adopted: i32 = sqlx::query_as::<_, (i32,)>(
        "SELECT COUNT(*)::int FROM pets WHERE adopted_by = $1 AND status = 'adopted'",
    )
    .bind(openid)
    .fetch_one(&mut **tx)
    .await?
    .0;

    upsert_board(tx, "reputation", "all", openid, reputation, now).await?;
    upsert_board(tx, "collection", "all", openid, adopted, now).await?;
    upsert_board(tx, "weekly", &iso_week_key(), openid, reputation, now).await?;
    Ok(())
}

async fn upsert_board(
    tx: &mut Transaction<'_, Postgres>,
    board_type: &str,
    period: &str,
    openid: &str,
    score: i32,
    now: i64,
) -> Result<(), sqlx::Error> {
    let id = format!("{board_type}:{period}:{openid}");
    sqlx::query(
        r#"
        INSERT INTO leaderboard (id, type, period, openid, score, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (type, period, openid) DO UPDATE SET
            score = EXCLUDED.score,
            updated_at = EXCLUDED.updated_at
        "#,
    )
    .bind(id)
    .bind(board_type)
    .bind(period)
    .bind(openid)
    .bind(score)
    .bind(now)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

fn iso_week_key() -> String {
    let now = Utc::now();
    format!("{:04}-W{:02}", now.iso_week().year(), now.iso_week().week())
}
