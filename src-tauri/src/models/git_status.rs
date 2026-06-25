use super::repository::RepositoryInfo;
use serde::Serialize;
#[derive(Debug, Serialize)]
pub struct GitFileStatus {
    pub path: String,
    pub original_path: Option<String>,
    pub index: String,
    pub worktree: String,
    pub group: String,
}
#[derive(Debug, Serialize)]
pub struct GitStatus {
    pub repository: RepositoryInfo,
    pub files: Vec<GitFileStatus>,
    pub ahead: u32,
    pub behind: u32,
    pub merging: bool,
    pub rebasing: bool,
}
