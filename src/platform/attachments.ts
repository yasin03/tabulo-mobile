// Belge dosyaları (6.4, Bölüm 9.3): fotoğraf çek / galeriden seç / PDF seç, küçült, belgeler klasörüne kopyala.
// Dosyalar kimlikle adlandırılır (`attachments/<id>.jpg`); veritabanına belgeler klasörüne göre GÖRELİ yol yazılır,
// çünkü iOS'ta uygulama klasörünün mutlak yolu güncellemelerde değişir.

import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { v7 as uuidv7 } from 'uuid';

import type { AttachmentInput } from '@/db/repositories';

export const ATTACHMENTS_FOLDER = 'attachments';
/** Fotoğrafların uzun kenarı en fazla (px). */
const MAX_IMAGE_EDGE = 1600;
const JPEG_QUALITY = 0.7;

export type AttachmentKind = 'image' | 'pdf';

/** Seçilmiş ama henüz kaydedilmemiş belge (geçici klasördeki dosya). */
export interface PendingAttachment {
  id: string;
  kind: AttachmentKind;
  /** Önizleme için geçici dosya. */
  uri: string;
  fileName: string | null;
  width?: number;
  height?: number;
}

export function attachmentKind(mimeType: string | null | undefined): AttachmentKind {
  return mimeType === 'application/pdf' ? 'pdf' : 'image';
}

/** Kayıttaki (göreli) yolu açılabilir `file://` adresine çevirir. */
export function resolveAttachmentUri(fileUri: string): string {
  if (/^[a-z]+:\/\//i.test(fileUri)) return fileUri;
  return new File(Paths.document, fileUri).uri;
}

// ---------- Seçme ----------

export type CameraPermission = 'granted' | 'undetermined' | 'denied';

export async function cameraPermission(): Promise<CameraPermission> {
  const status = await ImagePicker.getCameraPermissionsAsync();
  if (status.granted) return 'granted';
  return status.canAskAgain ? 'undetermined' : 'denied';
}

export async function requestCameraPermission(): Promise<boolean> {
  return (await ImagePicker.requestCameraPermissionsAsync()).granted;
}

function fromImageAssets(assets: ImagePicker.ImagePickerAsset[]): PendingAttachment[] {
  return assets.map((asset) => ({
    id: uuidv7(),
    kind: 'image',
    uri: asset.uri,
    fileName: asset.fileName ?? null,
    width: asset.width || undefined,
    height: asset.height || undefined,
  }));
}

/** Kamera izni önceden alınmış olmalı (izin açıklaması arayüzde gösterilir, 8.6). */
export async function takePhoto(): Promise<PendingAttachment[]> {
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 1 });
  return result.canceled ? [] : fromImageAssets(result.assets);
}

/** Sistem fotoğraf seçicisi (iOS PHPicker / Android Photo Picker) izin gerektirmez. */
export async function pickPhotos(): Promise<PendingAttachment[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    allowsMultipleSelection: true,
    quality: 1,
  });
  return result.canceled ? [] : fromImageAssets(result.assets);
}

export async function pickPdfs(): Promise<PendingAttachment[]> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return [];
  return result.assets.map((asset) => ({
    id: uuidv7(),
    kind: 'pdf',
    uri: asset.uri,
    fileName: asset.name ?? null,
  }));
}

// ---------- Kaydetme ----------

function attachmentsDirectory(): Directory {
  const directory = new Directory(Paths.document, ATTACHMENTS_FOLDER);
  directory.create({ idempotent: true, intermediates: true });
  return directory;
}

/** Fotoğrafı uzun kenarı en fazla `maxEdge` px olacak şekilde küçültüp JPEG (~0.7) olarak kaydeder. */
async function compressImage(
  pending: PendingAttachment,
  maxEdge = MAX_IMAGE_EDGE,
): Promise<string> {
  const context = ImageManipulator.manipulate(pending.uri);
  const { width = 0, height = 0 } = pending;
  if (Math.max(width, height) > maxEdge || width === 0 || height === 0) {
    // Boyut bilinmiyorsa genişliğe göre sınırla; küçük görsel büyütülmez diye boyut biliniyorsa kontrol edilir.
    context.resize(
      height > width ? { width: null, height: maxEdge } : { width: maxEdge, height: null },
    );
  }
  const image = await context.renderAsync();
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });
  return result.uri;
}

/**
 * Geçici dosyayı belgeler klasörüne kopyalar (fotoğrafı önce küçültür) ve veritabanı kaydını döner.
 * Kayıt başarısız olursa çağıran `deleteStoredAttachment` ile dosyayı siler.
 */
export async function storeAttachment(pending: PendingAttachment): Promise<AttachmentInput> {
  const directory = attachmentsDirectory();
  const isPdf = pending.kind === 'pdf';
  const relative = `${ATTACHMENTS_FOLDER}/${pending.id}.${isPdf ? 'pdf' : 'jpg'}`;
  const target = new File(directory, `${pending.id}.${isPdf ? 'pdf' : 'jpg'}`);

  if (isPdf) {
    await new File(pending.uri).copy(target);
  } else {
    const compressed = new File(await compressImage(pending));
    await compressed.move(target);
  }

  return {
    id: pending.id,
    fileUri: relative,
    fileName: pending.fileName,
    mimeType: isPdf ? 'application/pdf' : 'image/jpeg',
    sizeBytes: target.size || null,
  };
}

export function deleteStoredAttachment(fileUri: string) {
  try {
    const file = new File(resolveAttachmentUri(fileUri));
    if (file.exists) file.delete();
  } catch {
    // Dosya zaten yoksa yapılacak bir şey yok.
  }
}

// ---------- İşletme logosu (PDF başlığı, 10.1) ----------

const LOGO_FOLDER = 'logo';
const LOGO_MAX_EDGE = 512;

/** Galeriden tek görsel seçer (izin gerektirmez). */
export async function pickLogo(): Promise<PendingAttachment | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 1 });
  return result.canceled ? null : (fromImageAssets(result.assets)[0] ?? null);
}

/** Logoyu küçültüp `logo/<id>.jpg` olarak kaydeder; göreli yolu döner. */
export async function storeLogo(pending: PendingAttachment): Promise<string> {
  const directory = new Directory(Paths.document, LOGO_FOLDER);
  directory.create({ idempotent: true, intermediates: true });
  const target = new File(directory, `${pending.id}.jpg`);
  await new File(await compressImage(pending, LOGO_MAX_EDGE)).move(target);
  return `${LOGO_FOLDER}/${pending.id}.jpg`;
}

/** PDF'i (veya görseli) sistemin paylaş / önizle ekranında açar. */
export async function openWithSystem(fileUri: string, mimeType: string | null) {
  const uri = resolveAttachmentUri(fileUri);
  if (!(await Sharing.isAvailableAsync())) return;
  await Sharing.shareAsync(uri, {
    mimeType: mimeType ?? undefined,
    UTI: mimeType === 'application/pdf' ? 'com.adobe.pdf' : undefined,
  });
}
