CREATE TABLE `groups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`groupCode` varchar(32) NOT NULL,
	`name` varchar(128) NOT NULL,
	`maxDevices` int NOT NULL DEFAULT 10,
	`isActive` boolean NOT NULL DEFAULT true,
	`adminUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `groups_id` PRIMARY KEY(`id`),
	CONSTRAINT `groups_groupCode_unique` UNIQUE(`groupCode`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','superadmin') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` ADD `groupId` int;