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

/// True if both paths are the same file on disk. Lets "a.txt" be renamed to "A.txt" on
/// case-insensitive file systems (the macOS default), where the new name "already exists".
#[cfg(unix)]
fn same_file(a: &Path, b: &Path) -> bool {
    use std::os::unix::fs::MetadataExt;
    match (fs::symlink_metadata(a), fs::symlink_metadata(b)) {
        (Ok(x), Ok(y)) => x.dev() == y.dev() && x.ino() == y.ino(),
        _ => false,
    }
}

#[cfg(not(unix))]
fn same_file(a: &Path, b: &Path) -> bool {
    a.to_string_lossy().to_lowercase() == b.to_string_lossy().to_lowercase()
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
    if to.exists() && !same_file(&from, &to) {
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};

    static COUNTER: AtomicU32 = AtomicU32::new(0);

    /// A fresh empty folder under the system temp dir, removed on drop.
    struct Sandbox(PathBuf);

    impl Sandbox {
        fn new() -> Self {
            let n = COUNTER.fetch_add(1, Ordering::SeqCst);
            let dir = std::env::temp_dir().join(format!("kestrel-fs-test-{}-{n}", std::process::id()));
            fs::create_dir_all(&dir).unwrap();
            Sandbox(dir)
        }
        fn path(&self) -> String {
            path_string(&self.0)
        }
    }

    impl Drop for Sandbox {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn lists_folders_first_then_files_case_insensitively() {
        let sb = Sandbox::new();
        fs_create_file(sb.path(), "b.txt".into()).unwrap();
        fs_create_file(sb.path(), "A.txt".into()).unwrap();
        fs_create_dir(sb.path(), "zeta".into()).unwrap();
        let names: Vec<String> = fs_list_dir(sb.path()).unwrap().into_iter().map(|e| e.name).collect();
        assert_eq!(names, ["zeta", "A.txt", "b.txt"]);
    }

    #[test]
    fn create_refuses_existing_names_and_bad_names() {
        let sb = Sandbox::new();
        fs_create_file(sb.path(), "a.txt".into()).unwrap();
        assert!(fs_create_file(sb.path(), "a.txt".into()).unwrap_err().contains("already exists"));
        assert!(fs_create_dir(sb.path(), "a.txt".into()).is_err());
        for bad in ["", "  ", "..", ".", "x/y", "x\\y"] {
            assert!(fs_create_file(sb.path(), bad.into()).is_err(), "should reject {bad:?}");
        }
    }

    #[test]
    fn write_then_read_round_trips_and_rejects_non_utf8() {
        let sb = Sandbox::new();
        let file = fs_create_file(sb.path(), "t.txt".into()).unwrap();
        fs_write_file(file.clone(), "héllo\n".into()).unwrap();
        assert_eq!(fs_read_file(file).unwrap(), "héllo\n");
        let bin = Path::new(&sb.path()).join("b.bin");
        fs::write(&bin, [0xff, 0xfe, 0x00]).unwrap();
        assert!(fs_read_file(path_string(&bin)).unwrap_err().contains("not a UTF-8"));
    }

    #[test]
    fn rename_works_and_refuses_to_overwrite() {
        let sb = Sandbox::new();
        let a = fs_create_file(sb.path(), "a.txt".into()).unwrap();
        fs_create_file(sb.path(), "b.txt".into()).unwrap();
        assert!(fs_rename(a.clone(), "b.txt".into()).unwrap_err().contains("already exists"));
        let renamed = fs_rename(a.clone(), "c.txt".into()).unwrap();
        assert!(renamed.ends_with("c.txt"));
        assert!(!Path::new(&a).exists());
        // Renaming to its own name is not an error.
        assert_eq!(fs_rename(renamed.clone(), "c.txt".into()).unwrap(), renamed);
    }

    #[test]
    fn move_into_folder_and_guards() {
        let sb = Sandbox::new();
        let file = fs_create_file(sb.path(), "a.txt".into()).unwrap();
        let sub = fs_create_dir(sb.path(), "sub".into()).unwrap();
        let moved = fs_move(file.clone(), sub.clone()).unwrap();
        assert!(Path::new(&moved).is_file());
        assert!(!Path::new(&file).exists());

        // A name clash at the destination is refused.
        let again = fs_create_file(sb.path(), "a.txt".into()).unwrap();
        assert!(fs_move(again, sub.clone()).unwrap_err().contains("already exists"));

        // A folder cannot go into itself or its own child.
        let inner = fs_create_dir(sub.clone(), "inner".into()).unwrap();
        assert!(fs_move(sub.clone(), sub.clone()).unwrap_err().contains("into itself"));
        assert!(fs_move(sub.clone(), inner).unwrap_err().contains("into itself"));
        // The destination must be a folder.
        assert!(fs_move(moved.clone(), moved).is_err());
    }

    #[test]
    fn remove_deletes_files_and_whole_folders() {
        let sb = Sandbox::new();
        let sub = fs_create_dir(sb.path(), "sub".into()).unwrap();
        fs_create_file(sub.clone(), "x.txt".into()).unwrap();
        let file = fs_create_file(sb.path(), "f.txt".into()).unwrap();
        fs_remove(file.clone()).unwrap();
        fs_remove(sub.clone()).unwrap();
        assert!(!Path::new(&file).exists() && !Path::new(&sub).exists());
        assert!(fs_remove(file).is_err());
    }
}
