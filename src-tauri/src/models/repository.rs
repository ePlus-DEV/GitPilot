use serde::Serialize;
#[derive(Debug, Serialize)]
pub struct RepositoryInfo {
    pub name: String,
    pub path: String,
    pub current_branch: Option<String>,
    pub is_git_repository: bool,
}
