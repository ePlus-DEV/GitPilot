use serde::{Deserialize, Serialize};
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub theme: String,
    pub git_path: String,
    pub default_target_branch: String,
    pub recent_repositories: Vec<String>,
    pub ai_provider: String,
    pub ai_api_key: String,
    pub ai_model: String,
    pub validation_commands: Vec<String>,
    pub shortcuts: Vec<String>,
    #[serde(default)]
    pub auto_fetch_interval: u32,
    #[serde(default)]
    pub update_channel: String,
}
impl Default for Settings {
    fn default() -> Self {
        Self {
            theme: "dark".into(),
            git_path: "git".into(),
            default_target_branch: "main".into(),
            recent_repositories: vec![],
            ai_provider: "ollama".into(),
            ai_api_key: "".into(),
            ai_model: "".into(),
            validation_commands: vec!["npm run lint".into(), "php artisan test".into()],
            auto_fetch_interval: 0,
            update_channel: "stable".into(),
            shortcuts: vec![
                "Ctrl/Cmd+O".into(),
                "Ctrl/Cmd+S".into(),
                "Ctrl/Cmd+R".into(),
                "Ctrl/Cmd+Enter".into(),
                "Ctrl/Cmd+Shift+P".into(),
            ],
        }
    }
}
