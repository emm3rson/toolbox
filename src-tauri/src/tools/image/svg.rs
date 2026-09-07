use std::path::Path;
use std::sync::{Arc, LazyLock};

use image::DynamicImage;
use resvg::tiny_skia;
use resvg::usvg;

use super::{MAX_DIMENSION, MAX_PIXELS};
use crate::errors::ProcessingError;

/// Process-wide font database initialized with system fonts once.
/// Thread-safe (`fontdb::Database` is `Send + Sync`).
static FONT_DB: LazyLock<Arc<fontdb::Database>> = LazyLock::new(|| {
  let mut db = fontdb::Database::new();
  db.load_system_fonts();
  Arc::new(db)
});

fn default_options() -> usvg::Options<'static> {
  usvg::Options {
    fontdb: Arc::clone(&FONT_DB),
    resources_dir: None,
    ..Default::default()
  }
}

/// Checks that requested width/height are within safe memory bounds.
pub(crate) fn check_size(width: u32, height: u32) -> Result<(), ProcessingError> {
  if width == 0 || height == 0 {
    return Err(ProcessingError::invalid_image(
      "SVG dimensions must be greater than zero",
    ));
  }
  if width > MAX_DIMENSION
    || height > MAX_DIMENSION
    || u64::from(width) * u64::from(height) > MAX_PIXELS
  {
    return Err(ProcessingError::invalid_image(format!(
      "Image too large: {width} × {height}"
    )));
  }
  Ok(())
}

/// Parses raw SVG bytes into a `usvg::Tree`.
pub(crate) fn parse(bytes: &[u8]) -> Result<usvg::Tree, ProcessingError> {
  let opts = default_options();
  usvg::Tree::from_data(bytes, &opts)
    .map_err(|error| ProcessingError::invalid_image(format!("Could not parse SVG: {error}")))
}

/// Reads an SVG file from disk and parses it into a `usvg::Tree`.
pub(crate) fn read_and_parse(path: &Path) -> Result<usvg::Tree, ProcessingError> {
  let bytes = std::fs::read(path).map_err(|error| {
    if error.kind() == std::io::ErrorKind::PermissionDenied {
      ProcessingError::permission_denied(format!(
        "Permission denied reading '{}': {error}",
        path.display()
      ))
    } else if error.kind() == std::io::ErrorKind::NotFound {
      ProcessingError::file_not_found(format!(
        "Could not read source file '{}': {error}",
        path.display()
      ))
    } else {
      ProcessingError::invalid_image(format!(
        "Could not read SVG file '{}': {error}",
        path.display()
      ))
    }
  })?;

  parse(&bytes)
}

/// Returns the intrinsic `(width, height)` in pixels from the SVG tree.
pub(crate) fn intrinsic_size(tree: &usvg::Tree) -> (u32, u32) {
  let size = tree.size();
  let width = (size.width().ceil() as u32).max(1);
  let height = (size.height().ceil() as u32).max(1);
  (width, height)
}

/// Converts tiny_skia Pixmap bytes to an `image::DynamicImage`.
/// tiny_skia renders premultiplied RGBA pixels. We demultiply to straight RGBA
/// so standard image encoders (PNG, WebP, JPEG) receive correct colors without dark halos.
fn pixmap_to_dynamic_image(
  pixmap: tiny_skia::Pixmap,
  width: u32,
  height: u32,
) -> Result<DynamicImage, ProcessingError> {
  let mut data = pixmap.take();
  // Demultiply in place: tiny_skia stores [r, g, b, a] where r, g, b <= a
  for chunk in data.chunks_exact_mut(4) {
    let alpha = chunk[3];
    if alpha > 0 && alpha < 255 {
      let a_f = alpha as f32 / 255.0;
      chunk[0] = ((chunk[0] as f32 / a_f).round() as u32).min(255) as u8;
      chunk[1] = ((chunk[1] as f32 / a_f).round() as u32).min(255) as u8;
      chunk[2] = ((chunk[2] as f32 / a_f).round() as u32).min(255) as u8;
    }
  }

  let img = image::RgbaImage::from_raw(width, height, data).ok_or_else(|| {
    ProcessingError::invalid_image("Invalid decoded SVG pixel buffer".to_string())
  })?;
  Ok(DynamicImage::ImageRgba8(img))
}

/// Renders an SVG tree scaled to exact target dimensions.
pub(crate) fn render(
  tree: &usvg::Tree,
  width: u32,
  height: u32,
) -> Result<DynamicImage, ProcessingError> {
  check_size(width, height)?;
  let (iw, ih) = (tree.size().width(), tree.size().height());
  if iw <= 0.0 || ih <= 0.0 {
    return Err(ProcessingError::invalid_image("SVG has invalid dimensions"));
  }

  let mut pixmap = tiny_skia::Pixmap::new(width, height).ok_or_else(|| {
    ProcessingError::invalid_image(format!(
      "Failed to allocate {width} × {height} render buffer"
    ))
  })?;

  let transform = tiny_skia::Transform::from_scale(width as f32 / iw, height as f32 / ih);
  resvg::render(tree, transform, &mut pixmap.as_mut());

  pixmap_to_dynamic_image(pixmap, width, height)
}

/// Renders an SVG tree fitted and centered inside a square `size × size` canvas,
/// preserving aspect ratio with transparent padding around non-square vectors.
pub(crate) fn render_fitted_square(
  tree: &usvg::Tree,
  size: u32,
) -> Result<DynamicImage, ProcessingError> {
  check_size(size, size)?;
  let (iw, ih) = (tree.size().width(), tree.size().height());
  if iw <= 0.0 || ih <= 0.0 {
    return Err(ProcessingError::invalid_image("SVG has invalid dimensions"));
  }

  let mut pixmap = tiny_skia::Pixmap::new(size, size).ok_or_else(|| {
    ProcessingError::invalid_image(format!("Failed to allocate {size} × {size} render buffer"))
  })?;

  let scale = (size as f32 / iw).min(size as f32 / ih);
  let rendered_w = (iw * scale).round();
  let rendered_h = (ih * scale).round();
  let dx = ((size as f32 - rendered_w) / 2.0).round();
  let dy = ((size as f32 - rendered_h) / 2.0).round();

  let transform = tiny_skia::Transform::from_row(scale, 0.0, 0.0, scale, dx, dy);
  resvg::render(tree, transform, &mut pixmap.as_mut());

  pixmap_to_dynamic_image(pixmap, size, size)
}

#[cfg(test)]
mod tests {
  use super::*;
  use image::GenericImageView;

  const SIMPLE_RECT_SVG: &[u8] =
    br##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect width="100" height="100" fill="#ff0000" />
  </svg>"##;

  const WIDE_RECT_SVG: &[u8] = br##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">
    <rect width="200" height="100" fill="#00ff00" />
  </svg>"##;

  const NO_VIEWBOX_SVG: &[u8] = br##"<svg xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="40" fill="#0000ff" />
  </svg>"##;

  const EMPTY_SVG: &[u8] = br##"<svg xmlns="http://www.w3.org/2000/svg"></svg>"##;

  #[test]
  fn parses_valid_svg_and_computes_intrinsic_size() {
    let tree = parse(SIMPLE_RECT_SVG).unwrap();
    let (w, h) = intrinsic_size(&tree);
    assert_eq!((w, h), (100, 100));

    let wide = parse(WIDE_RECT_SVG).unwrap();
    assert_eq!(intrinsic_size(&wide), (200, 100));

    let no_viewbox = parse(NO_VIEWBOX_SVG).unwrap();
    // usvg calculates bounding box of contents (cx=50, cy=50, r=40 -> max x,y=90)
    assert_eq!(intrinsic_size(&no_viewbox), (90, 90));

    let empty = parse(EMPTY_SVG).unwrap();
    // Default fallback in usvg is 100x100
    assert_eq!(intrinsic_size(&empty), (100, 100));
  }

  #[test]
  fn malformed_svg_returns_invalid_image() {
    let result = parse(b"<svg>not closed");
    assert!(result.is_err());
    assert!(matches!(
      result.unwrap_err(),
      ProcessingError::InvalidImage { .. }
    ));
  }

  #[test]
  fn renders_svg_to_exact_dimensions() {
    let tree = parse(SIMPLE_RECT_SVG).unwrap();
    let img = render(&tree, 64, 64).unwrap();
    assert_eq!(img.dimensions(), (64, 64));

    // Sample a center pixel — should be red (#ff0000)
    let rgba = img.to_rgba8();
    let pixel = rgba.get_pixel(32, 32);
    assert_eq!(pixel[0], 255);
    assert_eq!(pixel[1], 0);
    assert_eq!(pixel[2], 0);
    assert_eq!(pixel[3], 255);
  }

  #[test]
  fn render_fitted_square_centers_wide_svg_with_transparent_padding() {
    let tree = parse(WIDE_RECT_SVG).unwrap();
    let img = render_fitted_square(&tree, 100).unwrap();
    assert_eq!(img.dimensions(), (100, 100));

    let rgba = img.to_rgba8();
    // Center pixel should be green
    let center = rgba.get_pixel(50, 50);
    assert_eq!(center[1], 255);
    assert_eq!(center[3], 255);

    // Top padding pixel (e.g. at y=5, x=50) should be transparent
    let top_pad = rgba.get_pixel(50, 5);
    assert_eq!(top_pad[3], 0, "Top padding should be transparent");

    // Bottom padding pixel (e.g. at y=95, x=50) should be transparent
    let bottom_pad = rgba.get_pixel(50, 95);
    assert_eq!(bottom_pad[3], 0, "Bottom padding should be transparent");
  }

  #[test]
  fn oversized_render_target_is_rejected() {
    let tree = parse(SIMPLE_RECT_SVG).unwrap();
    let err = render(&tree, 20_000, 20_000).unwrap_err();
    assert!(matches!(err, ProcessingError::InvalidImage { .. }));
  }
}
