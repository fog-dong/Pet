use serde::{Deserialize, Serialize};
use serde_json::Value;

const STAR_RATE: [f64; 4] = [0.0, 0.5, 0.8, 1.0];
pub const RECOVERY_STARS_FALLBACK: i32 = 1;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RewardConfig {
    pub coins: i32,
    pub hearts: i32,
    #[serde(default)]
    #[allow(dead_code)]
    pub affection: i32,
}

#[derive(Debug, Clone)]
pub struct CaseConfigItem {
    pub case_id: String,
    pub pet_id: String,
    pub pet_species: String,
    pub pet_name: String,
    pub breed: String,
    pub rarity: String,
    pub severity: String,
    pub correct_medicine: Option<String>,
    pub correct_bed: Option<String>,
    pub base_rewards: RewardConfig,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosisInput {
    #[serde(rename = "type")]
    pub dtype: String,
    pub stars: i32,
    pub mistakes: i32,
    pub duration_ms: i64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TreatmentInput {
    pub result: String,
    pub medicine_used: Vec<String>,
    pub bed_used: bool,
    pub healing: i32,
}

#[derive(Debug, Clone)]
pub struct ComputedCase {
    pub stars: i32,
    pub diagnosis_stars: i32,
    pub treatment_stars: i32,
    pub recovery_stars: i32,
    pub status: &'static str,
    pub affection: i32,
}

pub fn parse_case_item(case_id: &str, raw: &Value) -> Option<CaseConfigItem> {
    let obj = raw.as_object()?;
    let base = obj.get("baseRewards")?;
    let base_rewards = RewardConfig {
        coins: base.get("coins")?.as_i64()? as i32,
        hearts: base.get("hearts")?.as_i64()? as i32,
        affection: base
            .get("affection")
            .and_then(|v| v.as_i64())
            .unwrap_or(0) as i32,
    };
    let treatment = obj.get("treatment").and_then(|v| v.as_object());
    let correct = treatment.and_then(|t| t.get("correct")).and_then(|v| v.as_object());
    let pet_id = obj
        .get("petId")
        .and_then(|v| v.as_str())
        .unwrap_or(case_id)
        .to_string();
    Some(CaseConfigItem {
        case_id: case_id.to_string(),
        pet_id,
        pet_species: obj
            .get("petSpecies")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .into(),
        pet_name: obj
            .get("petName")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .into(),
        breed: obj
            .get("breed")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .into(),
        rarity: obj
            .get("rarity")
            .and_then(|v| v.as_str())
            .unwrap_or("common")
            .into(),
        severity: obj
            .get("severity")
            .and_then(|v| v.as_str())
            .unwrap_or("normal")
            .into(),
        correct_medicine: correct
            .and_then(|c| c.get("medicine"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        correct_bed: correct
            .and_then(|c| c.get("bed"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        base_rewards,
    })
}

fn clamp_int(value: i32, min: i32, max: i32) -> i32 {
    value.max(min).min(max)
}

fn verified_score(item: &CaseConfigItem, treatment: &TreatmentInput) -> i32 {
    let medicine_ok = item
        .correct_medicine
        .as_ref()
        .is_some_and(|m| treatment.medicine_used.len() == 1 && &treatment.medicine_used[0] == m);
    let bed_ok = item
        .correct_bed
        .as_ref()
        .is_some_and(|b| treatment.bed_used == (b == "住院"));
    (if medicine_ok { 1 } else { 0 }) + (if bed_ok { 1 } else { 0 })
}

fn treatment_threshold(severity: &str) -> i32 {
    if severity == "critical" {
        3
    } else {
        2
    }
}

fn treatment_stars(score: i32, severity: &str) -> i32 {
    if score < treatment_threshold(severity) {
        0
    } else if score >= 3 {
        3
    } else {
        2
    }
}

fn total_stars(diagnosis: i32, treatment: i32, recovery: i32) -> i32 {
    if treatment <= 0 {
        return 0;
    }
    if diagnosis >= 3 && treatment >= 3 {
        return 3;
    }
    if diagnosis >= 2 && treatment >= 2 {
        return if recovery >= 3 { 3 } else { 2 };
    }
    1
}

fn affection_gain(diagnosis_stars: i32, treatment_score: i32, medicine_ok: bool) -> i32 {
    let diagnosis = [0, 5, 10, 15][clamp_int(diagnosis_stars, 0, 3) as usize];
    let treatment = if treatment_score >= 3 {
        20
    } else if treatment_score >= 2 {
        10
    } else {
        0
    };
    diagnosis + treatment + if medicine_ok { 5 } else { 0 } + 5
}

pub fn compute_case(
    item: &CaseConfigItem,
    diagnosis: &DiagnosisInput,
    treatment: &TreatmentInput,
) -> ComputedCase {
    let diagnosis_stars = clamp_int(diagnosis.stars, 0, 3);
    let verified = verified_score(item, treatment);
    let claimed = clamp_int(treatment.healing, 0, 3);
    let treatment_score = claimed.max(verified).min(verified + 1);
    let severity = item.severity.as_str();
    let threshold = treatment_threshold(severity);
    let t_stars = treatment_stars(treatment_score, severity);
    let medicine_ok = item
        .correct_medicine
        .as_ref()
        .is_some_and(|m| treatment.medicine_used.len() == 1 && &treatment.medicine_used[0] == m);
    let status = if treatment_score >= 3 {
        "succeeded"
    } else if treatment_score >= threshold {
        "partial"
    } else {
        "failed"
    };
    ComputedCase {
        stars: total_stars(diagnosis_stars, t_stars, RECOVERY_STARS_FALLBACK),
        diagnosis_stars,
        treatment_stars: t_stars,
        recovery_stars: RECOVERY_STARS_FALLBACK,
        status,
        affection: affection_gain(diagnosis_stars, treatment_score, medicine_ok),
    }
}

pub fn reward_amounts(base: &RewardConfig, stars: i32, first_clear: bool) -> (i32, i32) {
    let rate = STAR_RATE.get(stars as usize).copied().unwrap_or(0.0);
    let coins = (base.coins as f64 * rate * if first_clear { 1.5 } else { 1.0 }).round() as i32;
    let hearts = (base.hearts as f64 * rate).round() as i32;
    (coins, hearts)
}
