use crate::{
    models::{
        conflict::{ConflictFileData, ParsedConflictFile},
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
pub fn get_conflict_file(
    repo_path: String,
    file_path: String,
) -> Result<ConflictFileData, GitError> {
    let ancestor_content = git_service::git_text(&repo_path, &["show", &format!(":1:{}", file_path)]).ok();
    let ours_content = git_service::git_text(&repo_path, &["show", &format!(":2:{}", file_path)]).ok();
    let theirs_content = git_service::git_text(&repo_path, &["show", &format!(":3:{}", file_path)]).ok();
    let working_content = fs::read_to_string(Path::new(&repo_path).join(&file_path))
        .map_err(|e| GitError::new("READ_FAILED", e.to_string(), ""))?;
    let is_binary = ours_content.as_deref().map(|s| s.contains('\0')).unwrap_or(false)
        || theirs_content.as_deref().map(|s| s.contains('\0')).unwrap_or(false);
    let line_ending = if working_content.contains("\r\n") { "crlf" } else { "lf" }.to_string();
    Ok(ConflictFileData {
        path: file_path,
        ancestor_content,
        ours_content,
        theirs_content,
        working_content,
        is_binary,
        line_ending,
    })
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
