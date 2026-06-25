use serde::{Deserialize, Serialize};
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiRequest {
    pub provider: String,
    pub model: String,
    pub api_key: Option<String>,
    pub prompt: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiResponse {
    pub text: String,
    pub requires_review: bool,
}
