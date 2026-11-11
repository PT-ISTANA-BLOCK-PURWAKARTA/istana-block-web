ALTER TABLE `articles` ADD `category` text DEFAULT 'Paving & Grass Block' NOT NULL;--> statement-breakpoint
CREATE INDEX `articles_cat_idx` ON `articles` (`published`,`category`,`published_at`);
