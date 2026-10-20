import type { FieldErrors, FieldValues, Resolver } from 'react-hook-form';
import type { z } from 'zod';

/**
 * react-hook-form için küçük zod resolver'ı (düz alanlı formlar).
 * `@hookform/resolvers` isteğe bağlı peer bağımlılıkları drizzle-orm ile çakıştığı için kullanılmıyor.
 * Hata mesajları çeviri anahtarıdır; ekranda `t(error.message)` ile gösterilir.
 */
export function zodResolver<TInput extends FieldValues, TOutput>(
  schema: z.ZodType<TOutput, TInput>,
): Resolver<TInput, unknown, TOutput> {
  return async (values) => {
    const result = await schema.safeParseAsync(values);
    if (result.success) return { values: result.data, errors: {} };

    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join('.');
      errors[path] ??= { type: issue.code, message: issue.message };
    }
    return { values: {}, errors: errors as FieldErrors<TInput> };
  };
}
