ALTER TABLE `messages` ADD `messageType` enum('text','image') DEFAULT 'text' NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` ADD `imageUrl` varchar(1024);