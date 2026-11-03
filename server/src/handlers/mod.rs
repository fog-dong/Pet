mod ad_event;
mod assist;
mod case_formula;
mod claim_habitat;
mod get_config;
mod leaderboard;
mod login;
mod order;
mod profile;
mod save_game;
mod settle_board;
mod settle_pet;
mod settle_side;
mod sync_case;
mod sync_catalog;
mod sync_settle;
mod track_event;

use axum::routing::post;
use axum::Router;
use std::sync::Arc;

use crate::state::AppState;

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/login", post(login::login))
        .route("/api/getProfile", post(profile::get_profile))
        .route("/api/saveGame", post(save_game::save_game))
        .route("/api/syncCaseResult", post(sync_case::sync_case_result))
        .route("/api/leaderboard", post(leaderboard::leaderboard))
        .route("/api/assist", post(assist::assist))
        .route("/api/adEvent", post(ad_event::ad_event))
        .route("/api/createOrder", post(order::create_order))
        .route("/api/payCallback", post(order::pay_callback))
        .route("/api/getConfig", post(get_config::get_config))
        .route("/api/trackEvent", post(track_event::track_event))
        .route("/api/claimHabitat", post(claim_habitat::claim_habitat))
}
