mod commands;
mod errors;
mod models;
mod services;
mod tools;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_store::Builder::new().build())
    .invoke_handler(tauri::generate_handler![
      commands::inspect_files,
      commands::convert_images
    ])
    .run(tauri::generate_context!())
    .expect("error while running Toolbox");
}
