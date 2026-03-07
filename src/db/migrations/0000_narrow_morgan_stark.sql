CREATE TABLE `app_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_settings_key_unique` ON `app_settings` (`key`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`description` text NOT NULL,
	`problems_solved` text NOT NULL,
	`features` text NOT NULL,
	`target_audience` text NOT NULL,
	`reply_tone` text DEFAULT 'helpful and friendly' NOT NULL,
	`promotion_intensity` text DEFAULT 'moderate' NOT NULL,
	`keywords` text DEFAULT '[]' NOT NULL,
	`subreddits` text DEFAULT '[]' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reddit_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`reddit_post_id` text NOT NULL,
	`product_id` text NOT NULL,
	`subreddit` text NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`author` text NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`comment_count` integer DEFAULT 0 NOT NULL,
	`url` text NOT NULL,
	`matched_keywords` text DEFAULT '[]' NOT NULL,
	`relevance_score` integer DEFAULT 0 NOT NULL,
	`relevance_tier` text DEFAULT 'low' NOT NULL,
	`relevance_reason` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`reddit_created_at` text NOT NULL,
	`fetched_at` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reddit_posts_reddit_post_id_product_id_unique` ON `reddit_posts` (`reddit_post_id`,`product_id`);--> statement-breakpoint
CREATE TABLE `reply_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`product_id` text NOT NULL,
	`body` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`is_approved` integer DEFAULT false NOT NULL,
	`is_posted` integer DEFAULT false NOT NULL,
	`approved_at` text,
	`posted_at` text,
	`reddit_comment_id` text,
	`reddit_comment_url` text,
	`comment_score` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `reddit_posts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `scan_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`triggered_by` text DEFAULT 'scheduled' NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`posts_found` integer DEFAULT 0 NOT NULL,
	`new_posts` integer DEFAULT 0 NOT NULL,
	`claude_calls` integer DEFAULT 0 NOT NULL,
	`error_message` text,
	`started_at` text NOT NULL,
	`completed_at` text
);
