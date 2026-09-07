use std::path::Path;

use crate::models::{VideoOutputFormat, VideoQualityPreset, VideoResolutionPreset};

use super::probe::ProbedVideo;

const BOX_1080P: (u32, u32) = (1920, 1080);
const BOX_720P: (u32, u32) = (1280, 720);
const BOX_480P: (u32, u32) = (854, 480);

/// Everything the FFmpeg invocation needs, derived only from typed presets
/// and the probed source. `scale` is `None` when no `-vf` filter is needed.
pub struct EncodePlan {
  pub scale: Option<(u32, u32)>,
  pub video_args: Vec<&'static str>,
  pub audio_args: Vec<&'static str>,
  pub muxer_args: Vec<&'static str>,
  pub muxer_format: &'static str,
}

/// Computes the output dimensions for a preset from the source's visible
/// dimensions.
///
/// Presets are orientation-aware bounding boxes (landscape, swapped for
/// portrait sources) with no upscaling. Returns `None` when no scaling is
/// needed (the source already matches the target); otherwise returns the
/// target rounded down to even dimensions.
pub fn compute_output_dimensions(
  visible_w: u32,
  visible_h: u32,
  preset: VideoResolutionPreset,
) -> Option<(u32, u32)> {
  let target = match preset {
    VideoResolutionPreset::Original => (visible_w, visible_h),
    VideoResolutionPreset::P1080 => fit_to_box(visible_w, visible_h, BOX_1080P),
    VideoResolutionPreset::P720 => fit_to_box(visible_w, visible_h, BOX_720P),
    VideoResolutionPreset::P480 => fit_to_box(visible_w, visible_h, BOX_480P),
  };
  let even = (even_down(target.0), even_down(target.1));
  if even == (visible_w, visible_h) {
    None
  } else {
    Some(even)
  }
}

/// Builds the full FFmpeg argument list for encoding one file to a partial
/// output path. `-map 0:V:0` always selects the first real video stream
/// (cover art excluded); `-map 0:a:0?` optionally selects the first audio
/// stream.
pub fn build_ffmpeg_args(
  (format, quality, resolution): (VideoOutputFormat, VideoQualityPreset, VideoResolutionPreset),
  probe: &ProbedVideo,
  input: &Path,
  partial_output: &Path,
) -> Vec<String> {
  let plan = build_plan(format, quality, resolution, probe);

  let mut args: Vec<String> = [
    "-hide_banner",
    "-nostdin",
    "-y",
    "-v",
    "error",
    "-i",
    &input.to_string_lossy(),
    "-map",
    "0:V:0",
    "-map",
    "0:a:0?",
  ]
  .into_iter()
  .map(str::to_string)
  .collect();

  if let Some((width, height)) = plan.scale {
    args.push("-vf".into());
    args.push(format!("scale={width}:{height}"));
  }

  args.extend(plan.video_args.iter().copied().map(str::to_string));
  args.extend(plan.audio_args.iter().copied().map(str::to_string));
  args.push("-map_metadata".into());
  args.push("0".into());
  args.extend(plan.muxer_args.iter().copied().map(str::to_string));
  args.push("-f".into());
  args.push(plan.muxer_format.into());
  args.push("-progress".into());
  args.push("pipe:1".into());
  args.push("-nostats".into());
  args.push(partial_output.to_string_lossy().into_owned());

  args
}

/// Derives the encode plan from pinned per-format/quality preset tables.
pub fn build_plan(
  format: VideoOutputFormat,
  quality: VideoQualityPreset,
  resolution: VideoResolutionPreset,
  probe: &ProbedVideo,
) -> EncodePlan {
  let (visible_w, visible_h) = probe.visible_dimensions();
  let scale = compute_output_dimensions(visible_w, visible_h, resolution);

  let (video_args, audio_args, muxer_args, muxer_format) = match format {
    VideoOutputFormat::Mp4 => (
      match quality {
        VideoQualityPreset::High => vec![
          "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
        ],
        VideoQualityPreset::Balanced => vec![
          "-c:v", "libx264", "-preset", "medium", "-crf", "23", "-pix_fmt", "yuv420p",
        ],
        VideoQualityPreset::Small => vec![
          "-c:v", "libx264", "-preset", "veryfast", "-crf", "28", "-pix_fmt", "yuv420p",
        ],
      },
      match quality {
        VideoQualityPreset::High => vec!["-c:a", "aac", "-b:a", "192k"],
        VideoQualityPreset::Balanced => vec!["-c:a", "aac", "-b:a", "128k"],
        VideoQualityPreset::Small => vec!["-c:a", "aac", "-b:a", "96k"],
      },
      vec!["-movflags", "+faststart"],
      "mp4",
    ),
    VideoOutputFormat::Webm => (
      match quality {
        VideoQualityPreset::High => vec![
          "-c:v",
          "libvpx-vp9",
          "-deadline",
          "good",
          "-cpu-used",
          "2",
          "-crf",
          "24",
          "-b:v",
          "0",
          "-row-mt",
          "1",
          "-pix_fmt",
          "yuv420p",
        ],
        VideoQualityPreset::Balanced => vec![
          "-c:v",
          "libvpx-vp9",
          "-deadline",
          "good",
          "-cpu-used",
          "4",
          "-crf",
          "31",
          "-b:v",
          "0",
          "-row-mt",
          "1",
          "-pix_fmt",
          "yuv420p",
        ],
        VideoQualityPreset::Small => vec![
          "-c:v",
          "libvpx-vp9",
          "-deadline",
          "good",
          "-cpu-used",
          "5",
          "-crf",
          "38",
          "-b:v",
          "0",
          "-row-mt",
          "1",
          "-pix_fmt",
          "yuv420p",
        ],
      },
      match quality {
        VideoQualityPreset::High => vec!["-c:a", "libopus", "-b:a", "160k"],
        VideoQualityPreset::Balanced => vec!["-c:a", "libopus", "-b:a", "128k"],
        VideoQualityPreset::Small => vec!["-c:a", "libopus", "-b:a", "96k"],
      },
      Vec::new(),
      "webm",
    ),
  };

  EncodePlan {
    scale,
    video_args,
    audio_args,
    muxer_args,
    muxer_format,
  }
}

/// Fits `visible` inside an orientation-aware bounding box without upscaling.
fn fit_to_box(visible_w: u32, visible_h: u32, box_landscape: (u32, u32)) -> (u32, u32) {
  let (box_w, box_h) = if visible_w >= visible_h {
    box_landscape
  } else {
    (box_landscape.1, box_landscape.0)
  };

  if visible_w <= box_w && visible_h <= box_h {
    return (visible_w, visible_h);
  }

  // Scale down to fit, preserving aspect ratio with exact integer math
  // (floating point floors can land one pixel short, e.g. 2160 * (720/2160)).
  if visible_w as u64 * box_h as u64 >= visible_h as u64 * box_w as u64 {
    let width = box_w;
    let height = round_div(visible_h as u64 * box_w as u64, visible_w as u64) as u32;
    (width, height.max(2))
  } else {
    let height = box_h;
    let width = round_div(visible_w as u64 * box_h as u64, visible_h as u64) as u32;
    (width.max(2), height)
  }
}

fn round_div(numerator: u64, denominator: u64) -> u64 {
  (numerator + denominator / 2) / denominator
}

fn even_down(value: u32) -> u32 {
  value & !1
}

#[cfg(test)]
mod tests {
  use super::*;

  fn probed(width: u32, height: u32, rotation: i32) -> ProbedVideo {
    ProbedVideo {
      width,
      height,
      rotation,
      duration_secs: Some(1.0),
      has_audio: true,
      audio_stream_count: 1,
      subtitle_stream_count: 0,
      attachment_stream_count: 0,
      data_stream_count: 0,
    }
  }

  fn plan_for(
    format: VideoOutputFormat,
    quality: VideoQualityPreset,
    resolution: VideoResolutionPreset,
    probe: &ProbedVideo,
  ) -> Vec<String> {
    build_ffmpeg_args(
      (format, quality, resolution),
      probe,
      Path::new("C:/in/clip.mp4"),
      Path::new("C:/out/clip.part-1.mp4"),
    )
  }

  #[test]
  fn mp4_balanced_args_match_pinned_table() {
    let args = plan_for(
      VideoOutputFormat::Mp4,
      VideoQualityPreset::Balanced,
      VideoResolutionPreset::Original,
      &probed(320, 240, 0),
    );
    assert_eq!(
      args,
      vec![
        "-hide_banner",
        "-nostdin",
        "-y",
        "-v",
        "error",
        "-i",
        "C:/in/clip.mp4",
        "-map",
        "0:V:0",
        "-map",
        "0:a:0?",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "23",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-map_metadata",
        "0",
        "-movflags",
        "+faststart",
        "-f",
        "mp4",
        "-progress",
        "pipe:1",
        "-nostats",
        "C:/out/clip.part-1.mp4",
      ]
    );
  }

  #[test]
  fn webm_high_args_match_pinned_table() {
    let args = plan_for(
      VideoOutputFormat::Webm,
      VideoQualityPreset::High,
      VideoResolutionPreset::Original,
      &probed(320, 240, 0),
    );
    assert_eq!(
      args,
      vec![
        "-hide_banner",
        "-nostdin",
        "-y",
        "-v",
        "error",
        "-i",
        "C:/in/clip.mp4",
        "-map",
        "0:V:0",
        "-map",
        "0:a:0?",
        "-c:v",
        "libvpx-vp9",
        "-deadline",
        "good",
        "-cpu-used",
        "2",
        "-crf",
        "24",
        "-b:v",
        "0",
        "-row-mt",
        "1",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "libopus",
        "-b:a",
        "160k",
        "-map_metadata",
        "0",
        "-f",
        "webm",
        "-progress",
        "pipe:1",
        "-nostats",
        "C:/out/clip.part-1.mp4",
      ]
    );
  }

  #[test]
  fn every_format_quality_combo_matches_preset_table() {
    let base = probed(320, 240, 0);
    let cases = [
      (
        VideoOutputFormat::Mp4,
        VideoQualityPreset::High,
        vec![
          "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac",
          "-b:a", "192k",
        ],
      ),
      (
        VideoOutputFormat::Mp4,
        VideoQualityPreset::Small,
        vec![
          "-c:v", "libx264", "-preset", "veryfast", "-crf", "28", "-pix_fmt", "yuv420p", "-c:a",
          "aac", "-b:a", "96k",
        ],
      ),
      (
        VideoOutputFormat::Webm,
        VideoQualityPreset::Balanced,
        vec![
          "-c:v",
          "libvpx-vp9",
          "-deadline",
          "good",
          "-cpu-used",
          "4",
          "-crf",
          "31",
          "-b:v",
          "0",
          "-row-mt",
          "1",
          "-pix_fmt",
          "yuv420p",
          "-c:a",
          "libopus",
          "-b:a",
          "128k",
        ],
      ),
      (
        VideoOutputFormat::Webm,
        VideoQualityPreset::Small,
        vec![
          "-c:v",
          "libvpx-vp9",
          "-deadline",
          "good",
          "-cpu-used",
          "5",
          "-crf",
          "38",
          "-b:v",
          "0",
          "-row-mt",
          "1",
          "-pix_fmt",
          "yuv420p",
          "-c:a",
          "libopus",
          "-b:a",
          "96k",
        ],
      ),
    ];
    for (format, quality, expected_codec_args) in cases {
      let args = plan_for(format, quality, VideoResolutionPreset::Original, &base);
      for flag in &expected_codec_args {
        assert!(
          args.iter().any(|arg| arg == flag),
          "missing flag '{flag}' for {format:?}/{quality:?} in {args:?}"
        );
      }
    }
  }

  #[test]
  fn scale_filter_is_emitted_only_when_needed() {
    let wide = probed(3840, 2160, 0);
    let args = plan_for(
      VideoOutputFormat::Mp4,
      VideoQualityPreset::Balanced,
      VideoResolutionPreset::P1080,
      &wide,
    );
    let vf_index = args
      .iter()
      .position(|arg| arg == "-vf")
      .expect("vf present");
    assert_eq!(args[vf_index + 1], "scale=1920:1080");

    let fitting = probed(640, 360, 0);
    let args = plan_for(
      VideoOutputFormat::Mp4,
      VideoQualityPreset::Balanced,
      VideoResolutionPreset::P720,
      &fitting,
    );
    assert!(!args.iter().any(|arg| arg == "-vf"));
  }

  #[test]
  fn landscape_4k_to_1080p_scales_to_1920x1080() {
    assert_eq!(
      compute_output_dimensions(3840, 2160, VideoResolutionPreset::P1080),
      Some((1920, 1080))
    );
  }

  #[test]
  fn portrait_source_uses_swapped_box() {
    // 1080x1920 fits the portrait 1080p box exactly: no scaling.
    assert_eq!(
      compute_output_dimensions(1080, 1920, VideoResolutionPreset::P1080),
      None
    );
    // 2160x3840 must shrink into the portrait 720p box.
    assert_eq!(
      compute_output_dimensions(2160, 3840, VideoResolutionPreset::P720),
      Some((720, 1280))
    );
  }

  #[test]
  fn no_upscaling_for_small_sources() {
    assert_eq!(
      compute_output_dimensions(640, 360, VideoResolutionPreset::P720),
      None
    );
    assert_eq!(
      compute_output_dimensions(320, 240, VideoResolutionPreset::P480),
      None
    );
  }

  #[test]
  fn original_only_outputs_even_dimensions() {
    assert_eq!(
      compute_output_dimensions(501, 377, VideoResolutionPreset::Original),
      Some((500, 376))
    );
    assert_eq!(
      compute_output_dimensions(640, 360, VideoResolutionPreset::Original),
      None
    );
  }

  #[test]
  fn rotation_is_resolved_through_visible_dimensions() {
    // Stored 1920x1080 rotated 90deg: visible is portrait 1080x1920.
    let rotated = probed(1920, 1080, 90);
    assert_eq!(rotated.visible_dimensions(), (1080, 1920));
    assert_eq!(
      compute_output_dimensions(
        rotated.visible_dimensions().0,
        rotated.visible_dimensions().1,
        VideoResolutionPreset::P720
      ),
      Some((720, 1280))
    );
  }

  #[test]
  fn portrait_240x320_fits_1080p_box_without_scaling() {
    assert_eq!(
      compute_output_dimensions(240, 320, VideoResolutionPreset::P1080),
      None
    );
  }

  #[test]
  fn odd_fitting_source_is_evened() {
    // Fits inside the 720p box but must still be evened for the encoders.
    assert_eq!(
      compute_output_dimensions(641, 361, VideoResolutionPreset::P720),
      Some((640, 360))
    );
  }
}
