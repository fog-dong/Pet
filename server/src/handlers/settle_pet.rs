use super::case_formula::CaseConfigItem;
use sqlx::Postgres;
use sqlx::Transaction;

pub async fn upsert_pet(
    tx: &mut Transaction<'_, Postgres>,
    openid: &str,
    case_session_id: &str,
    item: &CaseConfigItem,
    affection: i32,
    adopted: bool,
    now: i64,
) -> Result<(), sqlx::Error> {
    if item.pet_id.is_empty() {
        return Ok(());
    }
    let row_id = format!("{openid}:{}", item.pet_id);
    let status = if adopted { "adopted" } else { "in_hospital" };
    let adopted_by: Option<&str> = if adopted { Some(openid) } else { None };
    let breed = if item.breed.is_empty() {
        item.pet_species.as_str()
    } else {
        item.breed.as_str()
    };
    sqlx::query(
        r#"
        INSERT INTO pets (
            id, pet_id, openid, breed, name, rarity, story_id, affection,
            status, adopted_by, case_session_id, care_score, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,'',$7,$8,$9,$10,$7,$11,$11)
        ON CONFLICT (id) DO UPDATE SET
            openid = EXCLUDED.openid,
            affection = GREATEST(pets.affection, EXCLUDED.affection),
            status = CASE WHEN pets.status = 'adopted' THEN 'adopted' ELSE EXCLUDED.status END,
            adopted_by = CASE WHEN pets.status = 'adopted' THEN pets.adopted_by ELSE EXCLUDED.adopted_by END,
            case_session_id = COALESCE(pets.case_session_id, EXCLUDED.case_session_id),
            care_score = GREATEST(pets.care_score, EXCLUDED.care_score),
            updated_at = EXCLUDED.updated_at
        "#,
    )
    .bind(&row_id)
    .bind(&item.pet_id)
    .bind(openid)
    .bind(breed)
    .bind(&item.pet_name)
    .bind(&item.rarity)
    .bind(affection)
    .bind(status)
    .bind(adopted_by)
    .bind(case_session_id)
    .bind(now)
    .execute(&mut **tx)
    .await?;

    if adopted {
        write_adoption(tx, openid, &item.pet_id, now).await?;
    }
    Ok(())
}

async fn write_adoption(
    tx: &mut Transaction<'_, Postgres>,
    openid: &str,
    pet_id: &str,
    now: i64,
) -> Result<(), sqlx::Error> {
    let adoption_id = format!("adp_{openid}_{pet_id}");
    let card_id = format!("card_{openid}_{pet_id}");
    let existing: i32 = sqlx::query_as::<_, (i32,)>(
        "SELECT COUNT(*)::int FROM adoptions WHERE openid = $1 AND pet_id = $2",
    )
    .bind(openid)
    .bind(pet_id)
    .fetch_one(&mut **tx)
    .await?
    .0;
    sqlx::query(
        r#"
        INSERT INTO adoptions (
            id, adoption_id, card_id, openid, pet_id, adopted_at,
            is_first_adoption, shared_count, status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,0,'active')
        ON CONFLICT (id) DO UPDATE SET status = 'active'
        "#,
    )
    .bind(&adoption_id)
    .bind(&adoption_id)
    .bind(&card_id)
    .bind(openid)
    .bind(pet_id)
    .bind(now)
    .bind(existing == 0)
    .execute(&mut **tx)
    .await?;
    Ok(())
}
