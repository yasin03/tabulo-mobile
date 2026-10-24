// Yedek zip'i (10.3) parça parça yazar/okur (fflate, saf JS). Belgeler toplamda yüzlerce MB olabilir;
// dosyalar belleğe tümüyle alınmaz, 1 MB'lık parçalarla akar. Dosya erişimi küçük arayüzlerin arkasında:
// uygulamada expo-file-system `FileHandle`, testlerde bellek.

import { strFromU8, strToU8, Unzip, UnzipInflate, Zip, ZipDeflate, ZipPassThrough } from 'fflate';

export interface ByteSink {
  writeBytes(bytes: Uint8Array): void;
  close(): void;
}

export interface ByteSource {
  readonly size: number;
  readBytes(length: number): Uint8Array;
  close(): void;
}

/** JSON metni sıkıştırılır; belge dosyaları (JPEG / PDF zaten sıkışık) olduğu gibi saklanır. */
export type ZipEntry = { name: string; text: string } | { name: string; open: () => ByteSource };

const CHUNK_SIZE = 1 << 20;

/** Parçalar arasında arayüze nefes aldırır (yükleniyor göstergesi döner, ekran donmaz – 8.3). */
const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Zip yerel dosya başlığı imzası `PK\x03\x04`. */
export function isZip(head: Uint8Array): boolean {
  return head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
}

function pump(source: ByteSource, push: (chunk: Uint8Array, final: boolean) => void) {
  if (source.size === 0) {
    push(new Uint8Array(0), true);
    return;
  }
  let read = 0;
  while (read < source.size) {
    const chunk = source.readBytes(Math.min(CHUNK_SIZE, source.size - read));
    if (chunk.length === 0) throw new Error('Unexpected end of file');
    read += chunk.length;
    push(chunk, read >= source.size);
  }
}

export async function writeZip(sink: ByteSink, entries: readonly ZipEntry[]): Promise<void> {
  let failure: unknown;
  const zip = new Zip((error, chunk) => {
    if (error) failure ??= error;
    else sink.writeBytes(chunk);
  });

  for (const entry of entries) {
    if ('text' in entry) {
      const file = new ZipDeflate(entry.name, { level: 6 });
      zip.add(file);
      file.push(strToU8(entry.text), true);
    } else {
      const file = new ZipPassThrough(entry.name);
      zip.add(file);
      const source = entry.open();
      try {
        pump(source, (chunk, final) => file.push(chunk, final));
      } finally {
        source.close();
      }
    }
    if (failure) throw failure;
    await yieldToUi();
  }
  zip.end();
  if (failure) throw failure;
}

/**
 * Zip'i parça parça açar. Her dosya için `open(name)` çağrılır: hedef döndürürse içerik oraya yazılır,
 * `null` döndürürse dosya atlanır (bilinmeyen / güvenli olmayan adlar).
 */
export async function readZip(
  source: ByteSource,
  open: (name: string) => ByteSink | null,
): Promise<void> {
  let failure: unknown;
  const openSinks = new Set<ByteSink>();
  const unzip = new Unzip((file) => {
    const sink = open(file.name);
    if (!sink) return;
    openSinks.add(sink);
    file.ondata = (error, chunk, final) => {
      if (failure) return;
      if (error) {
        failure = error;
        return;
      }
      try {
        sink.writeBytes(chunk);
        if (final) {
          openSinks.delete(sink);
          sink.close();
        }
      } catch (e) {
        failure = e;
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);

  try {
    let read = 0;
    while (read < source.size) {
      const chunk = source.readBytes(Math.min(CHUNK_SIZE, source.size - read));
      if (chunk.length === 0) throw new Error('Unexpected end of file');
      read += chunk.length;
      unzip.push(chunk, read >= source.size);
      if (failure) throw failure;
      await yieldToUi();
    }
    // Bitmemiş dosya kaldıysa zip kesik.
    if (openSinks.size > 0) throw new Error('Truncated zip');
  } finally {
    for (const sink of openSinks) sink.close();
  }
}

/** Belleğe yazan hedef (zip'teki JSON için). */
export function memorySink(): ByteSink & { text(): string } {
  const chunks: Uint8Array[] = [];
  return {
    writeBytes: (bytes) => void chunks.push(bytes),
    close: () => {},
    text: () => {
      const total = chunks.reduce((sum, c) => sum + c.length, 0);
      const all = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        all.set(chunk, offset);
        offset += chunk.length;
      }
      return strFromU8(all);
    },
  };
}
