//! Hand-built PNG fixtures for optimizer tests. These intentionally use
//! stored (uncompressed) deflate streams so optimization has room to win,
//! without depending on the `image` crate's encoder defaults.

/// Standard PNG signature.
pub(crate) const PNG_SIGNATURE: [u8; 8] = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

/// CRC-32 (IEEE) as used by PNG chunk validation.
pub(crate) fn crc32(data: &[u8]) -> u32 {
  let mut crc: u32 = 0xFFFF_FFFF;
  for &byte in data {
    crc ^= u32::from(byte);
    for _ in 0..8 {
      crc = if crc & 1 == 1 {
        (crc >> 1) ^ 0xEDB8_8320
      } else {
        crc >> 1
      };
    }
  }
  !crc
}

/// Builds one PNG chunk: length + kind + data + CRC.
pub(crate) fn chunk(kind: &[u8; 4], data: &[u8]) -> Vec<u8> {
  let mut out = Vec::with_capacity(12 + data.len());
  out.extend_from_slice(&(data.len() as u32).to_be_bytes());
  out.extend_from_slice(kind);
  out.extend_from_slice(data);
  let mut crc_input = Vec::with_capacity(4 + data.len());
  crc_input.extend_from_slice(kind);
  crc_input.extend_from_slice(data);
  out.extend_from_slice(&crc32(&crc_input).to_be_bytes());
  out
}

/// Wraps raw scanline data in a zlib stream using a single stored deflate
/// block (no compression) plus a valid Adler-32 trailer. `data` must fit in
/// one block (fewer than 65 535 bytes).
pub(crate) fn stored_deflate(data: &[u8]) -> Vec<u8> {
  let mut out = Vec::new();
  out.extend_from_slice(&[0x78, 0x9C]);
  out.push(0x01);
  let len = data.len() as u16;
  out.extend_from_slice(&len.to_le_bytes());
  out.extend_from_slice(&(!len).to_le_bytes());
  out.extend_from_slice(data);
  let (mut a, mut b) = (1u32, 0u32);
  for &byte in data {
    a = (a + u32::from(byte)) % 65_521;
    b = (b + a) % 65_521;
  }
  out.extend_from_slice(&((b << 16) | a).to_be_bytes());
  out
}

/// A gradient truecolor PNG stored with zero compression, so a lossless
/// optimizer has clear room to shrink it. `width * height` must keep the raw
/// scanlines under 65 535 bytes.
pub(crate) fn naive_rgb_png(width: u32, height: u32) -> Vec<u8> {
  let mut raw = Vec::with_capacity((height * (1 + width * 3)) as usize);
  for y in 0..height {
    raw.push(0);
    for x in 0..width {
      raw.push((x % 251) as u8);
      raw.push((y % 251) as u8);
      raw.push(((x + y) % 251) as u8);
    }
  }
  let mut ihdr = Vec::with_capacity(13);
  ihdr.extend_from_slice(&width.to_be_bytes());
  ihdr.extend_from_slice(&height.to_be_bytes());
  ihdr.extend_from_slice(&[8, 2, 0, 0, 0]);
  let idat = stored_deflate(&raw);
  let mut png = Vec::new();
  png.extend_from_slice(&PNG_SIGNATURE);
  png.extend_from_slice(&chunk(b"IHDR", &ihdr));
  png.extend_from_slice(&chunk(b"IDAT", &idat));
  png.extend_from_slice(&chunk(b"IEND", &[]));
  png
}

/// A 1×1 grayscale APNG with two frames. The default image is followed by one
/// `fcTL`/`fdAT` pair, exercising oxipng's frame recompression.
pub(crate) fn apng_fixture() -> Vec<u8> {
  let ihdr: [u8; 13] = [0, 0, 0, 1, 0, 0, 0, 1, 8, 0, 0, 0, 0];
  let actl: [u8; 8] = [0, 0, 0, 2, 0, 0, 0, 0];
  let fctl = |seq: u32| {
    let mut data = Vec::with_capacity(26);
    data.extend_from_slice(&seq.to_be_bytes());
    data.extend_from_slice(&[0, 0, 0, 1, 0, 0, 0, 1]);
    data.extend_from_slice(&[0, 0, 0, 0, 0, 0, 0, 0]);
    data.extend_from_slice(&[0, 0, 0, 0]);
    data.extend_from_slice(&[0, 0]);
    data
  };
  let frame_idat = stored_deflate(&[0x00, 0x00]);
  let mut fdat = Vec::with_capacity(4 + frame_idat.len());
  fdat.extend_from_slice(&2u32.to_be_bytes());
  fdat.extend_from_slice(&frame_idat);

  let mut png = Vec::new();
  png.extend_from_slice(&PNG_SIGNATURE);
  png.extend_from_slice(&chunk(b"IHDR", &ihdr));
  png.extend_from_slice(&chunk(b"acTL", &actl));
  png.extend_from_slice(&chunk(b"fcTL", &fctl(0)));
  png.extend_from_slice(&chunk(b"IDAT", &frame_idat));
  png.extend_from_slice(&chunk(b"fcTL", &fctl(1)));
  png.extend_from_slice(&chunk(b"fdAT", &fdat));
  png.extend_from_slice(&chunk(b"IEND", &[]));
  png
}
