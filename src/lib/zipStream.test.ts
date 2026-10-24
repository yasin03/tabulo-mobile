/** @jest-environment node */
import { unzipSync, zipSync } from 'fflate';

import { isZip, memorySink, readZip, writeZip, type ByteSink, type ByteSource } from './zipStream';

function sourceOf(bytes: Uint8Array): ByteSource {
  let offset = 0;
  return {
    size: bytes.length,
    readBytes: (length) => {
      const chunk = bytes.subarray(offset, offset + length);
      offset += chunk.length;
      return chunk;
    },
    close: () => {},
  };
}

function bufferSink(): ByteSink & { bytes(): Uint8Array; closed: boolean } {
  const parts: Uint8Array[] = [];
  const sink = {
    closed: false,
    writeBytes: (b: Uint8Array) => void parts.push(b),
    close: () => {
      sink.closed = true;
    },
    bytes: () => new Uint8Array(Buffer.concat(parts)),
  };
  return sink;
}

/** 2,5 MB: birden çok 1 MB'lık parça. */
const big = Uint8Array.from({ length: 2_500_000 }, (_, i) => (i * 7) % 251);
const json = JSON.stringify({ name: 'Çağrı Şık Ünlü', n: 1 });

async function archive() {
  const out = bufferSink();
  await writeZip(out, [
    { name: 'tabulo-backup.json', text: json },
    { name: 'attachments/a.jpg', open: () => sourceOf(big) },
    { name: 'logo/empty.jpg', open: () => sourceOf(new Uint8Array(0)) },
  ]);
  return out.bytes();
}

describe('zipStream', () => {
  it('yazılan zip standart zip olarak açılır', async () => {
    const bytes = await archive();
    expect(isZip(bytes)).toBe(true);
    const files = unzipSync(bytes);
    expect(Buffer.from(files['tabulo-backup.json']!).toString('utf8')).toBe(json);
    expect(Buffer.compare(files['attachments/a.jpg']!, big)).toBe(0);
    expect(files['logo/empty.jpg']!.length).toBe(0);
  });

  it('parça parça okur, istenmeyen dosyaları atlar', async () => {
    const bytes = await archive();
    const jsonSink = memorySink();
    const fileSink = bufferSink();
    const seen: string[] = [];
    await readZip(sourceOf(bytes), (name) => {
      seen.push(name);
      if (name === 'tabulo-backup.json') return jsonSink;
      if (name === 'attachments/a.jpg') return fileSink;
      return null;
    });
    expect(seen).toEqual(['tabulo-backup.json', 'attachments/a.jpg', 'logo/empty.jpg']);
    expect(jsonSink.text()).toBe(json);
    expect(Buffer.compare(fileSink.bytes(), big)).toBe(0);
    expect(fileSink.closed).toBe(true);
  });

  it('başka araçla sıkıştırılmış (deflate) zip de okunur', async () => {
    const bytes = zipSync({ 'tabulo-backup.json': new TextEncoder().encode(json) }, { level: 9 });
    const sink = memorySink();
    await readZip(sourceOf(bytes), () => sink);
    expect(sink.text()).toBe(json);
  });

  it('kesik zip hata verir', async () => {
    const bytes = await archive();
    await expect(
      readZip(sourceOf(bytes.subarray(0, 1_000_000)), () => bufferSink()),
    ).rejects.toThrow();
  });

  it('JSON zip değildir', () => {
    expect(isZip(new TextEncoder().encode('{"app":"tabulo"}'))).toBe(false);
  });
});
