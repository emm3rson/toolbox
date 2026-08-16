use std::path::Path;

use crate::models::InputFile;

pub const MAX_PDF_BYTES: u64 = 100 * 1024 * 1024; // 100 MiB
const SUPPORTED_EXTENSIONS: &[&str] = &["pdf"];

/// Inspects each path and returns one `InputFile` per PDF.
///
/// A directory path is expanded shallowly: its direct children that look like
/// `.pdf` files are inspected (no recursion). A file path yields itself.
pub fn inspect_pdf_paths(paths: Vec<String>) -> Vec<InputFile> {
  let mut out = Vec::new();
  for path in paths {
    match std::fs::metadata(&path) {
      Ok(meta) if meta.is_dir() => out.extend(expand_pdf_directory(&path)),
      Ok(meta) if meta.is_file() => out.push(inspect_pdf_file(&path, meta.len())),
      Ok(_) => out.push(invalid_pdf_file(&path, 0, "Not a regular file")),
      Err(_) => out.push(invalid_pdf_file(&path, 0, "File not found")),
    }
  }
  out
}

fn expand_pdf_directory(path: &str) -> Vec<InputFile> {
  let Ok(entries) = std::fs::read_dir(path) else {
    return Vec::new();
  };
  let mut files: Vec<_> = entries
    .filter_map(Result::ok)
    .filter(|entry| entry.path().is_file())
    .collect();
  files.sort_by_key(|entry| entry.file_name());
  files
    .into_iter()
    .filter_map(|entry| {
      let file_path = entry.path();
      let extension = file_path
        .extension()
        .map(|ext| ext.to_string_lossy().to_lowercase())
        .unwrap_or_default();
      if !SUPPORTED_EXTENSIONS.contains(&extension.as_str()) {
        return None;
      }
      let size = entry.metadata().map(|meta| meta.len()).unwrap_or(0);
      Some(inspect_pdf_file(&file_path.to_string_lossy(), size))
    })
    .collect()
}

pub fn inspect_pdf_file(path: &str, size: u64) -> InputFile {
  let mut file = base_pdf_input(path, size);

  if size == 0 {
    file.status = "invalid".into();
    file.error = Some("File is empty".into());
    return file;
  }

  if size > MAX_PDF_BYTES {
    file.status = "invalid".into();
    file.error = Some("File exceeds maximum size limit (100 MB)".into());
    return file;
  }

  let extension = file.extension.to_lowercase();
  if extension != "pdf" {
    file.status = "invalid".into();
    file.error = Some("Unsupported format (expected .pdf)".into());
    return file;
  }

  // PDF readers commonly tolerate leading bytes, so inspect the first 1 KiB.
  let mut header = [0u8; 1024];
  match std::fs::File::open(path) {
    Ok(mut handle) => {
      use std::io::Read;
      match handle.read(&mut header) {
        Ok(bytes_read) if bytes_read >= 4 => {
          let slice = &header[..bytes_read];
          if slice.windows(5).any(|window| window == b"%PDF-") {
            file.status = "ready".into();
          } else {
            file.status = "invalid".into();
            file.error = Some("Not a valid PDF file".into());
          }
        }
        _ => {
          file.status = "invalid".into();
          file.error = Some("Could not read file header".into());
        }
      }
    }
    Err(_) => {
      file.status = "invalid".into();
      file.error = Some("Could not read file".into());
    }
  }

  file
}

fn base_pdf_input(path: &str, size: u64) -> InputFile {
  let name = Path::new(path)
    .file_name()
    .map(|name| name.to_string_lossy().into_owned())
    .unwrap_or_else(|| path.to_string());
  let extension = Path::new(path)
    .extension()
    .map(|ext| ext.to_string_lossy().to_lowercase())
    .unwrap_or_default();
  InputFile {
    path: path.to_string(),
    name,
    extension,
    size,
    width: 0,
    height: 0,
    status: "invalid".into(),
    error: None,
  }
}

fn invalid_pdf_file(path: &str, size: u64, error: &str) -> InputFile {
  let mut file = base_pdf_input(path, size);
  file.status = "invalid".into();
  file.error = Some(error.into());
  file
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::sync::atomic::{AtomicU32, Ordering};

  static COUNTER: AtomicU32 = AtomicU32::new(0);

  fn temp_dir() -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!(
      "toolbox-pdf-inspect-test-{}-{}",
      std::process::id(),
      COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    std::fs::create_dir_all(&dir).unwrap();
    dir
  }

  #[test]
  fn valid_pdf_header_is_ready() {
    let dir = temp_dir();
    let file_path = dir.join("doc.pdf");
    std::fs::write(&file_path, b"%PDF-1.7\n1 0 obj\n<<>>\nendobj\n").unwrap();
    let res = inspect_pdf_paths(vec![file_path.to_string_lossy().into_owned()]);
    assert_eq!(res.len(), 1);
    assert_eq!(res[0].status, "ready");
    assert_eq!(res[0].extension, "pdf");
    std::fs::remove_dir_all(&dir).unwrap();
  }

  #[test]
  fn zero_byte_pdf_is_invalid() {
    let dir = temp_dir();
    let file_path = dir.join("empty.pdf");
    std::fs::write(&file_path, b"").unwrap();
    let res = inspect_pdf_paths(vec![file_path.to_string_lossy().into_owned()]);
    assert_eq!(res.len(), 1);
    assert_eq!(res[0].status, "invalid");
    assert_eq!(res[0].error.as_deref(), Some("File is empty"));
    std::fs::remove_dir_all(&dir).unwrap();
  }

  #[test]
  fn invalid_magic_pdf_is_invalid() {
    let dir = temp_dir();
    let file_path = dir.join("fake.pdf");
    std::fs::write(&file_path, b"NOT A PDF HEADER").unwrap();
    let res = inspect_pdf_paths(vec![file_path.to_string_lossy().into_owned()]);
    assert_eq!(res.len(), 1);
    assert_eq!(res[0].status, "invalid");
    assert_eq!(res[0].error.as_deref(), Some("Not a valid PDF file"));
    std::fs::remove_dir_all(&dir).unwrap();
  }

  #[test]
  fn incomplete_pdf_magic_is_invalid() {
    let dir = temp_dir();
    let file_path = dir.join("fake.pdf");
    std::fs::write(&file_path, b"prefix %PDFx is not a PDF header").unwrap();
    let res = inspect_pdf_paths(vec![file_path.to_string_lossy().into_owned()]);
    assert_eq!(res[0].status, "invalid");
    std::fs::remove_dir_all(&dir).unwrap();
  }

  #[test]
  fn missing_pdf_is_invalid() {
    let dir = temp_dir();
    let file_path = dir.join("missing.pdf");
    let res = inspect_pdf_paths(vec![file_path.to_string_lossy().into_owned()]);
    assert_eq!(res.len(), 1);
    assert_eq!(res[0].status, "invalid");
    assert_eq!(res[0].error.as_deref(), Some("File not found"));
    std::fs::remove_dir_all(&dir).unwrap();
  }
}
