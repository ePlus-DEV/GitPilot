use serde::Serialize;
#[derive(Debug, Serialize)]
pub struct BranchInfo {
    pub name: String,
    pub full_name: String,
    pub current: bool,
    pub remote: bool,
    pub upstream: Option<String>,
}
