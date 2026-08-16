use std::path::Path;
use std::sync::atomic::{AtomicUsize, Ordering};

use rayon::prelude::*;

use crate::errors::ProcessingError;
use crate::models::{BatchResult, FileResult};

pub const EVENT_PROGRESS: &str = "processing-progress";

/// Peak memory is bounded by ~`MAX_WORKER_THREADS` concurrent full decodes;
/// each worker holds a decoded image plus its encoded output. Tune this after
/// profiling real-world batches.
const MAX_WORKER_THREADS: usize = 4;

/// Processes files in parallel with bounded concurrency, invoking
/// `on_progress(completed, total, filename)` after each file completes.
///
/// `process` must not panic: per-file failures are captured in `FileResult`
/// and never abort the batch. The progress callback keeps the batch runtime-
/// agnostic so it is unit-testable without a Tauri app; commands wrap it in
/// `app.emit` (like `logo_pack::generate`).
pub fn run_batch<F, P>(
  files: &[std::path::PathBuf],
  process: F,
  on_progress: P,
) -> Result<BatchResult, ProcessingError>
where
  F: Fn(&Path) -> FileResult + Sync,
  P: Fn(u32, u32, &str) + Sync,
{
  let total = files.len();
  if files.is_empty() {
    return Ok(BatchResult {
      total: 0,
      succeeded: 0,
      failed: 0,
      items: Vec::new(),
    });
  }

  let items: Vec<FileResult> = if total == 1 {
    let result = process(&files[0]);
    on_progress(1, 1, &path_string(&files[0]));
    vec![result]
  } else {
    let pool = rayon::ThreadPoolBuilder::new()
      .num_threads(worker_threads())
      .build()
      .map_err(|error| {
        ProcessingError::processing_failed(format!(
          "Could not create processing thread pool: {error}"
        ))
      })?;
    let completed = AtomicUsize::new(0);
    pool.install(|| {
      files
        .par_iter()
        .map(|path| {
          let result = process(path);
          let done = completed.fetch_add(1, Ordering::Relaxed) + 1;
          on_progress(done as u32, total as u32, &path_string(path));
          result
        })
        .collect()
    })
  };

  let succeeded = items.iter().filter(|item| item.success).count();
  Ok(BatchResult {
    total: total as u32,
    succeeded: succeeded as u32,
    failed: (total - succeeded) as u32,
    items,
  })
}

/// Processes files sequentially with 1-by-1 progress reporting.
/// Used for PDF conversion where the parser already handles internal parallelism.
pub fn run_sequential_batch<F, P>(
  files: &[std::path::PathBuf],
  process: F,
  on_progress: P,
) -> Result<BatchResult, ProcessingError>
where
  F: Fn(&Path) -> FileResult,
  P: Fn(u32, u32, &str),
{
  let total = files.len();
  if files.is_empty() {
    return Ok(BatchResult {
      total: 0,
      succeeded: 0,
      failed: 0,
      items: Vec::new(),
    });
  }

  let mut items = Vec::with_capacity(total);
  for (index, file) in files.iter().enumerate() {
    let result = process(file);
    on_progress((index + 1) as u32, total as u32, &path_string(file));
    items.push(result);
  }

  let succeeded = items.iter().filter(|item| item.success).count();
  Ok(BatchResult {
    total: total as u32,
    succeeded: succeeded as u32,
    failed: (total - succeeded) as u32,
    items,
  })
}

fn worker_threads() -> usize {
  std::thread::available_parallelism()
    .map(|n| n.get())
    .unwrap_or(1)
    .min(MAX_WORKER_THREADS)
}

fn path_string(path: &Path) -> String {
  path.to_string_lossy().into_owned()
}

#[cfg(test)]
mod tests {
  use std::path::PathBuf;
  use std::sync::atomic::{AtomicU32, Ordering};

  use crate::models::{ImageFormat, ResizeOptions};
  use crate::tools::image::convert::convert_file;

  use super::run_batch;

  static COUNTER: AtomicU32 = AtomicU32::new(0);

  fn temp_dir() -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!(
      "toolbox-batch-test-{}-{}",
      std::process::id(),
      COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    std::fs::create_dir_all(&dir).unwrap();
    dir
  }

  fn noop_progress(_completed: u32, _total: u32, _filename: &str) {}

  fn write_fixture_png(path: &std::path::Path, width: u32, height: u32) {
    let img = image::DynamicImage::ImageRgba8(image::RgbaImage::from_fn(width, height, |x, y| {
      image::Rgba([(x * 7) as u8, (y * 11) as u8, 120, 255])
    }));
    img.save(path).unwrap();
  }

  #[test]
  fn one_bad_file_does_not_abort_the_batch() {
    let dir = temp_dir();
    let out = temp_dir();
    let good = dir.join("good.png");
    write_fixture_png(&good, 32, 24);
    let corrupt = dir.join("corrupt.png");
    std::fs::write(&corrupt, b"not an image").unwrap();
    let missing = dir.join("missing.png");

    let files = vec![good.clone(), corrupt.clone(), missing];
    let result = run_batch(
      &files,
      |source| {
        convert_file(
          source,
          &out,
          ImageFormat::Webp,
          Some(80),
          &ResizeOptions::Original,
        )
      },
      noop_progress,
    )
    .unwrap();

    assert_eq!(result.total, 3);
    assert_eq!(result.succeeded, 1);
    assert_eq!(result.failed, 2);
    assert_eq!(result.items.iter().filter(|item| item.success).count(), 1);
    let successes: Vec<_> = result
      .items
      .iter()
      .filter(|item| item.success)
      .map(|item| item.source_path.clone())
      .collect();
    assert_eq!(successes, vec![good.to_string_lossy().into_owned()]);
    std::fs::remove_dir_all(&dir).unwrap();
    std::fs::remove_dir_all(&out).unwrap();
  }

  #[test]
  fn empty_batch_returns_empty_result() {
    let result = run_batch(&[], |_| unreachable!(), noop_progress).unwrap();
    assert_eq!(result.total, 0);
    assert_eq!(result.succeeded, 0);
    assert_eq!(result.failed, 0);
    assert!(result.items.is_empty());
  }

  #[test]
  #[ignore = "large-batch performance smoke; run with cargo test -- --ignored"]
  fn large_batch_completes_bounded() {
    let dir = temp_dir();
    let out = temp_dir();
    let mut files = Vec::with_capacity(64);
    for index in 0..64 {
      let source = dir.join(format!("img-{index}.png"));
      write_fixture_png(&source, 64, 64);
      files.push(source);
    }

    let result = run_batch(
      &files,
      |source| {
        convert_file(
          source,
          &out,
          ImageFormat::Jpeg,
          Some(80),
          &ResizeOptions::Original,
        )
      },
      noop_progress,
    )
    .unwrap();

    assert_eq!(result.total, 64);
    assert_eq!(result.succeeded, 64);
    assert_eq!(result.failed, 0);
    std::fs::remove_dir_all(&dir).unwrap();
    std::fs::remove_dir_all(&out).unwrap();
  }

  #[test]
  fn progress_is_reported_per_file() {
    let dir = temp_dir();
    let out = temp_dir();
    let first = dir.join("a.png");
    let second = dir.join("b.png");
    write_fixture_png(&first, 16, 16);
    write_fixture_png(&second, 16, 16);
    let files: Vec<PathBuf> = vec![first, second];

    let completed = std::sync::Mutex::new(Vec::new());
    let result = run_batch(
      &files,
      |source| {
        convert_file(
          source,
          &out,
          ImageFormat::Webp,
          Some(80),
          &ResizeOptions::Original,
        )
      },
      |done, total, _filename| {
        completed.lock().unwrap().push((done, total));
      },
    )
    .unwrap();

    assert_eq!(result.succeeded, 2);
    let mut calls = completed.lock().unwrap().clone();
    calls.sort();
    assert_eq!(calls, vec![(1, 2), (2, 2)]);
    std::fs::remove_dir_all(&dir).unwrap();
    std::fs::remove_dir_all(&out).unwrap();
  }
}
