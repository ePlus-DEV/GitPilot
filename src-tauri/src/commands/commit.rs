use crate::{
    models::git::{GitCommandOutput, GitError},
    services::git_service,
};
#[tauri::command]
pub fn commit(
    repo_path: String,
    message: String,
    amend: bool,
) -> Result<GitCommandOutput, GitError> {
    if message.trim().is_empty() {
        return Err(GitError::new(
            "EMPTY_MESSAGE",
            "Commit message is required",
            "",
        ));
    }
    if git_service::git_text(&repo_path, &["diff", "--cached", "--name-only"])?
        .trim()
        .is_empty()
    {
        return Err(GitError::new(
            "NO_STAGED_FILES",
            "No staged files to commit",
            "",
        ));
    }
    if amend {
        git_service::git_checked(&repo_path, &["commit", "--amend", "-m", message.trim()])
    } else {
        git_service::git_checked(&repo_path, &["commit", "-m", message.trim()])
    }
}
#[tauri::command]
pub fn staged_diff(repo_path: String) -> Result<String, GitError> {
    git_service::git_text(&repo_path, &["diff", "--cached"])
}
