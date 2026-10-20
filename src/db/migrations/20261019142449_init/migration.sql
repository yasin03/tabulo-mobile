CREATE TABLE `accounts` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`bank_name` text,
	`iban` text,
	`opening_balance_minor` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'TRY' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `attachments` (
	`id` text PRIMARY KEY,
	`transaction_id` text NOT NULL,
	`file_uri` text NOT NULL,
	`file_name` text,
	`mime_type` text,
	`size_bytes` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_attachments_transaction_id_transactions_id_fk` FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`)
);
--> statement-breakpoint
CREATE TABLE `business_profile` (
	`id` text PRIMARY KEY DEFAULT 'default',
	`name` text DEFAULT '' NOT NULL,
	`phone` text,
	`email` text,
	`city` text,
	`district` text,
	`address` text,
	`tax_number` text,
	`tax_office` text,
	`logo_uri` text,
	`currency` text DEFAULT 'TRY' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY,
	`person_type` text DEFAULT 'individual' NOT NULL,
	`role` text DEFAULT 'customer' NOT NULL,
	`name` text NOT NULL,
	`national_id` text,
	`tax_number` text,
	`tax_office` text,
	`city` text,
	`district` text,
	`address` text,
	`phone` text,
	`email` text,
	`note` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `recurring_payments` (
	`id` text PRIMARY KEY,
	`title` text NOT NULL,
	`movement_type` text DEFAULT 'payment' NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text DEFAULT 'TRY' NOT NULL,
	`account_id` text,
	`transaction_type_id` text,
	`subject_id` text,
	`contact_id` text,
	`frequency` text DEFAULT 'monthly' NOT NULL,
	`interval` integer DEFAULT 1 NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`next_due_date` text NOT NULL,
	`remind_days_before` integer DEFAULT 1 NOT NULL,
	`remind_time` text DEFAULT '09:00' NOT NULL,
	`notification_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_recurring_payments_account_id_accounts_id_fk` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`),
	CONSTRAINT `fk_recurring_payments_transaction_type_id_transaction_types_id_fk` FOREIGN KEY (`transaction_type_id`) REFERENCES `transaction_types`(`id`),
	CONSTRAINT `fk_recurring_payments_subject_id_subjects_id_fk` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`),
	CONSTRAINT `fk_recurring_payments_contact_id_contacts_id_fk` FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`)
);
--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` text PRIMARY KEY,
	`contact_id` text NOT NULL,
	`transaction_id` text,
	`remind_date` text NOT NULL,
	`remind_time` text DEFAULT '09:00' NOT NULL,
	`note` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`notification_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_reminders_contact_id_contacts_id_fk` FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`),
	CONSTRAINT `fk_reminders_transaction_id_transactions_id_fk` FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`)
);
--> statement-breakpoint
CREATE TABLE `subjects` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`is_system` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `transaction_types` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`direction` text NOT NULL,
	`icon` text,
	`color` text,
	`is_system` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY,
	`movement_type` text NOT NULL,
	`account_id` text,
	`transaction_type_id` text,
	`subject_id` text,
	`contact_id` text,
	`date` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text DEFAULT 'TRY' NOT NULL,
	`description` text,
	`document_no` text,
	`due_date` text,
	`opening_direction` text,
	`recurring_payment_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_transactions_account_id_accounts_id_fk` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`),
	CONSTRAINT `fk_transactions_transaction_type_id_transaction_types_id_fk` FOREIGN KEY (`transaction_type_id`) REFERENCES `transaction_types`(`id`),
	CONSTRAINT `fk_transactions_subject_id_subjects_id_fk` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`),
	CONSTRAINT `fk_transactions_contact_id_contacts_id_fk` FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`),
	CONSTRAINT `fk_transactions_recurring_payment_id_recurring_payments_id_fk` FOREIGN KEY (`recurring_payment_id`) REFERENCES `recurring_payments`(`id`)
);
--> statement-breakpoint
CREATE INDEX `attachments_tx_idx` ON `attachments` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `contacts_name_idx` ON `contacts` (`name`);--> statement-breakpoint
CREATE INDEX `contacts_status_idx` ON `contacts` (`status`);--> statement-breakpoint
CREATE INDEX `recurring_next_idx` ON `recurring_payments` (`status`,`next_due_date`);--> statement-breakpoint
CREATE INDEX `reminders_status_date_idx` ON `reminders` (`status`,`remind_date`);--> statement-breakpoint
CREATE INDEX `tx_contact_date_idx` ON `transactions` (`contact_id`,`date`);--> statement-breakpoint
CREATE INDEX `tx_account_date_idx` ON `transactions` (`account_id`,`date`);--> statement-breakpoint
CREATE INDEX `tx_date_idx` ON `transactions` (`date`);--> statement-breakpoint
CREATE INDEX `tx_type_idx` ON `transactions` (`transaction_type_id`);--> statement-breakpoint
CREATE INDEX `tx_subject_idx` ON `transactions` (`subject_id`);--> statement-breakpoint
CREATE INDEX `tx_due_idx` ON `transactions` (`due_date`);