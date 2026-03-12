ALTER TABLE `ai_config` ADD `learningEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_config` ADD `learnedCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_config` ADD `lastLearnedAt` timestamp;--> statement-breakpoint
ALTER TABLE `ai_config` ADD `learnedSamples` text;