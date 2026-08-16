use tauri::Manager;

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
    .setup(|app| {
      if let Ok(resource_dir) = app.path().resource_dir() {
        let bcmaps_dir = resource_dir.join("resources").join("bcmaps");
        if bcmaps_dir.exists() {
          std::env::set_var("PDF_INSPECTOR_BCMAPS_DIR", &bcmaps_dir);
        }
      }
      tools::pdf::convert::ensure_bcmaps_configured();
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      commands::inspect_files,
      commands::inspect_pdfs,
      commands::convert_images,
      commands::compress_images,
      commands::convert_pdfs,
      commands::generate_logo_pack,
      commands::get_logo_presets
    ])
    .run(tauri::generate_context!())
    .expect("error while running Toolbox");
}
