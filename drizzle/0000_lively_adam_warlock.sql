CREATE TABLE `group_configs` (
	`enabled` integer DEFAULT true NOT NULL,
	`channel_id` text NOT NULL,
	`group_id` text NOT NULL,
	`message` text,
	PRIMARY KEY(`channel_id`, `group_id`)
);
--> statement-breakpoint
CREATE TABLE `threads` (
	`ts` text NOT NULL,
	`channel_id` text NOT NULL,
	`mentioned_groups` text DEFAULT (json_array()) NOT NULL,
	PRIMARY KEY(`channel_id`, `ts`)
);
