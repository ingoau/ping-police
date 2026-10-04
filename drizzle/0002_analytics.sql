CREATE TABLE `channel_settings` (
	`channel_id` text PRIMARY KEY NOT NULL,
	`analytics_enabled` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `warnings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`channel_id` text NOT NULL,
	`thread_ts` text NOT NULL,
	`user_id` text NOT NULL,
	`group_id` text NOT NULL,
	`warned_at` integer NOT NULL,
	`ignored_at` integer
);
--> statement-breakpoint
CREATE INDEX `warnings_channel_group_idx` ON `warnings` (`channel_id`,`group_id`);--> statement-breakpoint
CREATE INDEX `warnings_thread_user_idx` ON `warnings` (`channel_id`,`thread_ts`,`user_id`);