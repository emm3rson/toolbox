use std::path::Path;
use std::sync::atomic::{AtomicUsize, Ordering};

use rayon::prelude::*;
use tauri::Emitter;

use crate::errors::ProcessingError;
use crate::models::{BatchResult, FileResult, ProcessingProgress};

pub const EVENT_PROGRESS: &str = "processing-progress";

const MAX_WORKER_THREADS: usize = 4;

/// Processes files in parallel with bounded concurrency, emitting a
/// `processing-progress` event after each file completes.
///
/// `process` must not panic: per-file failures are captured in `FileResult`
/// and never abort the batch.
pub fn run_batch<F>(
  app: &tauri::AppHandle,
  job_id: String,
  files: &[std::path::PathBuf],
  process: F,
) -> Result<BatchResult, ProcessingError>
where
  F: Fn(&Path) -> FileResult + Sync,
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
    let _ = app.emit(
      EVENT_PROGRESS,
      ProcessingProgress {
        job_id: job_id.clone(),
        completed: 1,
        total: 1,
        current_file: Some(path_string(&files[0])),
      },
    );
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
          let _ = app.emit(
            EVENT_PROGRESS,
            ProcessingProgress {
              job_id: job_id.clone(),
              completed: done as u32,
              total: total as u32,
              current_file: Some(path_string(path)),
            },
          );
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

fn worker_threads() -> usize {
  std::thread::available_parallelism()
    .map(|n| n.get())
    .unwrap_or(1)
    .min(MAX_WORKER_THREADS)
}

fn path_string(path: &Path) -> String {
  path.to_string_lossy().into_owned()
}
