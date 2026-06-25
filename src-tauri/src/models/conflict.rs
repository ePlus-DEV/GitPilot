use serde::Serialize;
#[derive(Debug, Serialize)]
pub struct ConflictBlock {
    pub id: usize,
    pub start_line: usize,
    pub end_line: usize,
    pub current: String,
    pub incoming: String,
    pub base: Option<String>,
}
