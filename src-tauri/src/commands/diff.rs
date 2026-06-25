use crate::{
    models::git::{DiffResult, GitError},
    services::git_service,
};
fn show(repo: &str, spec: &str) -> String {
    git_service::git_text(repo, &["show", spec]).unwrap_or_default()
}
#[tauri::command]
pub fn get_diff(
    repo_path: String,
    file_path: String,
    cached: bool,
) -> Result<DiffResult, GitError> {
    let args = if cached {
        vec!["diff", "--cached", "--binary", "--", file_path.as_str()]
    } else {
        vec!["diff", "--binary", "--", file_path.as_str()]
    };
    let patch = git_service::git_checked(&repo_path, &args)?.stdout;
    let binary = patch.contains("Binary files") || patch.contains("GIT binary patch");
    let old_text = if cached {
        show(&repo_path, &format!("HEAD:{file_path}"))
    } else {
        show(&repo_path, &format!(":{file_path}"))
    };
    let new_text = if cached {
        show(&repo_path, &format!(":{file_path}"))
    } else {
        std::fs::read_to_string(std::path::Path::new(&repo_path).join(&file_path))
            .unwrap_or_default()
    };
    Ok(DiffResult {
        file_path,
        old_text,
        new_text,
        patch,
        binary,
        cached,
    })
}
#[tauri::command]
pub fn get_commit_file_diff(
    repo_path: String,
    commit: String,
    file_path: String,
) -> Result<DiffResult, GitError> {
    let spec = format!("{commit}^..{commit}");
    let patch = git_service::git_checked(&repo_path, &["diff", &spec, "--", &file_path])?.stdout;
    Ok(DiffResult {
        file_path,
        old_text: String::new(),
        new_text: String::new(),
        binary: patch.contains("Binary files"),
        cached: false,
        patch,
    })
}
