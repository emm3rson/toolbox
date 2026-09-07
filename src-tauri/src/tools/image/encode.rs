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
      img
        .write_to(&mut Cursor::new(&mut buffer), image::ImageFormat::Png)
        .map_err(|error| {
          ProcessingError::encode_failed(format!("Could not encode PNG: {error}"))
        })?;
      Ok(buffer)
    }
    ImageFormat::Jpeg => {
      let quality = quality.unwrap_or(82).clamp(1, 100);
      let flattened = flatten_onto_white(img);
      let mut buffer = Vec::new();
      let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buffer, quality);
      flattened.write_with_encoder(encoder).map_err(|error| {
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
fn flatten_onto_white(img: &DynamicImage) -> DynamicImage {
  if img.color().has_alpha() {
    let rgba = img.to_rgba8();
    let mut rgb = image::RgbImage::new(rgba.width(), rgba.height());
    for (x, y, pixel) in rgba.enumerate_pixels() {
      let a = pixel[3] as f32 / 255.0;
      let r = ((pixel[0] as f32 * a) + (255.0 * (1.0 - a))).round() as u8;
      let g = ((pixel[1] as f32 * a) + (255.0 * (1.0 - a))).round() as u8;
      let b = ((pixel[2] as f32 * a) + (255.0 * (1.0 - a))).round() as u8;
      rgb.put_pixel(x, y, image::Rgb([r, g, b]));
    }
    DynamicImage::ImageRgb8(rgb)
  } else {
    img.clone()
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use image::{DynamicImage, GenericImageView, Rgba, RgbaImage};

  #[test]
  fn encodes_png_and_preserves_alpha() {
    let img = DynamicImage::ImageRgba8(RgbaImage::from_pixel(10, 10, Rgba([255, 0, 0, 128])));
    let bytes = encode(&img, ImageFormat::Png, None).unwrap();
    let decoded = image::ImageReader::new(std::io::Cursor::new(bytes))
      .with_guessed_format()
      .unwrap()
      .decode()
      .unwrap();
    assert_eq!(decoded.dimensions(), (10, 10));
    assert!(decoded.color().has_alpha());
  }

  #[test]
  fn encodes_jpeg_with_white_flattened_background() {
    // 10x10 transparent image with half-red pixel
    let img = DynamicImage::ImageRgba8(RgbaImage::from_pixel(10, 10, Rgba([0, 0, 0, 0])));
    let bytes = encode(&img, ImageFormat::Jpeg, Some(90)).unwrap();
    let decoded = image::ImageReader::new(std::io::Cursor::new(bytes))
      .with_guessed_format()
      .unwrap()
      .decode()
      .unwrap();
    assert_eq!(decoded.dimensions(), (10, 10));
    // Sample pixel from transparent area - should be close to white (allow minor JPEG lossy deviation)
    let rgb = decoded.to_rgb8();
    let pixel = rgb.get_pixel(5, 5);
    assert!(pixel[0] >= 250, "Red channel was {}", pixel[0]);
    assert!(pixel[1] >= 250, "Green channel was {}", pixel[1]);
    assert!(pixel[2] >= 250, "Blue channel was {}", pixel[2]);
  }
}
