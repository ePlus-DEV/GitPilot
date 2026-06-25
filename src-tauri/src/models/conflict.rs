use serde::{Deserialize, Serialize};
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
