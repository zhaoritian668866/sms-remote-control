CREATE TABLE `pinned_contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deviceId` int NOT NULL,
	`phoneNumber` varchar(32) NOT NULL,
	`pinnedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pinned_contacts_id` PRIMARY KEY(`id`)
);
