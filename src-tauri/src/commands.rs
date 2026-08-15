use std::path::Path;

use crate::models::InputFile;

#[tauri::command]
pub fn inspect_files(paths: Vec<String>) -> Vec<InputFile> {
  paths
    .iter()
    .map(|path| match std::fs::metadata(path) {
      Ok(metadata) if metadata.is_file() => InputFile {
        path: path.clone(),
        name: Path::new(path)
          .file_name()
          .map(|name| name.to_string_lossy().into_owned())
          .unwrap_or_else(|| path.clone()),
        extension: Path::new(path)
          .extension()
          .map(|extension| extension.to_string_lossy().to_lowercase())
          .unwrap_or_default(),
        size: metadata.len(),
        width: 0,
        height: 0,
        status: "ready".to_string(),
        error: None,
      },
      _ => InputFile {
        path: path.clone(),
        name: Path::new(path)
          .file_name()
          .map(|name| name.to_string_lossy().into_owned())
          .unwrap_or_else(|| path.clone()),
        extension: Path::new(path)
          .extension()
          .map(|extension| extension.to_string_lossy().to_lowercase())
          .unwrap_or_default(),
        size: 0,
        width: 0,
        height: 0,
        status: "invalid".to_string(),
        error: Some("File not found".to_string()),
      },
    })
    .collect()
}
