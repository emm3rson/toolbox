use std::path::PathBuf;

use crate::errors::ProcessingErrorDto;
use crate::models::{BatchResult, ConvertImagesRequest, InputFile};
use crate::services;
use crate::tools;

#[tauri::command]
pub fn inspect_files(paths: Vec<String>) -> Vec<InputFile> {
  services::inspect::inspect_paths(paths)
}

#[tauri::command]
pub async fn convert_images(
  app: tauri::AppHandle,
  request: ConvertImagesRequest,
) -> Result<BatchResult, ProcessingErrorDto> {
  let output_dir = PathBuf::from(&request.output_directory);
  services::export::ensure_output_dir(&output_dir)?;

  let job_id = request.job_id.clone();
  let files: Vec<PathBuf> = request.files.iter().map(PathBuf::from).collect();
  let format = request.output_format;
  let quality = request.quality;
  let resize = request.resize;

  tauri::async_runtime::spawn_blocking(move || {
    services::batch::run_batch(&app, job_id, &files, |source| {
      tools::image::convert::convert_file(source, &output_dir, format, quality, &resize)
    })
  })
  .await
  .map_err(|error| ProcessingErrorDto::processing_failed(format!("Processing task failed: {error}")))?
  .map_err(ProcessingErrorDto::from)
}
