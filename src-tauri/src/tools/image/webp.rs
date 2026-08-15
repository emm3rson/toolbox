use std::os::raw::{c_float, c_int};

use image::DynamicImage;

use crate::errors::ProcessingError;

/// Encodes an image as lossy WebP via libwebp (C FFI).
///
/// `quality` is clamped to 1..=100. The compressed buffer returned by
/// `WebPEncodeRGBA` is copied into a `Vec` and released with `WebPFree`.
pub fn encode_lossy(img: &DynamicImage, quality: u8) -> Result<Vec<u8>, ProcessingError> {
  let rgba = img.to_rgba8();
  let width = rgba.width() as c_int;
  let height = rgba.height() as c_int;
  let stride = rgba.width() as c_int * 4;
  let quality = quality.clamp(1, 100) as c_float;

  // SAFETY: `rgba.as_ptr()` points to at least `width * height * 4` live
  // bytes, and libwebp writes a newly allocated buffer into `out`. The buffer
  // is released with `WebPFree` after copying. A null `out` on success means
  // an encoding failure and is reported before dereferencing.
  unsafe {
    let mut out: *mut u8 = std::ptr::null_mut();
    let size = libwebp_sys::WebPEncodeRGBA(rgba.as_ptr(), width, height, stride, quality, &mut out);
    if size == 0 || out.is_null() {
      if !out.is_null() {
        libwebp_sys::WebPFree(out as *mut std::ffi::c_void);
      }
      return Err(ProcessingError::encode_failed(
        "Could not encode WebP image",
      ));
    }
    let bytes = std::slice::from_raw_parts(out, size).to_vec();
    libwebp_sys::WebPFree(out as *mut std::ffi::c_void);
    Ok(bytes)
  }
}

#[cfg(test)]
mod tests {
  use super::encode_lossy;

  #[test]
  fn encodes_small_rgba_image_to_webp() {
    let img = image::DynamicImage::ImageRgba8(image::RgbaImage::from_pixel(
      4,
      4,
      image::Rgba([200, 50, 10, 255]),
    ));
    let bytes = encode_lossy(&img, 80).unwrap();
    assert!(!bytes.is_empty());
    assert_eq!(&bytes[0..4], b"RIFF");
  }
}
