use std::path::PathBuf;

use tauri::Emitter;

use crate::errors::ProcessingErrorDto;
use crate::models::{
  BatchResult, CompressImagesRequest, ConvertImagesRequest, GenerateLogoPackRequest,
  GenerateLogoPackResult, InputFile, LogoAssetDefinition, ProcessingProgress,
};
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
    let progress_job_id = job_id.clone();
    services::batch::run_batch(
      &files,
      |source| tools::image::convert::convert_file(source, &output_dir, format, quality, &resize),
      move |completed, total, filename| {
        let _ = app.emit(
          services::batch::EVENT_PROGRESS,
          ProcessingProgress {
            job_id: progress_job_id.clone(),
            completed,
            total,
            current_file: Some(filename.to_string()),
          },
        );
      },
    )
  })
  .await
  .map_err(|error| ProcessingErrorDto::processing_failed(format!("Processing task failed: {error}")))?
  .map_err(ProcessingErrorDto::from)
}

#[tauri::command]
pub async fn compress_images(
  app: tauri::AppHandle,
  request: CompressImagesRequest,
) -> Result<BatchResult, ProcessingErrorDto> {
  let output_dir = PathBuf::from(&request.output_directory);
  services::export::ensure_output_dir(&output_dir)?;

  let job_id = request.job_id.clone();
  let files: Vec<PathBuf> = request.files.iter().map(PathBuf::from).collect();
  let quality = request.quality;
  let resize = request.resize;

  tauri::async_runtime::spawn_blocking(move || {
    let progress_job_id = job_id.clone();
    services::batch::run_batch(
      &files,
      |source| tools::image::compress::compress_file(source, &output_dir, quality, &resize),
      move |completed, total, filename| {
        let _ = app.emit(
          services::batch::EVENT_PROGRESS,
          ProcessingProgress {
            job_id: progress_job_id.clone(),
            completed,
            total,
            current_file: Some(filename.to_string()),
          },
        );
      },
    )
  })
  .await
  .map_err(|error| ProcessingErrorDto::processing_failed(format!("Processing task failed: {error}")))?
  .map_err(ProcessingErrorDto::from)
}

#[tauri::command]
pub async fn generate_logo_pack(
  app: tauri::AppHandle,
  request: GenerateLogoPackRequest,
) -> Result<GenerateLogoPackResult, ProcessingErrorDto> {
  let source = PathBuf::from(&request.source_path);
  let output_dir = PathBuf::from(&request.output_directory);
  let job_id = request.job_id.clone();
  let asset_ids = request.asset_ids;

  tauri::async_runtime::spawn_blocking(move || {
    tools::image::logo_pack::generate(&source, &output_dir, &asset_ids, |completed, total, filename| {
      let _ = app.emit(
        services::batch::EVENT_PROGRESS,
        ProcessingProgress {
          job_id: job_id.clone(),
          completed,
          total,
          current_file: Some(filename.to_string()),
        },
      );
    })
  })
  .await
  .map_err(|error| ProcessingErrorDto::processing_failed(format!("Processing task failed: {error}")))?
  .map(|(pack_dir, batch)| GenerateLogoPackResult {
    pack_directory: pack_dir.to_string_lossy().into_owned(),
    batch,
  })
  .map_err(ProcessingErrorDto::from)
}

#[tauri::command]
pub fn get_logo_presets() -> Vec<LogoAssetDefinition> {
  tools::image::logo_pack::STANDARD_WEB_PACK.to_vec()
}
