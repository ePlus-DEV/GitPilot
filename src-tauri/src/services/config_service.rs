use crate::models::settings::Settings;
use std::{fs, path::PathBuf};
fn path() -> Result<PathBuf, String> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| "Cannot locate home directory".to_string())?;
    let dir = PathBuf::from(home).join(".gitpilot");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("settings.json"))
}
pub fn load() -> Result<Settings, String> {
    let p = path()?;
    if !p.exists() {
        return Ok(Settings::default());
    }
    let s = fs::read_to_string(p).map_err(|e| e.to_string())?;
    serde_json::from_str(&s).map_err(|e| e.to_string())
}
pub fn save(settings: &Settings) -> Result<Settings, String> {
    let p = path()?;
    fs::write(
        p,
        serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    Ok(settings.clone())
}
