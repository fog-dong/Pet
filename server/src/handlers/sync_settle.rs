use super::case_formula::{
    compute_case, reward_amounts, CaseConfigItem, DiagnosisInput, TreatmentInput,
};
use super::settle_side::{upsert_leaderboards, upsert_pet};
use crate::state::AppState;
use serde_json::{json, Value};

pub enum SettleErr {
    NoUser,
    Conflict,
}

pub async fn settle(
    state: &AppState,
    openid: &str,
    case_session_id: &str,
    case_id: &str,
    diagnosis: &DiagnosisInput,
    treatment: &TreatmentInput,
    duration_ms: i64,
    item: &CaseConfigItem,
    adopted: bool,
    now: i64,
) -> Result<Value, SettleErr> {
    let case_pk = format!("{openid}:{case_session_id}");
    let mut tx = state.db.begin().await.map_err(|_| SettleErr::Conflict)?;

    let user_row: Option<(Value, Value)> =
        sqlx::query_as("SELECT resources, flags FROM users WHERE openid = $1")
            .bind(openid)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|_| SettleErr::Conflict)?;
    let (mut resources, mut flags) = user_row.ok_or(SettleErr::NoUser)?;

    if let Ok(Some((result, rewards))) = sqlx::query_as::<_, (Value, Value)>(
        "SELECT result, rewards FROM pets_cases WHERE id = $1",
    )
    .bind(&case_pk)
    .fetch_optional(&mut *tx)
    .await
    {
        return Ok(json!({ "result": result, "rewards": rewards, "resources": resources }));
    }

    let computed = compute_case(item, diagnosis, treatment);
    let mut flags_obj = flags.as_object().cloned().unwrap_or_default();
    let mut case_stars = flags_obj
        .get("caseStars")
        .and_then(|v| v.as_object())
        .cloned()
        .unwrap_or_default();
    let previous = case_stars
        .get(case_id)
        .and_then(|v| v.as_i64())
        .unwrap_or(0) as i32;
    let first_clear = previous == 0 && computed.stars > 0;
    let (coins, hearts) = reward_amounts(&item.base_rewards, computed.stars, first_clear);

    let mut res_obj = resources.as_object().cloned().unwrap_or_default();
    let cur_coins = res_obj.get("coins").and_then(|v| v.as_i64()).unwrap_or(0);
    let cur_hearts = res_obj.get("hearts").and_then(|v| v.as_i64()).unwrap_or(0);
    res_obj.insert("coins".into(), json!(cur_coins + i64::from(coins)));
    res_obj.insert("hearts".into(), json!(cur_hearts + i64::from(hearts)));
    res_obj.insert("updatedAt".into(), json!(now));
    resources = Value::Object(res_obj);

    case_stars.insert(case_id.into(), json!(previous.max(computed.stars)));
    flags_obj.insert("caseStars".into(), Value::Object(case_stars));
    flags = Value::Object(flags_obj);

    let result = json!({
        "caseId": case_id,
        "status": computed.status,
        "stars": computed.stars,
        "diagnosisStars": computed.diagnosis_stars,
        "treatmentStars": computed.treatment_stars,
        "recoveryStars": computed.recovery_stars,
        "firstClear": first_clear,
        "durationMs": duration_ms,
        "finishedAt": now
    });
    let rewards = json!({
        "coins": coins,
        "hearts": hearts,
        "reputation": computed.stars.max(0),
        "affection": computed.affection
    });

    sqlx::query(
        r#"
        INSERT INTO pets_cases (
            id, case_session_id, openid, case_id, pet_species, pet_name, severity,
            diagnosis, treatment, affection, status, result, rewards, created_at, finished_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14)
        "#,
    )
    .bind(&case_pk)
    .bind(case_session_id)
    .bind(openid)
    .bind(case_id)
    .bind(&item.pet_species)
    .bind(&item.pet_name)
    .bind(&item.severity)
    .bind(json!(diagnosis))
    .bind(json!(treatment))
    .bind(computed.affection)
    .bind(computed.status)
    .bind(&result)
    .bind(&rewards)
    .bind(now)
    .execute(&mut *tx)
    .await
    .map_err(|_| SettleErr::Conflict)?;

    sqlx::query("UPDATE users SET resources = $2, flags = $3 WHERE openid = $1")
        .bind(openid)
        .bind(&resources)
        .bind(&flags)
        .execute(&mut *tx)
        .await
        .map_err(|_| SettleErr::Conflict)?;

    upsert_pet(
        &mut tx,
        openid,
        case_session_id,
        item,
        computed.affection,
        adopted,
        now,
    )
    .await
    .map_err(|_| SettleErr::Conflict)?;

    upsert_leaderboards(&mut tx, openid, computed.stars, now)
        .await
        .map_err(|_| SettleErr::Conflict)?;

    tx.commit().await.map_err(|_| SettleErr::Conflict)?;
    Ok(json!({ "result": result, "rewards": rewards, "resources": resources }))
}
