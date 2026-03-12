ALTER TABLE `ai_config` ADD `learningSummary` text;--> statement-breakpoint
ALTER TABLE `ai_config` ADD `lastSummaryAt` timestamp;--> statement-breakpoint
ALTER TABLE `ai_config` ADD `replyDelayMin` int DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_config` ADD `replyDelayMax` int DEFAULT 30 NOT NULL;