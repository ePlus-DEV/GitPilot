use crate::{models::settings::Settings, services::config_service};
#[tauri::command]
pub fn get_settings() -> Result<Settings, String> {
    config_service::load()
}
#[tauri::command]
pub fn save_settings(settings: Settings) -> Result<Settings, String> {
    config_service::save(&settings)
}
