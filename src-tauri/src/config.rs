// User configuration files (settings.json, keybindings.json, themes/*.json,
// recent.json) live in the OS app config directory. For example:
//   macOS:   ~/Library/Application Support/dev.kestrel.editor/
//   Linux:   ~/.config/dev.kestrel.editor/
//   Windows: %APPDATA%\dev.kestrel.editor\

use std::fs;
use std::io::ErrorKind;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Config names are relative, use "/" separators, and cannot climb out of the config directory.
fn resolve(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    let bad = name.is_empty()
        || name.starts_with('/')
        || name.contains('\\')
        || name.split('/').any(|part| part.is_empty() || part == "." || part == "..");
    if bad {
        return Err(format!("Invalid config name: {name}"));
    }
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    Ok(dir.join(name))
}

#[tauri::command]
pub fn config_path(app: AppHandle, name: String) -> Result<String, String> {
    Ok(resolve(&app, &name)?.to_string_lossy().into_owned())
}

/// Returns None when the file does not exist yet.
#[tauri::command]
pub fn config_read(app: AppHandle, name: String) -> Result<Option<String>, String> {
    match fs::read_to_string(resolve(&app, &name)?) {
        Ok(text) => Ok(Some(text)),
        Err(e) if e.kind() == ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn config_write(app: AppHandle, name: String, content: String) -> Result<(), String> {
    let path = resolve(&app, &name)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(path, content).map_err(|e| e.to_string())
}

/// File names inside a config subfolder (for example "themes"). Empty if it does not exist.
#[tauri::command]
pub fn config_list(app: AppHandle, dir: String) -> Result<Vec<String>, String> {
    let path = resolve(&app, &dir)?;
    let entries = match fs::read_dir(path) {
        Ok(entries) => entries,
        Err(e) if e.kind() == ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(e.to_string()),
    };
    let mut names: Vec<String> = entries
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.path().is_file())
        .map(|entry| entry.file_name().to_string_lossy().into_owned())
        .collect();
    names.sort();
    Ok(names)
}
