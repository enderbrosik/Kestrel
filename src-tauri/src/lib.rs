// Kestrel desktop shell. Native commands live in their own modules and are
// registered below. Each feature adds its commands as it lands.

mod fs;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            fs::fs_list_dir,
            fs::fs_read_file,
            fs::fs_write_file,
            fs::fs_create_file,
            fs::fs_create_dir,
            fs::fs_rename,
            fs::fs_move,
            fs::fs_remove,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Kestrel");
}
