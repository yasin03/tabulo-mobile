// Hareketlere bağlı belgeler (fotoğraf / PDF). Dosyanın kendisi src/platform/attachments.ts'de yönetilir;
// burada yalnızca kayıtları tutulur. `fileUri` belgeler klasörüne göre GÖRELİ yoldur (`attachments/<id>.jpg`):
// iOS uygulama klasörünün mutlak yolu güncellemelerde değişir.

import { and, asc, eq, inArray, isNull } from 'drizzle-orm';

import { attachments } from '../schema';
import type { Attachment, Db, DbOrTx } from '../types';
import { requireRow } from './shared';

export interface AttachmentInput {
  /** Dosya adı da bu kimlikten üretilir (Bölüm 9.5); bu yüzden kimliği çağıran verir. */
  id: string;
  fileUri: string;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
}

const a = attachments;

export function insertAttachments(
  db: DbOrTx,
  transactionId: string,
  items: readonly AttachmentInput[],
) {
  if (items.length === 0) return;
  db.insert(a)
    .values(
      items.map((item) => ({
        id: item.id,
        transactionId,
        fileUri: item.fileUri,
        fileName: item.fileName ?? null,
        mimeType: item.mimeType ?? null,
        sizeBytes: item.sizeBytes ?? null,
      })),
    )
    .run();
}

/** Yalnızca verilen harekete ait belgeleri yumuşak siler. */
export function softDeleteAttachments(db: DbOrTx, transactionId: string, ids: readonly string[]) {
  if (ids.length === 0) return;
  db.update(a)
    .set({ deletedAt: new Date() })
    .where(and(eq(a.transactionId, transactionId), inArray(a.id, [...ids]), isNull(a.deletedAt)))
    .run();
}

export function listAttachmentsSync(db: DbOrTx, transactionId: string): Attachment[] {
  return db
    .select()
    .from(a)
    .where(and(eq(a.transactionId, transactionId), isNull(a.deletedAt)))
    .orderBy(asc(a.createdAt), asc(a.id))
    .all();
}

export function createAttachmentsRepo(db: Db) {
  return {
    async listForTransaction(transactionId: string): Promise<Attachment[]> {
      return listAttachmentsSync(db, transactionId);
    },

    async getById(id: string): Promise<Attachment> {
      return requireRow(
        db
          .select()
          .from(a)
          .where(and(eq(a.id, id), isNull(a.deletedAt)))
          .all()[0],
      );
    },
  };
}

export type AttachmentsRepo = ReturnType<typeof createAttachmentsRepo>;
