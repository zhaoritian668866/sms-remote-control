CREATE TABLE `ai_learning_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('realtime','history') NOT NULL,
	`status` enum('running','completed','failed') NOT NULL DEFAULT 'running',
	`newCount` int NOT NULL DEFAULT 0,
	`totalCount` int NOT NULL DEFAULT 0,
	`scannedCount` int NOT NULL DEFAULT 0,
	`filteredCount` int NOT NULL DEFAULT 0,
	`duplicateCount` int NOT NULL DEFAULT 0,
	`phoneNumbers` text,
	`errorMessage` text,
	`durationMs` int,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `ai_learning_logs_id` PRIMARY KEY(`id`)
);
