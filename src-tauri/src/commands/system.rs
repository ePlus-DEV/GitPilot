use std::process::Command;
use serde::Serialize;

#[derive(Serialize)]
pub struct ShellOutput {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

#[tauri::command]
pub fn open_in_terminal(path: String) -> Result<(), String> {
    open_terminal_impl(path)
}

#[tauri::command]
pub fn open_in_file_manager(path: String) -> Result<(), String> {
    open_file_manager_impl(path)
}

#[tauri::command]
pub fn run_shell_command(path: String, command: String) -> Result<ShellOutput, String> {
    let output = shell_exec(&path, &command).map_err(|e| e.to_string())?;
    Ok(ShellOutput {
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        exit_code: output.status.code().unwrap_or(-1),
    })
}

#[cfg(target_os = "windows")]
fn shell_exec(path: &str, command: &str) -> std::io::Result<std::process::Output> {
    Command::new("cmd")
        .args(["/c", command])
        .current_dir(path)
        .output()
}

#[cfg(not(target_os = "windows"))]
fn shell_exec(path: &str, command: &str) -> std::io::Result<std::process::Output> {
    Command::new("sh")
        .args(["-c", command])
        .current_dir(path)
        .output()
}

#[cfg(target_os = "windows")]
fn open_terminal_impl(path: String) -> Result<(), String> {
    Command::new("cmd")
        .args(["/c", "start", "cmd", "/k", &format!("cd /d \"{}\"", path)])
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn open_terminal_impl(path: String) -> Result<(), String> {
    Command::new("open")
        .args(["-a", "Terminal", &path])
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn open_terminal_impl(path: String) -> Result<(), String> {
    Command::new("xterm")
        .current_dir(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(target_os = "windows")]
fn open_file_manager_impl(path: String) -> Result<(), String> {
    Command::new("explorer")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn open_file_manager_impl(path: String) -> Result<(), String> {
    Command::new("open")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn open_file_manager_impl(path: String) -> Result<(), String> {
    Command::new("xdg-open")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}
