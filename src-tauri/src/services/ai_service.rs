use crate::models::ai::{AiRequest, AiResponse};
pub fn complete(req: AiRequest) -> AiResponse {
    let text=format!("Provider: {}\nModel: {}\n\nAI provider is optional. Review this generated assistance before applying.\n\n{}",req.provider,req.model,req.prompt);
    AiResponse {
        text,
        requires_review: true,
    }
}
