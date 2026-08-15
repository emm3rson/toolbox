use std::io::{BufReader, Cursor};
use std::path::Path;

use image::DynamicImage;

use crate::errors::ProcessingError;
use crate::models::{FileResult, ImageFormat, ResizeOptions};
use crate::services::export;

use super::{resize, webp};

/// Converts one source image into `format`, applying the optional resize, and
/// writes it to `output_dir`. Always returns a `FileResult` — failures are
/// captured, never panicked.
pub fn convert_file(
  source: &Path,
  output_dir: &Path,
  format: ImageFormat,
  quality: Option<u8>,
  resize_opts: &ResizeOptions,
) -> FileResult {
  let source_string = source.to_string_lossy().into_owned();
  match convert_file_inner(source, output_dir, format, quality, resize_opts) {
    Ok((output_path, original_size, output_size)) => FileResult {
      source_path: source_string,
      output_path: Some(output_path),
      success: true,
      original_size,
      output_size: Some(output_size),
      error: None,
    },
    Err(error) => FileResult {
      source_path: source_string,
      output_path: None,
      success: false,
      original_size: std::fs::metadata(source).map(|meta| meta.len()).unwrap_or(0),
      output_size: None,
      error: Some(error.into_dto()),
    },
  }
}

fn convert_file_inner(
  source: &Path,
  output_dir: &Path,
  format: ImageFormat,
  quality: Option<u8>,
  resize_opts: &ResizeOptions,
) -> Result<(String, u64, u64), ProcessingError> {
  let original_size = std::fs::metadata(source).map_err(|error| {
    if error.kind() == std::io::ErrorKind::PermissionDenied {
      ProcessingError::permission_denied(format!(
        "Permission denied reading '{}': {error}",
        source.display()
      ))
    } else {
      ProcessingError::file_not_found(format!(
        "Could not read source file '{}': {error}",
        source.display()
      ))
    }
  })?.len();

  let img = decode(source)?;
  let img = resize::apply(&img, resize_opts)?;
  let bytes = encode(&img, format, quality)?;

  let output_path = export::resolve_output_path(output_dir, source, format.extension())?;
  std::fs::write(&output_path, &bytes).map_err(|error| {
    if error.kind() == std::io::ErrorKind::PermissionDenied {
      ProcessingError::permission_denied(format!(
        "Permission denied writing '{}': {error}",
        output_path.display()
      ))
    } else {
      ProcessingError::write_failed(format!(
        "Could not write output file '{}': {error}",
        output_path.display()
      ))
    }
  })?;

  Ok((
    output_path.to_string_lossy().into_owned(),
    original_size,
    bytes.len() as u64,
  ))
}

fn decode(source: &Path) -> Result<DynamicImage, ProcessingError> {
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
          .ok_or_else(|| ProcessingError::invalid_image(format!("Decoded pixels invalid: {}", source.display())))
      } else {
        image::RgbImage::from_raw(width, height, buffer)
          .map(DynamicImage::ImageRgb8)
          .ok_or_else(|| ProcessingError::invalid_image(format!("Decoded pixels invalid: {}", source.display())))
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

fn encode(
  img: &DynamicImage,
  format: ImageFormat,
  quality: Option<u8>,
) -> Result<Vec<u8>, ProcessingError> {
  match format {
    ImageFormat::Png => {
      let mut buffer = Vec::new();
      img.write_to(&mut Cursor::new(&mut buffer), image::ImageFormat::Png)
        .map_err(|error| {
          ProcessingError::encode_failed(format!("Could not encode PNG: {error}"))
        })?;
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

#[cfg(test)]
mod tests {
  use std::sync::atomic::{AtomicU32, Ordering};

  use super::convert_file;
  use crate::models::{ImageFormat, ResizeOptions};

  static COUNTER: AtomicU32 = AtomicU32::new(0);

  fn temp_dir() -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!(
      "toolbox-convert-test-{}-{}",
      std::process::id(),
      COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    std::fs::create_dir_all(&dir).unwrap();
    dir
  }

  fn write_fixture_png(path: &std::path::Path, width: u32, height: u32) {
    let img = image::DynamicImage::ImageRgba8(image::RgbaImage::from_fn(width, height, |x, y| {
      image::Rgba([(x * 7) as u8, (y * 11) as u8, 120, 255])
    }));
    img.save(path).unwrap();
  }

  #[test]
  fn converts_png_to_jpeg_with_expected_name_and_sizes() {
    let dir = temp_dir();
    let source = dir.join("photo.png");
    write_fixture_png(&source, 32, 24);

    let result = convert_file(&source, &dir, ImageFormat::Jpeg, Some(80), &ResizeOptions::Original);
    assert!(result.success, "unexpected failure: {:?}", result.error);
    assert_eq!(result.original_size, std::fs::metadata(&source).unwrap().len());
    let output_path = result.output_path.unwrap();
    assert!(output_path.ends_with("photo.jpg"));
    assert!(std::path::Path::new(&output_path).exists());
    assert!(result.output_size.unwrap() > 0);
    std::fs::remove_dir_all(&dir).unwrap();
  }

  #[test]
  fn converts_to_webp_and_back() {
    let dir = temp_dir();
    let source = dir.join("photo.png");
    write_fixture_png(&source, 32, 24);

    let webp = convert_file(&source, &dir, ImageFormat::Webp, Some(75), &ResizeOptions::Original);
    assert!(webp.success, "unexpected failure: {:?}", webp.error);
    let webp_path = webp.output_path.unwrap();

    let roundtrip = convert_file(
      std::path::Path::new(&webp_path),
      &dir,
      ImageFormat::Png,
      None,
      &ResizeOptions::Original,
    );
    assert!(roundtrip.success, "unexpected failure: {:?}", roundtrip.error);
    let png_path = roundtrip.output_path.unwrap();
    let decoded = image::ImageReader::open(&png_path).unwrap().decode().unwrap();
    assert_eq!(decoded.width(), 32);
    assert_eq!(decoded.height(), 24);
    std::fs::remove_dir_all(&dir).unwrap();
  }

  #[test]
  fn percentage_resize_is_applied_to_output() {
    let dir = temp_dir();
    let source = dir.join("photo.png");
    write_fixture_png(&source, 40, 20);

    let result = convert_file(
      &source,
      &dir,
      ImageFormat::Webp,
      Some(80),
      &ResizeOptions::Percentage { percentage: 50 },
    );
    assert!(result.success, "unexpected failure: {:?}", result.error);
    let decoded =
      image_webp::WebPDecoder::new(std::io::BufReader::new(
        std::fs::File::open(result.output_path.unwrap()).unwrap(),
      ))
      .unwrap();
    assert_eq!(decoded.dimensions(), (20, 10));
    std::fs::remove_dir_all(&dir).unwrap();
  }
}
