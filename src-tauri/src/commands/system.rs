use std::process::Command;

#[tauri::command]
pub fn open_in_terminal(path: String) -> Result<(), String> {
    open_terminal_impl(path)
}

#[tauri::command]
pub fn open_in_file_manager(path: String) -> Result<(), String> {
    open_file_manager_impl(path)
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
