CREATE TABLE `contact_read_status` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deviceId` int NOT NULL,
	`phoneNumber` varchar(32) NOT NULL,
	`lastReadAt` bigint NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contact_read_status_id` PRIMARY KEY(`id`)
);
