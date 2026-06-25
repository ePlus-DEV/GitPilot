use serde::{Deserialize, Serialize};
#[derive(Debug, Default, Serialize, Deserialize)]
pub struct AppSettings {
    pub theme: String,
    pub git_path: Option<String>,
    pub default_target_branch: String,
    pub recent_repositories: Vec<String>,
}
