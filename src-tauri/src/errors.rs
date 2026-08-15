use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum ProcessingError {
  #[error("{message}")]
  UnsupportedFormat { message: String },
  #[error("{message}")]
  InvalidImage { message: String },
  #[error("{message}")]
  InvalidDimensions { message: String },
  #[error("{message}")]
  FileNotFound { message: String },
  #[error("{message}")]
  PermissionDenied { message: String },
  #[error("{message}")]
  OutputUnavailable { message: String },
  #[error("{message}")]
  EncodeFailed { message: String },
  #[error("{message}")]
  DecodeFailed { message: String },
  #[error("{message}")]
  WriteFailed { message: String },
  #[error("{message}")]
  ProcessingFailed { message: String },
}

impl ProcessingError {
  pub fn unsupported_format(message: impl Into<String>) -> Self {
    Self::UnsupportedFormat { message: message.into() }
  }
  pub fn invalid_image(message: impl Into<String>) -> Self {
    Self::InvalidImage { message: message.into() }
  }
  pub fn invalid_dimensions(message: impl Into<String>) -> Self {
    Self::InvalidDimensions { message: message.into() }
  }
  pub fn file_not_found(message: impl Into<String>) -> Self {
    Self::FileNotFound { message: message.into() }
  }
  pub fn permission_denied(message: impl Into<String>) -> Self {
    Self::PermissionDenied { message: message.into() }
  }
  pub fn output_unavailable(message: impl Into<String>) -> Self {
    Self::OutputUnavailable { message: message.into() }
  }
  pub fn encode_failed(message: impl Into<String>) -> Self {
    Self::EncodeFailed { message: message.into() }
  }
  pub fn decode_failed(message: impl Into<String>) -> Self {
    Self::DecodeFailed { message: message.into() }
  }
  pub fn write_failed(message: impl Into<String>) -> Self {
    Self::WriteFailed { message: message.into() }
  }
  pub fn processing_failed(message: impl Into<String>) -> Self {
    Self::ProcessingFailed { message: message.into() }
  }

  pub fn into_dto(self) -> ProcessingErrorDto {
    let (code, message) = match self {
      Self::UnsupportedFormat { message } => ("UNSUPPORTED_FORMAT", message),
      Self::InvalidImage { message } => ("INVALID_IMAGE", message),
      Self::InvalidDimensions { message } => ("INVALID_DIMENSIONS", message),
      Self::FileNotFound { message } => ("FILE_NOT_FOUND", message),
      Self::PermissionDenied { message } => ("PERMISSION_DENIED", message),
      Self::OutputUnavailable { message } => ("OUTPUT_UNAVAILABLE", message),
      Self::EncodeFailed { message } => ("ENCODE_FAILED", message),
      Self::DecodeFailed { message } => ("DECODE_FAILED", message),
      Self::WriteFailed { message } => ("WRITE_FAILED", message),
      Self::ProcessingFailed { message } => ("PROCESSING_FAILED", message),
    };
    ProcessingErrorDto {
      code: code.into(),
      message,
      detail: None,
    }
  }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessingErrorDto {
  pub code: String,
  pub message: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub detail: Option<String>,
}

impl ProcessingErrorDto {
  pub fn processing_failed(message: impl Into<String>) -> Self {
    Self {
      code: "PROCESSING_FAILED".into(),
      message: message.into(),
      detail: None,
    }
  }
}

impl From<ProcessingError> for ProcessingErrorDto {
  fn from(error: ProcessingError) -> Self {
    error.into_dto()
  }
}
