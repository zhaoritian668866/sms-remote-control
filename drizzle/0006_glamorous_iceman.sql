CREATE TABLE `bulk_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`deviceId` int NOT NULL,
	`mode` enum('round_robin','random') NOT NULL DEFAULT 'round_robin',
	`intervalSeconds` int NOT NULL DEFAULT 10,
	`templateIds` text NOT NULL,
	`contacts` text NOT NULL,
	`totalCount` int NOT NULL DEFAULT 0,
	`currentIndex` int NOT NULL DEFAULT 0,
	`successCount` int NOT NULL DEFAULT 0,
	`failCount` int NOT NULL DEFAULT 0,
	`status` enum('pending','running','paused','completed','cancelled') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bulk_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `device_contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`deviceId` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`phoneNumber` varchar(32) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `device_contacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sms_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`content` text NOT NULL,
	`label` varchar(128),
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sms_templates_id` PRIMARY KEY(`id`)
);
