use serde::{Deserialize, Serialize};

use crate::errors::ProcessingErrorDto;

#[derive(Debug, Clone, Copy, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ImageFormat {
  Png,
  Jpeg,
  Webp,
}

impl ImageFormat {
  pub fn extension(&self) -> &'static str {
    match self {
      ImageFormat::Png => "png",
      ImageFormat::Jpeg => "jpg",
      ImageFormat::Webp => "webp",
    }
  }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConvertImagesRequest {
  pub files: Vec<String>,
  pub output_directory: String,
  pub output_format: ImageFormat,
  pub quality: Option<u8>,
  pub resize: ResizeOptions,
  pub job_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompressImagesRequest {
  pub files: Vec<String>,
  pub output_directory: String,
  pub quality: u8,
  pub resize: ResizeOptions,
  pub job_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateLogoPackRequest {
  pub source_path: String,
  pub output_directory: String,
  pub asset_ids: Vec<String>,
  pub job_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogoAssetDefinition {
  pub id: String,
  pub filename: String,
  pub width: u32,
  pub height: u32,
  pub format: String,
  pub default_enabled: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateLogoPackResult {
  pub pack_directory: String,
  pub batch: BatchResult,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "mode", rename_all = "camelCase")]
pub enum ResizeOptions {
  Original,
  Dimensions {
    width: u32,
    height: u32,
    #[allow(dead_code)]
    lock_aspect_ratio: bool,
  },
  Percentage {
    percentage: u32,
  },
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InputFile {
  pub path: String,
  pub name: String,
  pub extension: String,
  pub size: u64,
  pub width: u32,
  pub height: u32,
  pub status: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileResult {
  pub source_path: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub output_path: Option<String>,
  pub success: bool,
  pub original_size: u64,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub output_size: Option<u64>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub error: Option<ProcessingErrorDto>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchResult {
  pub total: u32,
  pub succeeded: u32,
  pub failed: u32,
  pub items: Vec<FileResult>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessingProgress {
  pub job_id: String,
  pub completed: u32,
  pub total: u32,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub current_file: Option<String>,
}
