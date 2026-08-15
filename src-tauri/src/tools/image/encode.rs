use std::io::Cursor;

use image::DynamicImage;

use crate::errors::ProcessingError;
use crate::models::ImageFormat;

use super::webp;

/// Encodes an image into the requested format.
///
/// PNG is lossless (quality ignored). JPEG uses `new_with_quality`; WebP uses
/// the libwebp lossy encoder. Both clamp `quality` to 1..=100.
pub fn encode(
  img: &DynamicImage,
  format: ImageFormat,
  quality: Option<u8>,
) -> Result<Vec<u8>, ProcessingError> {
  match format {
    ImageFormat::Png => {
      let mut buffer = Vec::new();
      img.write_to(&mut Cursor::new(&mut buffer), image::ImageFormat::Png)
        .map_err(|error| ProcessingError::encode_failed(format!("Could not encode PNG: {error}")))?;
      Ok(buffer)
    }
    ImageFormat::Jpeg => {
      let quality = quality.unwrap_or(82).clamp(1, 100);
      let mut buffer = Vec::new();
      let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buffer, quality);
      img.write_with_encoder(encoder).map_err(|error| {
        ProcessingError::encode_failed(format!("Could not encode JPEG: {error}"))
      })?;
      Ok(buffer)
    }
    ImageFormat::Webp => {
      let quality = quality.unwrap_or(82).clamp(1, 100);
      webp::encode_lossy(img, quality)
    }
  }
}
