use crate::{
    models::{
        conflict::ParsedConflictFile,
        git::{GitCommandOutput, GitError},
    },
    services::{conflict_parser, git_service},
};
use std::{fs, path::Path};
#[tauri::command]
pub fn merge_branch(repo_path: String, branch: String) -> Result<GitCommandOutput, GitError> {
    git_service::git_checked(&repo_path, &["merge", &branch])
}
#[tauri::command]
pub fn abort_merge(repo_path: String) -> Result<GitCommandOutput, GitError> {
    git_service::git_checked(&repo_path, &["merge", "--abort"])
}
#[tauri::command]
pub fn continue_merge(repo_path: String) -> Result<GitCommandOutput, GitError> {
    git_service::git_checked(&repo_path, &["commit", "--no-edit"])
}
#[tauri::command]
pub fn parse_conflict_file(
    repo_path: String,
    file_path: String,
) -> Result<ParsedConflictFile, GitError> {
    let content = fs::read_to_string(Path::new(&repo_path).join(&file_path))
        .map_err(|e| GitError::new("READ_FAILED", e.to_string(), ""))?;
    Ok(conflict_parser::parse(file_path, content))
}
#[tauri::command]
pub fn save_resolved_file(
    repo_path: String,
    file_path: String,
    content: String,
) -> Result<GitCommandOutput, GitError> {
    if conflict_parser::contains_markers(&content) {
        return Err(GitError::new(
            "CONFLICT_MARKERS_REMAIN",
            "Resolve all conflict markers before saving",
            "",
        ));
    }
    fs::write(Path::new(&repo_path).join(&file_path), content)
        .map_err(|e| GitError::new("WRITE_FAILED", e.to_string(), ""))?;
    git_service::git_checked(&repo_path, &["add", "--", &file_path])
}
