use serde_json::{json, Value};
use sqlx::PgPool;
use std::path::Path;

/// 启动时若无 active 配置，则从 seed/ 灌入 cases / quality。
pub async fn ensure_default_config(db: &PgPool) -> Result<(), sqlx::Error> {
    seed_if_missing(db, "cases", load_cases_payload()).await?;
    seed_if_missing(db, "quality", Ok(Value::String("high".into()))).await?;
    Ok(())
}

async fn seed_if_missing(
    db: &PgPool,
    key: &str,
    payload: Result<Value, String>,
) -> Result<(), sqlx::Error> {
    let exists: Option<(i32,)> = sqlx::query_as(
        "SELECT version FROM config WHERE config_key = $1 AND status = 'active' LIMIT 1",
    )
    .bind(key)
    .fetch_optional(db)
    .await?;
    if exists.is_some() {
        return Ok(());
    }
    let payload = match payload {
        Ok(v) => v,
        Err(e) => {
            tracing::warn!(key, error = %e, "跳过配置种子");
            return Ok(());
        }
    };
    let id = format!("{key}:v1");
    sqlx::query(
        r#"
        INSERT INTO config (id, config_key, version, payload, status, gray_tags, gray_percent)
        VALUES ($1, $2, 1, $3, 'active', '[]'::jsonb, 100)
        ON CONFLICT (config_key, version) DO UPDATE
          SET payload = EXCLUDED.payload, status = 'active'
        "#,
    )
    .bind(&id)
    .bind(key)
    .bind(payload)
    .execute(db)
    .await?;
    tracing::info!(key, "已写入默认 active 配置种子");
    Ok(())
}

fn load_cases_payload() -> Result<Value, String> {
    let candidates = [
        Path::new("seed/cases.json"),
        Path::new("./server/seed/cases.json"),
        Path::new("/app/seed/cases.json"),
    ];
    for path in candidates {
        if path.exists() {
            let raw = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
            let value: Value = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
            if value.get("cases").and_then(|v| v.as_array()).is_some() {
                return Ok(value);
            }
            return Err("cases.json 缺少 cases 数组".into());
        }
    }
    // 最小兜底：保证结算链路可测。
    Ok(json!({
        "version": 1,
        "cases": [{
            "caseId": "case_cat_001",
            "petId": "pet_orange_cat",
            "petName": "橘子",
            "petSpecies": "cat",
            "breed": "橘猫",
            "severity": "normal",
            "treatment": { "correct": { "medicine": "健胃药", "bed": "门诊", "time": "正常" } },
            "baseRewards": { "coins": 200, "hearts": 1, "affection": 1 }
        }]
    }))
}
