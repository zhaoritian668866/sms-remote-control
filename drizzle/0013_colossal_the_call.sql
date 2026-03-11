CREATE TABLE `ai_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`apiUrl` varchar(512) NOT NULL,
	`apiKey` varchar(512) NOT NULL,
	`modelName` varchar(128) NOT NULL,
	`isEnabled` boolean NOT NULL DEFAULT false,
	`bannedWords` text,
	`bannedWordReplacements` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deviceId` int NOT NULL,
	`phoneNumber` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`currentRound` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`customerAge` int,
	`customerJob` varchar(128),
	`customerIncome` varchar(128),
	`customerMaritalStatus` varchar(64),
	`conversationHistory` text,
	`hasGuidedToApp` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_user_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`isEnabled` boolean NOT NULL DEFAULT false,
	`personaName` varchar(64) NOT NULL DEFAULT '小美',
	`targetApp` varchar(128) NOT NULL DEFAULT '微信',
	`targetAppId` varchar(256),
	`customPrompt` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_user_settings_id` PRIMARY KEY(`id`)
);
