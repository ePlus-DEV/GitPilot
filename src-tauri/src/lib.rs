pub mod commands;
pub mod models;
pub mod services;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            use tauri::menu::{MenuItem, PredefinedMenuItem, SubmenuBuilder, MenuBuilder};
            use tauri::Emitter;

            let h = app.handle();

            // ── File ────────────────────────────────────────────────────────
            let clone   = MenuItem::with_id(h, "clone_repo",      "Clone Repo...",           true, Some("CmdOrCtrl+N"))?;
            let init    = MenuItem::with_id(h, "init_repo",       "Init Repo...",            true, Some("CmdOrCtrl+I"))?;
            let open    = MenuItem::with_id(h, "open_repo",       "Open Repo...",            true, Some("CmdOrCtrl+O"))?;
            let mgmt    = MenuItem::with_id(h, "repo_management", "Open Repo Management",    true, Some("CmdOrCtrl+Alt+O"))?;
            let term    = MenuItem::with_id(h, "open_terminal",   "Open External Terminal",  true, Some("Alt+T"))?;
            let fmgr    = MenuItem::with_id(h, "open_file_manager","Open in File Manager",   true, Some("Alt+O"))?;
            let prefs   = MenuItem::with_id(h, "preferences",     "Preferences...",          true, Some("CmdOrCtrl+Comma"))?;
            let quit      = PredefinedMenuItem::quit(h, Some("Exit"))?;
            let relaunch  = MenuItem::with_id(h, "relaunch", "Relaunch", true, Some("CmdOrCtrl+Shift+R"))?;

            let file = SubmenuBuilder::new(h, "File")
                .item(&clone)
                .item(&init)
                .item(&open)
                .item(&mgmt)
                .separator()
                .item(&term)
                .item(&fmgr)
                .separator()
                .item(&prefs)
                .separator()
                .item(&relaunch)
                .item(&quit)
                .build()?;

            // ── View ────────────────────────────────────────────────────────
            let refresh = MenuItem::with_id(h, "refresh", "Refresh", true, Some("CmdOrCtrl+R"))?;

            let view = SubmenuBuilder::new(h, "View")
                .item(&refresh)
                .build()?;

            // ── Help ────────────────────────────────────────────────────────
            let check_update = MenuItem::with_id(h, "check_update", "Check for Update", true, None::<&str>)?;
            let about = MenuItem::with_id(h, "about", "About GitPilot", true, None::<&str>)?;

            let help = SubmenuBuilder::new(h, "Help")
                .item(&check_update)
                .separator()
                .item(&about)
                .build()?;

            // ── Root menu ───────────────────────────────────────────────────
            let menu = MenuBuilder::new(h)
                .item(&file)
                .item(&view)
                .item(&help)
                .build()?;

            app.set_menu(menu)?;

            app.on_menu_event(|app_handle, event| {
                let _ = app_handle.emit(&format!("menu://{}", event.id().as_ref()), ());
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::repository::validate_repository,
            commands::repository::open_repository,
            commands::repository::init_repository,
            commands::repository::clone_repository,
            commands::repository::list_recent_repositories,
            commands::repository::save_recent_repository,
            commands::repository::remove_recent_repository,
            commands::status::get_status,
            commands::staging::stage_file,
            commands::staging::unstage_file,
            commands::staging::stage_all,
            commands::staging::unstage_all,
            commands::staging::discard_file,
            commands::staging::delete_untracked_file,
            commands::diff::get_diff,
            commands::diff::get_commit_file_diff,
            commands::commit::commit,
            commands::commit::staged_diff,
            commands::branch::list_branches,
            commands::branch::create_branch,
            commands::branch::checkout_branch,
            commands::branch::rename_branch,
            commands::branch::delete_branch,
            commands::branch::compare_branch,
            commands::remote::list_remotes,
            commands::remote::fetch,
            commands::remote::fetch_all,
            commands::remote::pull,
            commands::remote::push,
            commands::remote::push_new_branch,
            commands::history::get_history,
            commands::history::get_commit_files,
            commands::history::compare_commits,
            commands::history::checkout_commit,
            commands::history::create_branch_from_commit,
            commands::history::create_tag_from_commit,
            commands::history::create_annotated_tag_from_commit,
            commands::history::create_patch_from_commit,
            commands::history::restore_file_from_commit,
            commands::history::cherry_pick_commit,
            commands::history::revert_commit,
            commands::history::reset_to_commit,
            commands::history::abort_cherry_pick,
            commands::history::blame_file,
            commands::merge::merge_branch,
            commands::merge::abort_merge,
            commands::merge::continue_merge,
            commands::merge::parse_conflict_file,
            commands::merge::get_conflict_file,
            commands::merge::save_resolved_file,
            commands::rebase::start_rebase,
            commands::rebase::continue_rebase,
            commands::rebase::abort_rebase,
            commands::rebase::skip_rebase,
            commands::rebase::get_rebase_state,
            commands::rebase::start_interactive_rebase,
            commands::stash::list_stashes,
            commands::stash::create_stash,
            commands::stash::apply_stash,
            commands::stash::pop_stash,
            commands::stash::drop_stash,
            commands::stash::rename_stash,
            commands::tag::list_tags,
            commands::tag::create_lightweight_tag,
            commands::tag::create_annotated_tag,
            commands::tag::delete_tag,
            commands::tag::push_tag,
            commands::validation::run_validation,
            commands::worktree::list_worktrees,
            commands::worktree::create_worktree,
            commands::worktree::remove_worktree,
            commands::search::smart_search,
            commands::ai::ai_complete,
            commands::ai::explain_diff,
            commands::ai::generate_commit_message,
            commands::ai::suggest_branch_name,
            commands::ai::resolve_conflict_block,
            commands::settings::get_settings,
            commands::settings::save_settings,
            commands::maintenance::list_reflog,
            commands::maintenance::list_submodules,
            commands::maintenance::update_submodules,
            commands::maintenance::start_bisect,
            commands::maintenance::mark_bisect,
            commands::maintenance::reset_bisect,
            commands::maintenance::get_bisect_state,
            commands::graph::get_commit_graph,
            commands::system::open_in_terminal,
            commands::system::open_in_file_manager,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run GitPilot");
}
