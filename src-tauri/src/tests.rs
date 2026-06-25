use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

use crate::{commands, models::settings::Settings, services::conflict_parser};

struct TestRepo {
    root: PathBuf,
}

impl TestRepo {
    fn new(name: &str) -> Self {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock")
            .as_nanos();
        let root = std::env::temp_dir().join(format!("gitpilot-{name}-{stamp}"));
        fs::create_dir_all(&root).expect("create temp repo dir");
        run(&root, &["init"]);
        run(&root, &["config", "user.email", "gitpilot@example.test"]);
        run(&root, &["config", "user.name", "GitPilot Tests"]);
        Self { root }
    }

    fn path(&self) -> String {
        self.root.to_string_lossy().to_string()
    }

    fn write(&self, relative: &str, content: &str) {
        let path = self.root.join(relative);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).expect("create parent dir");
        }
        fs::write(path, content).expect("write file");
    }

    fn commit_all(&self, message: &str) {
        run(&self.root, &["add", "--all"]);
        run(&self.root, &["commit", "-m", message]);
    }
}

impl Drop for TestRepo {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

fn run(cwd: &Path, args: &[&str]) {
    let output = Command::new("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .unwrap_or_else(|error| panic!("failed to run git {args:?}: {error}"));
    assert!(
        output.status.success(),
        "git {args:?} failed\nstdout:\n{}\nstderr:\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
}

#[test]
fn repository_recent_settings_and_status_are_functional() {
    let repo = TestRepo::new("repo-status");
    let settings_home = repo.root.join("home");
    fs::create_dir_all(&settings_home).expect("create settings home");
    std::env::set_var("HOME", &settings_home);

    assert!(commands::repository::validate_repository(repo.path()).expect("validate repo"));
    let opened = commands::repository::open_repository(repo.path()).expect("open repo");
    assert_eq!(
        opened.name,
        repo.root.file_name().unwrap().to_string_lossy().to_string()
    );

    let recent = commands::repository::save_recent_repository(repo.path()).expect("save recent");
    assert_eq!(recent.first(), Some(&repo.path()));
    let recent =
        commands::repository::remove_recent_repository(repo.path()).expect("remove recent");
    assert!(recent.is_empty());

    repo.write("tracked.txt", "base\n");
    repo.commit_all("initial");
    repo.write("tracked.txt", "base\nchanged\n");
    repo.write("new.txt", "new\n");

    let status = commands::status::get_status(repo.path()).expect("status");
    assert_eq!(status.current_branch, "master");
    assert!(status
        .unstaged
        .iter()
        .any(|file| file.path == "tracked.txt"));
    assert!(status.untracked.iter().any(|file| file.path == "new.txt"));

    let mut settings = commands::settings::get_settings().expect("get settings");
    settings.theme = "light".to_string();
    settings.recent_repositories = vec![repo.path()];
    let saved = commands::settings::save_settings(settings).expect("save settings");
    assert_eq!(saved.theme, "light");
    assert_eq!(
        commands::settings::get_settings()
            .unwrap()
            .recent_repositories
            .len(),
        1
    );
}

#[test]
fn staging_diff_commit_history_branch_tag_stash_and_validation_work() {
    let repo = TestRepo::new("git-actions");
    repo.write("app.ts", "console.log('one')\n");
    repo.write("check.php", "<?php echo 'ok';\n");

    let status = commands::status::get_status(repo.path()).expect("status before stage");
    assert_eq!(status.untracked.len(), 2);

    commands::staging::stage_file(repo.path(), "app.ts".into()).expect("stage file");
    let staged = commands::status::get_status(repo.path()).expect("status after stage");
    assert!(staged.staged.iter().any(|file| file.path == "app.ts"));

    commands::staging::unstage_file(repo.path(), "app.ts".into()).expect("unstage file");
    commands::staging::stage_all(repo.path()).expect("stage all");
    let diff = commands::diff::get_diff(repo.path(), "app.ts".into(), true).expect("staged diff");
    assert!(!diff.binary);
    assert!(diff.patch.contains("console.log"));

    assert!(commands::commit::commit(repo.path(), "".into(), false).is_err());
    commands::commit::commit(repo.path(), "initial commit".into(), false).expect("commit");

    repo.write("app.ts", "console.log('two')\n");
    let unstaged_diff =
        commands::diff::get_diff(repo.path(), "app.ts".into(), false).expect("unstaged diff");
    assert!(unstaged_diff.patch.contains("two"));
    commands::staging::discard_file(repo.path(), "app.ts".into()).expect("discard tracked file");

    repo.write("delete-me.txt", "temporary");
    commands::staging::delete_untracked_file(repo.path(), "delete-me.txt".into())
        .expect("delete untracked");
    assert!(!repo.root.join("delete-me.txt").exists());

    commands::branch::create_branch(repo.path(), "feature/test".into(), false)
        .expect("create branch");
    let branches = commands::branch::list_branches(repo.path()).expect("list branches");
    assert!(branches.iter().any(|branch| branch.name == "feature/test"));
    assert!(commands::branch::compare_branch(repo.path(), "feature/test".into()).is_ok());
    commands::branch::rename_branch(repo.path(), "feature/test".into(), "feature/renamed".into())
        .expect("rename branch");
    commands::branch::delete_branch(repo.path(), "feature/renamed".into(), true)
        .expect("delete branch");

    commands::tag::create_lightweight_tag(repo.path(), "v0.1.0".into()).expect("create tag");
    commands::tag::create_annotated_tag(repo.path(), "v0.1.1".into(), "release".into())
        .expect("create annotated tag");
    let tags = commands::tag::list_tags(repo.path()).expect("list tags");
    assert!(tags.iter().any(|tag| tag.name == "v0.1.0"));
    commands::tag::delete_tag(repo.path(), "v0.1.0".into()).expect("delete tag");

    repo.write("stash.txt", "stash me");
    commands::stash::create_stash(repo.path(), "work in progress".into()).expect("create stash");
    let stashes = commands::stash::list_stashes(repo.path()).expect("list stashes");
    assert!(!stashes.is_empty());
    commands::stash::apply_stash(repo.path(), "stash@{0}".into()).expect("apply stash");
    commands::stash::drop_stash(repo.path(), "stash@{0}".into()).expect("drop stash");

    let history = commands::history::get_history(repo.path(), 10).expect("history");
    assert!(history
        .iter()
        .any(|commit| commit.message == "initial commit"));
    let files = commands::history::get_commit_files(repo.path(), history[0].hash.clone())
        .expect("commit files");
    assert!(!files.is_empty());
    assert!(commands::history::compare_commits(repo.path(), "HEAD".into(), "HEAD".into()).is_ok());

    repo.write("check.php", "<?php echo 'changed';\n");
    let validation =
        commands::validation::run_validation(repo.path()).expect("validation command list");
    assert!(validation
        .iter()
        .any(|output| output.command.starts_with("php -l")));
}

#[test]
fn remote_push_fetch_and_upstream_paths_work() {
    let repo = TestRepo::new("remote-local");
    repo.write("README.md", "remote test\n");
    repo.commit_all("initial");

    let bare = TestRepo::new("remote-bare");
    fs::remove_dir_all(&bare.root).expect("clear bare dir");
    run(
        bare.root.parent().unwrap(),
        &[
            "init",
            "--bare",
            bare.root.file_name().unwrap().to_str().unwrap(),
        ],
    );

    run(
        &repo.root,
        &["remote", "add", "origin", bare.root.to_str().unwrap()],
    );
    let remotes = commands::remote::list_remotes(repo.path()).expect("list remotes");
    assert_eq!(remotes[0].name, "origin");

    commands::remote::push_new_branch(repo.path(), "origin".into(), "master".into())
        .expect("push upstream");
    commands::remote::fetch(repo.path(), "origin".into()).expect("fetch");
    commands::remote::push(repo.path()).expect("push");
}

#[test]
fn merge_rebase_conflict_parser_and_resolver_are_tested() {
    let repo = TestRepo::new("merge-rebase");
    repo.write("conflict.txt", "base\n");
    repo.commit_all("base");

    commands::branch::create_branch(repo.path(), "incoming".into(), true).expect("branch incoming");
    repo.write("conflict.txt", "incoming\n");
    repo.commit_all("incoming change");
    commands::branch::checkout_branch(repo.path(), "master".into()).expect("checkout master");
    repo.write("conflict.txt", "current\n");
    repo.commit_all("current change");

    let merge_result = commands::merge::merge_branch(repo.path(), "incoming".into());
    assert!(
        merge_result.is_err(),
        "merge should surface conflict as structured error"
    );
    let status = commands::status::get_status(repo.path()).expect("conflicted status");
    assert!(status.merge_state.is_merging);
    assert!(status
        .conflicted
        .iter()
        .any(|file| file.path == "conflict.txt"));

    let parsed = commands::merge::parse_conflict_file(repo.path(), "conflict.txt".into())
        .expect("parse conflict file");
    assert!(parsed.has_markers);
    assert_eq!(parsed.blocks.len(), 1);
    assert!(commands::merge::save_resolved_file(
        repo.path(),
        "conflict.txt".into(),
        parsed.content
    )
    .is_err());
    commands::merge::save_resolved_file(repo.path(), "conflict.txt".into(), "resolved\n".into())
        .expect("save resolved file");
    commands::merge::continue_merge(repo.path()).expect("continue merge");

    commands::branch::create_branch(repo.path(), "rebase-target".into(), false)
        .expect("create rebase target");
    let rebase =
        commands::rebase::start_rebase(repo.path(), "rebase-target".into()).expect("start rebase");
    assert!(rebase.success);
    assert!(commands::rebase::continue_rebase(repo.path()).is_err());
    assert!(commands::rebase::abort_rebase(repo.path()).is_err());
    assert!(commands::rebase::skip_rebase(repo.path()).is_err());
}

#[test]
fn conflict_parser_and_ai_helpers_cover_non_git_units() {
    let content = "a\n<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> branch\nz".to_string();
    let parsed = conflict_parser::parse("file.txt".into(), content.clone());
    assert!(parsed.has_markers);
    assert_eq!(parsed.blocks[0].current, "ours");
    assert_eq!(parsed.blocks[0].incoming, "theirs");
    assert!(conflict_parser::contains_markers(&content));

    let explain = commands::ai::explain_diff(
        "/tmp".into(),
        "diff --git a/a b/a".into(),
        "ollama".into(),
        "llama3".into(),
    )
    .expect("explain diff");
    assert!(explain.requires_review);
    assert!(explain.text.contains("Explain this diff"));

    let branch = commands::ai::suggest_branch_name(
        "add settings panel".into(),
        "openai".into(),
        "gpt".into(),
    )
    .expect("suggest branch");
    assert!(branch.requires_review);

    let resolved = commands::ai::resolve_conflict_block(
        "ours".into(),
        "theirs".into(),
        "claude".into(),
        "sonnet".into(),
    )
    .expect("resolve conflict block");
    assert!(resolved.text.contains("Suggest resolution"));

    let settings = Settings::default();
    assert!(settings
        .shortcuts
        .iter()
        .any(|shortcut| shortcut.contains("Ctrl/Cmd+O")));
}
