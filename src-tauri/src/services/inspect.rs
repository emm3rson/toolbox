use std::io::BufReader;
use std::path::Path;

use crate::models::InputFile;

const SUPPORTED_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "webp"];

/// Inspects each path and returns one `InputFile` per image.
///
/// A directory path is expanded shallowly: its direct children that look like
/// supported images are inspected (no recursion). A file path yields itself.
pub fn inspect_paths(paths: Vec<String>) -> Vec<InputFile> {
  let mut out = Vec::new();
  for path in paths {
    match std::fs::metadata(&path) {
      Ok(meta) if meta.is_dir() => out.extend(expand_directory(&path)),
      Ok(meta) if meta.is_file() => out.push(inspect_file(&path, meta.len())),
      Ok(_) => out.push(invalid_file(&path, 0, "Not a regular file")),
      Err(_) => out.push(invalid_file(&path, 0, "File not found")),
    }
  }
  out
}

fn expand_directory(path: &str) -> Vec<InputFile> {
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
      Some(inspect_file(&file_path.to_string_lossy(), size))
    })
    .collect()
}

fn inspect_file(path: &str, size: u64) -> InputFile {
  let mut file = base_input(path, size);

  let mut reader = match image::ImageReader::open(path) {
    Ok(reader) => reader,
    Err(_) => {
      file.status = "invalid".into();
      file.error = Some("Could not read file".into());
      return file;
    }
  };
  reader = match reader.with_guessed_format() {
    Ok(reader) => reader,
    Err(_) => {
      file.status = "invalid".into();
      file.error = Some("Unsupported format".into());
      return file;
    }
  };
  let format = reader.format();

  match format {
    Some(image::ImageFormat::Png) | Some(image::ImageFormat::Jpeg) => {
      match reader.into_dimensions() {
        Ok((width, height)) => {
          file.width = width;
          file.height = height;
          file.status = "ready".into();
        }
        Err(_) => {
          file.status = "invalid".into();
          file.error = Some("Not a valid image".into());
        }
      }
    }
    Some(image::ImageFormat::WebP) => inspect_webp(&mut file, path),
    _ => {
      file.status = "invalid".into();
      file.error = Some("Unsupported format".into());
    }
  }

  file
}

fn inspect_webp(file: &mut InputFile, path: &str) {
  let Ok(handle) = std::fs::File::open(path) else {
    file.status = "invalid".into();
    file.error = Some("Could not read file".into());
    return;
  };
  match image_webp::WebPDecoder::new(BufReader::new(handle)) {
    Ok(decoder) => {
      let (width, height) = decoder.dimensions();
      file.width = width;
      file.height = height;
      file.status = "ready".into();
    }
    Err(_) => {
      file.status = "invalid".into();
      file.error = Some("Not a valid image".into());
    }
  }
}

fn base_input(path: &str, size: u64) -> InputFile {
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

fn invalid_file(path: &str, size: u64, error: &str) -> InputFile {
  let mut file = base_input(path, size);
  file.status = "invalid".into();
  file.error = Some(error.into());
  file
}
