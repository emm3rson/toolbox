use std::io::BufReader;
use std::path::Path;

use image::DynamicImage;

use crate::errors::ProcessingError;
use crate::models::ImageFormat;

/// Decodes an image file into a `DynamicImage`.
///
/// WebP uses `image_webp::WebPDecoder` because `image`'s built-in WebP
/// decoder is lossless-only. PNG/JPEG decode through `image::ImageReader`.
pub fn decode(source: &Path) -> Result<DynamicImage, ProcessingError> {
  let mut reader = image::ImageReader::open(source).map_err(|error| {
    ProcessingError::decode_failed(format!("Could not open '{}': {error}", source.display()))
  })?;
  reader = reader.with_guessed_format().map_err(|error| {
    ProcessingError::unsupported_format(format!(
      "Unrecognized image format in '{}': {error}",
      source.display()
    ))
  })?;

  match reader.format() {
    Some(image::ImageFormat::WebP) => {
      let file = std::fs::File::open(source).map_err(|error| {
        ProcessingError::decode_failed(format!(
          "Could not open WebP '{}': {error}",
          source.display()
        ))
      })?;
      let mut decoder = image_webp::WebPDecoder::new(BufReader::new(file)).map_err(|error| {
        ProcessingError::decode_failed(format!(
          "Could not decode WebP '{}': {error}",
          source.display()
        ))
      })?;
      let (width, height) = decoder.dimensions();
      let size = decoder.output_buffer_size().ok_or_else(|| {
        ProcessingError::invalid_image(format!("Image too large: {}", source.display()))
      })?;
      let mut buffer = vec![0u8; size];
      decoder.read_image(&mut buffer).map_err(|error| {
        ProcessingError::decode_failed(format!(
          "Could not decode WebP '{}': {error}",
          source.display()
        ))
      })?;
      if decoder.has_alpha() {
        image::RgbaImage::from_raw(width, height, buffer)
          .map(DynamicImage::ImageRgba8)
          .ok_or_else(|| {
            ProcessingError::invalid_image(format!("Decoded pixels invalid: {}", source.display()))
          })
      } else {
        image::RgbImage::from_raw(width, height, buffer)
          .map(DynamicImage::ImageRgb8)
          .ok_or_else(|| {
            ProcessingError::invalid_image(format!("Decoded pixels invalid: {}", source.display()))
          })
      }
    }
    Some(image::ImageFormat::Png) | Some(image::ImageFormat::Jpeg) => {
      reader.decode().map_err(|error| {
        ProcessingError::decode_failed(format!(
          "Could not decode '{}': {error}",
          source.display()
        ))
      })
    }
    _ => Err(ProcessingError::unsupported_format(format!(
      "Unsupported format for '{}'",
      source.display()
    ))),
  }
}

/// Detects the image format of a file from its header.
pub fn detect_format(source: &Path) -> Result<ImageFormat, ProcessingError> {
  let mut reader = image::ImageReader::open(source).map_err(|error| {
    ProcessingError::decode_failed(format!("Could not open '{}': {error}", source.display()))
  })?;
  reader = reader.with_guessed_format().map_err(|error| {
    ProcessingError::unsupported_format(format!(
      "Unrecognized image format in '{}': {error}",
      source.display()
    ))
  })?;

  match reader.format() {
    Some(image::ImageFormat::Png) => Ok(ImageFormat::Png),
    Some(image::ImageFormat::Jpeg) => Ok(ImageFormat::Jpeg),
    Some(image::ImageFormat::WebP) => Ok(ImageFormat::Webp),
    _ => Err(ProcessingError::unsupported_format(format!(
      "Unsupported format for '{}'",
      source.display()
    ))),
  }
}
