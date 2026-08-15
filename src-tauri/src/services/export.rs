use std::path::{Path, PathBuf};

use crate::errors::ProcessingError;

/// Fails with `OutputUnavailable` when `dir` does not exist or is not a
/// directory, so a missing/moved destination is reported before any work runs.
pub fn ensure_output_dir(dir: &Path) -> Result<(), ProcessingError> {
  if !dir.is_dir() {
    return Err(ProcessingError::output_unavailable(format!(
      "Export directory is not available: {}",
      dir.display()
    )));
  }
  Ok(())
}

/// Resolves the output path for a converted file.
///
/// Naming: source stem + new extension (`photo.png` → `photo.webp`).
/// Collision rule: always auto-rename incrementally (`photo-2.webp`,
/// `photo-3.webp`, ...). The source path itself always counts as a collision,
/// so a conversion can never resolve to (and thus overwrite) the source file.
pub fn resolve_output_path(
  output_dir: &Path,
  source_path: &Path,
  ext: &str,
) -> Result<PathBuf, ProcessingError> {
  let stem = source_path
    .file_stem()
    .ok_or_else(|| {
      ProcessingError::processing_failed(format!(
        "Could not determine file name for {}",
        source_path.display()
      ))
    })?
    .to_string_lossy()
    .into_owned();

  let mut n: u32 = 0;
  loop {
    let name = if n == 0 {
      format!("{stem}.{ext}")
    } else {
      format!("{stem}-{}.{ext}", n + 1)
    };
    let candidate = output_dir.join(name);
    if candidate != source_path && !candidate.exists() {
      return Ok(candidate);
    }
    n += 1;
  }
}

#[cfg(test)]
mod tests {
  use std::path::{Path, PathBuf};
  use std::sync::atomic::{AtomicU32, Ordering};

  use super::resolve_output_path;

  static COUNTER: AtomicU32 = AtomicU32::new(0);

  fn temp_dir() -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
      "toolbox-export-test-{}-{}",
      std::process::id(),
      COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    std::fs::create_dir_all(&dir).unwrap();
    dir
  }

  #[test]
  fn fresh_output_uses_plain_name() {
    let dir = temp_dir();
    let source = Path::new("C:/photos/photo.png");
    let out = resolve_output_path(&dir, source, "webp").unwrap();
    assert_eq!(out.file_name().unwrap().to_string_lossy(), "photo.webp");
    std::fs::remove_dir_all(&dir).unwrap();
  }

  #[test]
  fn collision_renames_incrementally() {
    let dir = temp_dir();
    std::fs::write(dir.join("photo.webp"), b"x").unwrap();
    std::fs::write(dir.join("photo-2.webp"), b"x").unwrap();
    let source = Path::new("C:/photos/photo.png");
    let out = resolve_output_path(&dir, source, "webp").unwrap();
    assert_eq!(out.file_name().unwrap().to_string_lossy(), "photo-3.webp");
    std::fs::remove_dir_all(&dir).unwrap();
  }

  #[test]
  fn source_path_is_never_overwritten() {
    let dir = temp_dir();
    std::fs::write(dir.join("photo.png"), b"original").unwrap();
    let source = dir.join("photo.png");
    let out = resolve_output_path(&dir, &source, "png").unwrap();
    assert_ne!(out, source);
    assert_eq!(out.file_name().unwrap().to_string_lossy(), "photo-2.png");
    assert_eq!(std::fs::read_to_string(&source).unwrap(), "original");
    std::fs::remove_dir_all(&dir).unwrap();
  }

  #[test]
  fn jpeg_uses_jpg_extension() {
    let dir = temp_dir();
    let source = Path::new("C:/photos/photo.jpeg");
    let out = resolve_output_path(&dir, source, "jpg").unwrap();
    assert_eq!(out.file_name().unwrap().to_string_lossy(), "photo.jpg");
    std::fs::remove_dir_all(&dir).unwrap();
  }
}
