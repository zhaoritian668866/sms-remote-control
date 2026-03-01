CREATE TABLE `devices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`deviceId` varchar(64) NOT NULL,
	`name` varchar(128) NOT NULL,
	`phoneModel` varchar(128),
	`androidVersion` varchar(32),
	`phoneNumber` varchar(32),
	`isOnline` boolean NOT NULL DEFAULT false,
	`batteryLevel` int,
	`signalStrength` int,
	`lastSeen` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `devices_id` PRIMARY KEY(`id`),
	CONSTRAINT `devices_deviceId_unique` UNIQUE(`deviceId`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deviceId` int NOT NULL,
	`direction` enum('incoming','outgoing') NOT NULL,
	`phoneNumber` varchar(32) NOT NULL,
	`contactName` varchar(128),
	`body` text NOT NULL,
	`status` enum('pending','sent','delivered','failed','received') NOT NULL DEFAULT 'received',
	`smsTimestamp` bigint NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pairing_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`token` varchar(128) NOT NULL,
	`wsUrl` varchar(512) NOT NULL,
	`status` enum('pending','paired','expired') NOT NULL DEFAULT 'pending',
	`deviceId` int,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pairing_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `pairing_tokens_token_unique` UNIQUE(`token`)
);
