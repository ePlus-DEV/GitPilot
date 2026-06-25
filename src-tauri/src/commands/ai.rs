use crate::{
    models::{
        ai::{AiRequest, AiResponse},
        git::GitError,
    },
    services::{ai_service, git_service},
};
#[tauri::command]
pub fn ai_complete(request: AiRequest) -> Result<AiResponse, GitError> {
    Ok(ai_service::complete(request))
}
#[tauri::command]
pub fn explain_diff(
    repo_path: String,
    diff: String,
    provider: String,
    model: String,
) -> Result<AiResponse, GitError> {
    Ok(ai_service::complete(AiRequest {
        provider,
        model,
        api_key: None,
        prompt: format!("Explain this diff:\n{diff}\nRepo:{repo_path}"),
    }))
}
#[tauri::command]
pub fn generate_commit_message(
    repo_path: String,
    provider: String,
    model: String,
) -> Result<AiResponse, GitError> {
    let diff = git_service::git_text(&repo_path, &["diff", "--cached"])?;
    Ok(ai_service::complete(AiRequest {
        provider,
        model,
        api_key: None,
        prompt: format!("Generate a concise commit message for:\n{diff}"),
    }))
}
#[tauri::command]
pub fn suggest_branch_name(
    description: String,
    provider: String,
    model: String,
) -> Result<AiResponse, GitError> {
    Ok(ai_service::complete(AiRequest {
        provider,
        model,
        api_key: None,
        prompt: format!("Suggest a git branch name for: {description}"),
    }))
}
#[tauri::command]
pub fn resolve_conflict_block(
    current: String,
    incoming: String,
    provider: String,
    model: String,
) -> Result<AiResponse, GitError> {
    Ok(ai_service::complete(AiRequest {
        provider,
        model,
        api_key: None,
        prompt: format!("Suggest resolution. Current:\n{current}\nIncoming:\n{incoming}"),
    }))
}
