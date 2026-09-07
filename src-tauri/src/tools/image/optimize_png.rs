use crate::errors::ProcessingError;
use crate::models::PngOptimizationLevel;

use super::MAX_PIXELS;

/// Optimizes PNG bytes losslessly with oxipng.
///
/// Metadata chunks are preserved (oxipng default `strip: None`), APNG frames
/// are recompressed in place, and the result is never larger than the input
/// (oxipng returns the original bytes when no improvement is found). A
/// decompression-size guard keeps memory bounded on the direct path, which
/// bypasses `decode::check_size`.
pub fn optimize(data: &[u8], level: PngOptimizationLevel) -> Result<Vec<u8>, ProcessingError> {
  let mut options = oxipng::Options::from_preset(level.preset());
  options.max_decompressed_size = Some(MAX_PIXELS as usize * 4);
  oxipng::optimize_from_memory(data, &options)
    .map_err(|error| ProcessingError::encode_failed(format!("PNG optimization failed: {error}")))
}

#[cfg(test)]
mod tests {
  use image::GenericImageView;

  use super::optimize;
  use crate::models::PngOptimizationLevel;
  use crate::tools::image::test_util::naive_rgb_png;

  #[test]
  fn naive_png_is_smaller_and_pixel_lossless() {
    let naive = naive_rgb_png(64, 64);
    for level in [
      PngOptimizationLevel::Fast,
      PngOptimizationLevel::Balanced,
      PngOptimizationLevel::Max,
    ] {
      let optimized = optimize(&naive, level).unwrap();
      assert!(
        optimized.len() < naive.len(),
        "expected smaller output at level {:?}, got {} >= {}",
        level,
        optimized.len(),
        naive.len()
      );
      let before = image::load_from_memory(&naive).unwrap();
      let after = image::load_from_memory(&optimized).unwrap();
      assert_eq!(before.dimensions(), after.dimensions());
      assert_eq!(
        before.to_rgba8().into_raw(),
        after.to_rgba8().into_raw(),
        "optimization must not change pixels at level {:?}",
        level
      );
    }
  }

  #[test]
  fn reoptimizing_never_grows_the_file() {
    let naive = naive_rgb_png(16, 16);
    let once = optimize(&naive, PngOptimizationLevel::Balanced).unwrap();
    let twice = optimize(&once, PngOptimizationLevel::Balanced).unwrap();
    assert!(
      twice.len() <= once.len(),
      "second pass grew the file: {} > {}",
      twice.len(),
      once.len()
    );
  }

  #[test]
  fn garbage_input_fails_without_panicking() {
    let err = optimize(b"definitely not a png", PngOptimizationLevel::Balanced).unwrap_err();
    assert!(matches!(
      err,
      crate::errors::ProcessingError::EncodeFailed { .. }
    ));
  }
}
