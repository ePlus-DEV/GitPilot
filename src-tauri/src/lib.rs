pub mod commands;
pub mod models;
pub mod services;
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::repository::open_repository,
            commands::status::get_status,
            commands::status::stage_file,
            commands::status::unstage_file,
            commands::status::stage_all,
            commands::status::unstage_all,
            commands::status::discard_file,
            commands::diff::get_diff,
            commands::commit::commit_changes,
            commands::branch::list_branches,
            commands::remote::fetch,
            commands::remote::pull,
            commands::remote::push,
            commands::merge::merge_branch,
            commands::merge::abort_merge,
            commands::rebase::continue_rebase,
            commands::stash::list_stashes,
            commands::tag::list_tags,
            commands::validation::validate_file,
            commands::ai::explain_diff
        ])
        .run(tauri::generate_context!())
        .expect("failed to run GitPilot");
}
