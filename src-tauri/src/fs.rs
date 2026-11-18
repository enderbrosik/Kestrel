// File system commands used by the explorer and editor (item 1 / item 2).
// Every command takes absolute paths and returns a String error on failure so
// the frontend can show it in the status bar.

use serde::Serialize;
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
}

fn to_str_err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

fn path_string(p: &Path) -> String {
    p.to_string_lossy().into_owned()
}

fn child_path(dir: &str, name: &str) -> Result<PathBuf, String> {
    let name = name.trim();
    if name.is_empty() {
        return Err("Name cannot be empty".into());
    }
    if name.contains('/') || name.contains('\\') || name == "." || name == ".." {
        return Err(format!("Invalid name: {name}"));
    }
    Ok(Path::new(dir).join(name))
}

#[tauri::command]
pub fn fs_list_dir(path: String) -> Result<Vec<FileEntry>, String> {
    let mut out = Vec::new();
    for entry in fs::read_dir(&path).map_err(to_str_err)? {
        let entry = entry.map_err(to_str_err)?;
        // metadata() follows symlinks, so a link to a folder is shown as a folder.
        let is_dir = fs::metadata(entry.path()).map(|m| m.is_dir()).unwrap_or(false);
        out.push(FileEntry {
            name: entry.file_name().to_string_lossy().into_owned(),
            path: path_string(&entry.path()),
            is_dir,
        });
    }
    out.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(out)
}

#[tauri::command]
pub fn fs_read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| match e.kind() {
        ErrorKind::InvalidData => format!("{path} is not a UTF-8 text file"),
        _ => e.to_string(),
    })
}

#[tauri::command]
pub fn fs_write_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(to_str_err)
}

#[tauri::command]
pub fn fs_create_file(dir: String, name: String) -> Result<String, String> {
    let target = child_path(&dir, &name)?;
    fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&target)
        .map_err(|e| match e.kind() {
            ErrorKind::AlreadyExists => format!("{name} already exists"),
            _ => e.to_string(),
        })?;
    Ok(path_string(&target))
}

#[tauri::command]
pub fn fs_create_dir(dir: String, name: String) -> Result<String, String> {
    let target = child_path(&dir, &name)?;
    fs::create_dir(&target).map_err(|e| match e.kind() {
        ErrorKind::AlreadyExists => format!("{name} already exists"),
        _ => e.to_string(),
    })?;
    Ok(path_string(&target))
}

#[tauri::command]
pub fn fs_rename(path: String, new_name: String) -> Result<String, String> {
    let from = PathBuf::from(&path);
    let parent = from.parent().ok_or("Cannot rename a filesystem root")?;
    let to = child_path(&path_string(parent), &new_name)?;
    if to.exists() && to != from {
        return Err(format!("{new_name} already exists"));
    }
    fs::rename(&from, &to).map_err(to_str_err)?;
    Ok(path_string(&to))
}

#[tauri::command]
pub fn fs_move(path: String, dest_dir: String) -> Result<String, String> {
    let from = PathBuf::from(&path);
    let name = from.file_name().ok_or("Cannot move a filesystem root")?;
    let dest = Path::new(&dest_dir);
    if !dest.is_dir() {
        return Err("Destination is not a folder".into());
    }
    if dest.starts_with(&from) {
        return Err("A folder cannot be moved into itself".into());
    }
    let to = dest.join(name);
    if to == from {
        return Ok(path_string(&to));
    }
    if to.exists() {
        return Err(format!("{} already exists there", name.to_string_lossy()));
    }
    fs::rename(&from, &to).map_err(to_str_err)?;
    Ok(path_string(&to))
}

#[tauri::command]
pub fn fs_remove(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    let meta = fs::symlink_metadata(p).map_err(to_str_err)?;
    if meta.is_dir() {
        fs::remove_dir_all(p).map_err(to_str_err)
    } else {
        fs::remove_file(p).map_err(to_str_err)
    }
}
