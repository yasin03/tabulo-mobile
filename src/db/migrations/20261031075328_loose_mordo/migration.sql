ALTER TABLE `transactions` ADD `is_cash` integer DEFAULT false NOT NULL;--> statement-breakpoint
-- Elle eklendi: düzenli ödemeden gelen cari hareketleri peşindir (kira vb. cari bakiyesini etkilemez).
UPDATE `transactions` SET `is_cash` = 1 WHERE `recurring_payment_id` IS NOT NULL AND `contact_id` IS NOT NULL AND `movement_type` IN ('collection', 'payment');
