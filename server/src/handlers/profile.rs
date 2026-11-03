use crate::auth::AuthUser;
use crate::response::ApiResponse;
use crate::state::AppState;
use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;
use serde::Serialize;
use serde_json::{json, Value};
use std::sync::Arc;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileData {
    pub user: Option<UserSummary>,
    pub hospital: Option<HospitalSummary>,
    pub resources: Option<Value>,
    pub collection: CollectionSummary,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserSummary {
    pub nickname: String,
    pub avatar_url: String,
    pub reputation: i32,
    pub revision: i64,
    pub created_at: i64,
    pub last_login_at: i64,
    pub status: String,
    pub flags: Value,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HospitalSummary {
    pub level: i32,
    pub beds: i32,
    pub rooms: Value,
    pub doctors: Value,
    pub decorations: Value,
    pub adoption_slots: i32,
    pub reputation: i32,
    pub season_state: Value,
    pub revision: i64,
    pub updated_at: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PetSummary {
    pub pet_id: String,
    pub breed: String,
    pub name: String,
    pub rarity: String,
    pub affection: i32,
    pub care_score: i32,
    pub updated_at: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionSummary {
    pub adopted_count: usize,
    pub pets: Vec<PetSummary>,
}

pub async fn get_profile(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
) -> (StatusCode, Json<ApiResponse<ProfileData>>) {
    let openid = user.openid;

    let row = sqlx::query_as::<_, (String, String, i32, i64, i64, i64, String, Value, Value)>(
        r#"
        SELECT nickname, avatar_url, reputation, revision, created_at, last_login_at, status, flags, resources
        FROM users WHERE openid = $1
        "#,
    )
    .bind(&openid)
    .fetch_optional(&state.db)
    .await;

    let user_row = match row {
        Ok(v) => v,
        Err(e) => {
            tracing::error!(?e, "getProfile users");
            return ApiResponse::fail(1001, "SESSION_INVALID");
        }
    };

    let hospital = sqlx::query_as::<_, (i32, i32, Value, Value, Value, i32, i32, Value, i64, i64)>(
        r#"
        SELECT level, beds, rooms, doctors, decorations, adoption_slots, reputation,
               season_state, revision, updated_at
        FROM hospital_state WHERE openid = $1
        "#,
    )
    .bind(&openid)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten();

    let pets = sqlx::query_as::<_, (String, String, String, String, i32, i32, i64)>(
        r#"
        SELECT pet_id, breed, name, rarity, affection, care_score, updated_at
        FROM pets
        WHERE openid = $1 AND status = 'adopted'
        ORDER BY updated_at DESC
        LIMIT 50
        "#,
    )
    .bind(&openid)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let pet_list: Vec<PetSummary> = pets
        .into_iter()
        .map(|(pet_id, breed, name, rarity, affection, care_score, updated_at)| PetSummary {
            pet_id,
            breed,
            name,
            rarity,
            affection,
            care_score,
            updated_at,
        })
        .collect();

    let user_summary = user_row.map(
        |(nickname, avatar_url, reputation, revision, created_at, last_login_at, status, flags, _)| {
            UserSummary {
                nickname,
                avatar_url,
                reputation,
                revision,
                created_at,
                last_login_at,
                status,
                flags,
            }
        },
    );

    let resources = match sqlx::query_as::<_, (Value,)>("SELECT resources FROM users WHERE openid = $1")
        .bind(&openid)
        .fetch_optional(&state.db)
        .await
    {
        Ok(Some((r,))) => Some(r),
        _ => None,
    };

    let hospital_summary = hospital.map(
        |(
            level,
            beds,
            rooms,
            doctors,
            decorations,
            adoption_slots,
            reputation,
            season_state,
            revision,
            updated_at,
        )| HospitalSummary {
            level,
            beds,
            rooms,
            doctors,
            decorations,
            adoption_slots,
            reputation,
            season_state,
            revision,
            updated_at,
        },
    );

    ApiResponse::ok(ProfileData {
        user: user_summary,
        hospital: hospital_summary,
        resources: resources.or(Some(json!({}))),
        collection: CollectionSummary {
            adopted_count: pet_list.len(),
            pets: pet_list,
        },
    })
}
