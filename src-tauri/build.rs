use std::{fs, io, path::Path};

fn main() {
    ensure_tauri_icons().expect("failed to generate Tauri icons");
    tauri_build::build()
}

fn ensure_tauri_icons() -> io::Result<()> {
    let icons_dir = Path::new("icons");
    fs::create_dir_all(icons_dir)?;

    for (file_name, size) in [
        ("32x32.png", 32),
        ("128x128.png", 128),
        ("128x128@2x.png", 256),
        ("icon.png", 512),
    ] {
        let path = icons_dir.join(file_name);
        if !path.exists() {
            fs::write(path, render_png(size, size))?;
        }
    }

    Ok(())
}

fn render_png(width: u32, height: u32) -> Vec<u8> {
    let mut raw = Vec::with_capacity(((width * 4 + 1) * height) as usize);

    for y in 0..height {
        raw.push(0);
        for x in 0..width {
            let red = 38 + (34 * x / width.max(1)) as u8;
            let green = 99 + (30 * y / height.max(1)) as u8;
            let blue = 235 - (35 * y / height.max(1)) as u8;
            raw.extend_from_slice(&[red, green, blue, 255]);
        }
    }

    let mut png = Vec::new();
    png.extend_from_slice(b"\x89PNG\r\n\x1a\n");

    let mut ihdr = Vec::with_capacity(13);
    ihdr.extend_from_slice(&width.to_be_bytes());
    ihdr.extend_from_slice(&height.to_be_bytes());
    ihdr.extend_from_slice(&[8, 6, 0, 0, 0]);
    write_chunk(&mut png, b"IHDR", &ihdr);

    write_chunk(&mut png, b"IDAT", &zlib_store(&raw));
    write_chunk(&mut png, b"IEND", &[]);

    png
}

fn zlib_store(data: &[u8]) -> Vec<u8> {
    let mut encoded = Vec::new();
    encoded.extend_from_slice(&[0x78, 0x01]);

    for chunk in data.chunks(u16::MAX as usize) {
        let is_final = chunk.as_ptr() as usize + chunk.len() == data.as_ptr() as usize + data.len();
        encoded.push(u8::from(is_final));

        let len = chunk.len() as u16;
        encoded.extend_from_slice(&len.to_le_bytes());
        encoded.extend_from_slice(&(!len).to_le_bytes());
        encoded.extend_from_slice(chunk);
    }

    encoded.extend_from_slice(&adler32(data).to_be_bytes());
    encoded
}

fn write_chunk(png: &mut Vec<u8>, kind: &[u8; 4], data: &[u8]) {
    png.extend_from_slice(&(data.len() as u32).to_be_bytes());
    png.extend_from_slice(kind);
    png.extend_from_slice(data);

    let mut crc_data = Vec::with_capacity(kind.len() + data.len());
    crc_data.extend_from_slice(kind);
    crc_data.extend_from_slice(data);
    png.extend_from_slice(&crc32(&crc_data).to_be_bytes());
}

fn adler32(data: &[u8]) -> u32 {
    const MOD_ADLER: u32 = 65_521;
    let mut a = 1;
    let mut b = 0;

    for byte in data {
        a = (a + u32::from(*byte)) % MOD_ADLER;
        b = (b + a) % MOD_ADLER;
    }

    (b << 16) | a
}

fn crc32(data: &[u8]) -> u32 {
    let mut crc = 0xffff_ffff;

    for byte in data {
        crc ^= u32::from(*byte);
        for _ in 0..8 {
            let mask = 0u32.wrapping_sub(crc & 1);
            crc = (crc >> 1) ^ (0xedb8_8320 & mask);
        }
    }

    !crc
}
