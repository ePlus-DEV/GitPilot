use serde::{Deserialize, Serialize};
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConflictFileData {
    pub path: String,
    pub ancestor_content: Option<String>,
    pub ours_content: Option<String>,
    pub theirs_content: Option<String>,
    pub working_content: String,
    pub is_binary: bool,
    pub line_ending: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConflictBlock {
    pub id: usize,
    pub start_line: usize,
    pub separator_line: usize,
    pub end_line: usize,
    pub current: String,
    pub incoming: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedConflictFile {
    pub path: String,
    pub content: String,
    pub blocks: Vec<ConflictBlock>,
    pub has_markers: bool,
}
