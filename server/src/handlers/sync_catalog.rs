use super::case_formula::{parse_case_item, CaseConfigItem};
use crate::response::now_ms;
use crate::state::AppState;
use serde_json::Value;

pub async fn load_case_catalog(
    state: &AppState,
) -> Result<Option<Vec<CaseConfigItem>>, sqlx::Error> {
    let rows: Vec<(Value,)> = sqlx::query_as(
        r#"
        SELECT payload FROM config
        WHERE status = 'active' AND config_key = 'cases'
        ORDER BY version DESC
        LIMIT 1
        "#,
    )
    .fetch_all(&state.db)
    .await?;
    let Some((payload,)) = rows.into_iter().next() else {
        return Ok(None);
    };
    let mut items = Vec::new();
    let entries = match payload {
        Value::Array(arr) => arr,
        Value::Object(map) => map
            .get("cases")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default(),
        _ => return Ok(None),
    };
    for entry in entries {
        let id = entry
            .get("caseId")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        if let Some(item) = parse_case_item(&id, &entry) {
            items.push(item);
        }
    }
    if items.is_empty() {
        Ok(None)
    } else {
        Ok(Some(items))
    }
}

pub async fn mark_pending(
    state: &AppState,
    openid: &str,
    case_session_id: &str,
    case_id: &str,
) -> Result<(), sqlx::Error> {
    let id = format!("{openid}:{case_session_id}");
    let now = now_ms();
    sqlx::query(
        r#"
        INSERT INTO sync_pending (
            id, openid, case_session_id, case_id, reason,
            created_at, updated_at, first_seen_at, last_seen_at, last_code
        ) VALUES ($1,$2,$3,$4,'INVALID_STATE',$5,$5,$5,$5,2002)
        ON CONFLICT (id) DO UPDATE SET
            last_seen_at = EXCLUDED.last_seen_at,
            updated_at = EXCLUDED.updated_at,
            last_code = 2002
        "#,
    )
    .bind(id)
    .bind(openid)
    .bind(case_session_id)
    .bind(case_id)
    .bind(now)
    .execute(&state.db)
    .await?;
    Ok(())
}

pub async fn clear_pending(
    state: &AppState,
    openid: &str,
    case_session_id: &str,
) -> Result<(), sqlx::Error> {
    let id = format!("{openid}:{case_session_id}");
    sqlx::query("DELETE FROM sync_pending WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;
    Ok(())
}
