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
  #[error("{message}")]
  InvalidPdf { message: String },
  #[error("{message}")]
  InvalidVideo { message: String },
  #[error("{message}")]
  VideoEngineUnavailable { message: String },
  #[error("{message}")]
  PdfEngineUnavailable { message: String },
  #[error("{message}")]
  EncryptedPdf { message: String },
  #[error("{message}")]
  OcrRequired { message: String },
  #[error("{message}")]
  LimitExceeded { message: String },
}

impl ProcessingError {
  pub fn unsupported_format(message: impl Into<String>) -> Self {
    Self::UnsupportedFormat {
      message: message.into(),
    }
  }
  pub fn invalid_image(message: impl Into<String>) -> Self {
    Self::InvalidImage {
      message: message.into(),
    }
  }
  pub fn invalid_dimensions(message: impl Into<String>) -> Self {
    Self::InvalidDimensions {
      message: message.into(),
    }
  }
  pub fn file_not_found(message: impl Into<String>) -> Self {
    Self::FileNotFound {
      message: message.into(),
    }
  }
  pub fn permission_denied(message: impl Into<String>) -> Self {
    Self::PermissionDenied {
      message: message.into(),
    }
  }
  pub fn output_unavailable(message: impl Into<String>) -> Self {
    Self::OutputUnavailable {
      message: message.into(),
    }
  }
  pub fn encode_failed(message: impl Into<String>) -> Self {
    Self::EncodeFailed {
      message: message.into(),
    }
  }
  pub fn decode_failed(message: impl Into<String>) -> Self {
    Self::DecodeFailed {
      message: message.into(),
    }
  }
  pub fn write_failed(message: impl Into<String>) -> Self {
    Self::WriteFailed {
      message: message.into(),
    }
  }
  pub fn processing_failed(message: impl Into<String>) -> Self {
    Self::ProcessingFailed {
      message: message.into(),
    }
  }
  pub fn invalid_pdf(message: impl Into<String>) -> Self {
    Self::InvalidPdf {
      message: message.into(),
    }
  }
  pub fn invalid_video(message: impl Into<String>) -> Self {
    Self::InvalidVideo {
      message: message.into(),
    }
  }
  pub fn video_engine_unavailable(message: impl Into<String>) -> Self {
    Self::VideoEngineUnavailable {
      message: message.into(),
    }
  }
  pub fn pdf_engine_unavailable(message: impl Into<String>) -> Self {
    Self::PdfEngineUnavailable {
      message: message.into(),
    }
  }
  pub fn encrypted_pdf(message: impl Into<String>) -> Self {
    Self::EncryptedPdf {
      message: message.into(),
    }
  }
  pub fn ocr_required(message: impl Into<String>) -> Self {
    Self::OcrRequired {
      message: message.into(),
    }
  }
  pub fn limit_exceeded(message: impl Into<String>) -> Self {
    Self::LimitExceeded {
      message: message.into(),
    }
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
      Self::InvalidPdf { message } => ("INVALID_PDF", message),
      Self::InvalidVideo { message } => ("INVALID_VIDEO", message),
      Self::VideoEngineUnavailable { message } => ("VIDEO_ENGINE_UNAVAILABLE", message),
      Self::PdfEngineUnavailable { message } => ("PDF_ENGINE_UNAVAILABLE", message),
      Self::EncryptedPdf { message } => ("ENCRYPTED_PDF", message),
      Self::OcrRequired { message } => ("OCR_REQUIRED", message),
      Self::LimitExceeded { message } => ("LIMIT_EXCEEDED", message),
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

  /// Pseudo-error for a file killed mid-processing by batch cancellation.
  /// There is no `ProcessingError` variant because cancellation is not a
  /// processing failure; it is reported directly as a DTO.
  pub fn canceled() -> Self {
    Self {
      code: "CANCELED".into(),
      message: "Processing canceled".into(),
      detail: None,
    }
  }
}

impl From<ProcessingError> for ProcessingErrorDto {
  fn from(error: ProcessingError) -> Self {
    error.into_dto()
  }
}

#[cfg(test)]
mod tests {
  use super::ProcessingError;

  #[test]
  fn all_variants_map_to_stable_codes() {
    let cases = [
      (
        ProcessingError::unsupported_format("x"),
        "UNSUPPORTED_FORMAT",
      ),
      (ProcessingError::invalid_image("x"), "INVALID_IMAGE"),
      (
        ProcessingError::invalid_dimensions("x"),
        "INVALID_DIMENSIONS",
      ),
      (ProcessingError::file_not_found("x"), "FILE_NOT_FOUND"),
      (ProcessingError::permission_denied("x"), "PERMISSION_DENIED"),
      (
        ProcessingError::output_unavailable("x"),
        "OUTPUT_UNAVAILABLE",
      ),
      (ProcessingError::encode_failed("x"), "ENCODE_FAILED"),
      (ProcessingError::decode_failed("x"), "DECODE_FAILED"),
      (ProcessingError::write_failed("x"), "WRITE_FAILED"),
      (ProcessingError::processing_failed("x"), "PROCESSING_FAILED"),
      (ProcessingError::invalid_pdf("x"), "INVALID_PDF"),
      (ProcessingError::invalid_video("x"), "INVALID_VIDEO"),
      (
        ProcessingError::video_engine_unavailable("x"),
        "VIDEO_ENGINE_UNAVAILABLE",
      ),
      (
        ProcessingError::pdf_engine_unavailable("x"),
        "PDF_ENGINE_UNAVAILABLE",
      ),
      (ProcessingError::encrypted_pdf("x"), "ENCRYPTED_PDF"),
      (ProcessingError::ocr_required("x"), "OCR_REQUIRED"),
      (ProcessingError::limit_exceeded("x"), "LIMIT_EXCEEDED"),
    ];
    for (error, expected_code) in cases {
      let dto = error.into_dto();
      assert_eq!(dto.code, expected_code);
      assert!(!dto.message.is_empty());
      assert_eq!(dto.detail, None);
    }
  }

  #[test]
  fn canceled_is_a_direct_dto_pseudo_code() {
    let dto = super::ProcessingErrorDto::canceled();
    assert_eq!(dto.code, "CANCELED");
    assert_eq!(dto.message, "Processing canceled");
    assert_eq!(dto.detail, None);
  }
}
