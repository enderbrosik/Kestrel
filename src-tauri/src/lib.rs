// Kestrel desktop shell. Native commands (file system, config storage) are added
// in their own modules under src-tauri/src/ as each feature lands.

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .run(tauri::generate_context!())
        .expect("error while running Kestrel");
}
