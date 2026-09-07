use image::DynamicImage;
use image::GenericImageView;

use crate::errors::ProcessingError;
use crate::models::ResizeOptions;

/// Computes the target dimensions for a resize request.
///
/// Returns `Ok(None)` when no resize applies (`Original`). `Dimensions` is
/// applied exactly as given — the aspect-ratio lock is a frontend affordance
/// that computes the companion dimension before sending the request. A
/// `Percentage` scales both axes proportionally, preserving aspect ratio.
pub fn target_size(
  original: (u32, u32),
  opts: &ResizeOptions,
) -> Result<Option<(u32, u32)>, ProcessingError> {
  match opts {
    ResizeOptions::Original => Ok(None),
    ResizeOptions::Dimensions { width, height, .. } => {
      if *width == 0 || *height == 0 {
        Err(ProcessingError::invalid_dimensions(
          "Width and height must be greater than zero",
        ))
      } else {
        Ok(Some((*width, *height)))
      }
    }
    ResizeOptions::Percentage { percentage } => {
      if *percentage == 0 {
        Err(ProcessingError::invalid_dimensions(
          "Scale percentage must be greater than zero",
        ))
      } else {
        let (width, height) = original;
        let scale = f64::from(*percentage) / 100.0;
        let width = ((f64::from(width) * scale).round() as u32).max(1);
        let height = ((f64::from(height) * scale).round() as u32).max(1);
        Ok(Some((width, height)))
      }
    }
  }
}

/// Resizes an image to exact target dimensions with Lanczos3 resampling.
pub fn resize(img: &DynamicImage, (width, height): (u32, u32)) -> DynamicImage {
  DynamicImage::ImageRgba8(image::imageops::resize(
    img,
    width,
    height,
    image::imageops::FilterType::Lanczos3,
  ))
}

/// Resizes the image to the request's target dimensions, if any.
pub fn apply(img: &DynamicImage, opts: &ResizeOptions) -> Result<DynamicImage, ProcessingError> {
  match target_size(img.dimensions(), opts)? {
    None => Ok(img.clone()),
    Some((width, height)) if img.width() == width && img.height() == height => Ok(img.clone()),
    Some((width, height)) => Ok(resize(img, (width, height))),
  }
}

#[cfg(test)]
mod tests {
  use crate::models::ResizeOptions;

  use super::target_size;

  #[test]
  fn original_mode_returns_none() {
    let result = target_size((1200, 800), &ResizeOptions::Original).unwrap();
    assert_eq!(result, None);
  }

  #[test]
  fn dimensions_mode_is_exact() {
    let result = target_size(
      (1200, 800),
      &ResizeOptions::Dimensions {
        width: 400,
        height: 300,
        lock_aspect_ratio: true,
      },
    )
    .unwrap();
    assert_eq!(result, Some((400, 300)));
  }

  #[test]
  fn percentage_preserves_aspect_ratio() {
    let result = target_size((1200, 800), &ResizeOptions::Percentage { percentage: 50 }).unwrap();
    assert_eq!(result, Some((600, 400)));
  }

  #[test]
  fn percentage_never_shrinks_below_one_pixel() {
    let result = target_size((4, 2), &ResizeOptions::Percentage { percentage: 10 }).unwrap();
    assert_eq!(result, Some((1, 1)));
  }

  #[test]
  fn zero_dimensions_are_rejected() {
    let err = target_size(
      (1200, 800),
      &ResizeOptions::Dimensions {
        width: 0,
        height: 300,
        lock_aspect_ratio: false,
      },
    )
    .unwrap_err();
    assert!(err.to_string().contains("greater than zero"));
  }

  #[test]
  fn zero_percentage_is_rejected() {
    let err = target_size((1200, 800), &ResizeOptions::Percentage { percentage: 0 }).unwrap_err();
    assert!(err.to_string().contains("greater than zero"));
  }
}
