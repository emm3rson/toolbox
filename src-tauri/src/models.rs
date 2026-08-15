#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InputFile {
  pub path: String,
  pub name: String,
  pub extension: String,
  pub size: u64,
  pub width: u32,
  pub height: u32,
  pub status: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub error: Option<String>,
}
