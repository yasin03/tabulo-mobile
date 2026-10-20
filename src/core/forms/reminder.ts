// Tahsilat hatırlatıcısı formu (PROMPT.md 6.6). Hata mesajları çeviri anahtarıdır.

import { z } from 'zod';

import { isTimeOfDay } from '../dates';
import { isIsoDate } from '../validation';

export const REMINDER_NOTE_MAX_LENGTH = 300;

export interface ReminderFormValues {
  remindDate: string;
  remindTime: string;
  note: string;
}

export interface ReminderFormOutput {
  remindDate: string;
  remindTime: string;
  note: string | null;
}

/**
 * @param now Yerel `{ date, time }`: geçmiş bir zamana hatırlatıcı kurulamaz (bildirim hiç gelmezdi).
 */
export function createReminderFormSchema(options: { now: { date: string; time: string } }) {
  const nowKey = `${options.now.date}T${options.now.time}`;
  return z
    .object({ remindDate: z.string(), remindTime: z.string(), note: z.string() })
    .superRefine((v, ctx) => {
      const issue = (path: keyof ReminderFormValues, message: string) =>
        ctx.addIssue({ code: 'custom', path: [path], message });
      const dateOk = isIsoDate(v.remindDate);
      const timeOk = isTimeOfDay(v.remindTime);
      if (!dateOk) issue('remindDate', 'validation.dateInvalid');
      if (!timeOk) issue('remindTime', 'validation.timeInvalid');
      if (dateOk && timeOk && `${v.remindDate}T${v.remindTime}` <= nowKey) {
        issue('remindTime', 'validation.timeInPast');
      }
      if (v.note.trim().length > REMINDER_NOTE_MAX_LENGTH) issue('note', 'validation.tooLong');
    })
    .transform((v): ReminderFormOutput => ({
      remindDate: v.remindDate,
      remindTime: v.remindTime,
      note: v.note.trim() || null,
    }));
}
