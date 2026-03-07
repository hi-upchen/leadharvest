import { sqliteTable, text, integer, unique } from 'drizzle-orm/sqlite-core'

// SQLite-compatible schema (replacing PostgreSQL-specific types)

export const products = sqliteTable('products', {
  id: text('id')
    .$defaultFn(() => crypto.randomUUID())
    .primaryKey(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  description: text('description').notNull(),
  problemsSolved: text('problems_solved').notNull(),
  features: text('features').notNull(),
  targetAudience: text('target_audience').notNull(),
  replyTone: text('reply_tone').notNull().default('helpful and friendly'),
  // promotion_intensity: subtle | moderate | direct
  promotionIntensity: text('promotion_intensity').notNull().default('moderate'),
  // JSON arrays stored as text
  keywords: text('keywords').notNull().default('[]'),
  subreddits: text('subreddits').notNull().default('[]'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
})

export const redditPosts = sqliteTable('reddit_posts', {
  id: text('id')
    .$defaultFn(() => crypto.randomUUID())
    .primaryKey(),
  redditPostId: text('reddit_post_id').notNull(),
  productId: text('product_id')
    .notNull()
    .references(() => products.id),
  subreddit: text('subreddit').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull().default(''),
  author: text('author').notNull(),
  score: integer('score').notNull().default(0),
  commentCount: integer('comment_count').notNull().default(0),
  url: text('url').notNull(),
  // JSON array stored as text
  matchedKeywords: text('matched_keywords').notNull().default('[]'),
  relevanceScore: integer('relevance_score').notNull().default(0),
  // relevance_tier: high | medium | low
  relevanceTier: text('relevance_tier').notNull().default('low'),
  relevanceReason: text('relevance_reason').notNull().default(''),
  // status: new | draft | approved | posted | skipped | bookmarked
  status: text('status').notNull().default('new'),
  redditCreatedAt: text('reddit_created_at').notNull(),
  fetchedAt: text('fetched_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
}, (table) => ({
  // One Reddit post can appear once per product
  uniquePostPerProduct: unique().on(table.redditPostId, table.productId),
}))

export const replyDrafts = sqliteTable('reply_drafts', {
  id: text('id')
    .$defaultFn(() => crypto.randomUUID())
    .primaryKey(),
  postId: text('post_id')
    .notNull()
    .references(() => redditPosts.id),
  productId: text('product_id')
    .notNull()
    .references(() => products.id),
  body: text('body').notNull(),
  version: integer('version').notNull().default(1),
  isApproved: integer('is_approved', { mode: 'boolean' }).notNull().default(false),
  isPosted: integer('is_posted', { mode: 'boolean' }).notNull().default(false),
  approvedAt: text('approved_at'),
  postedAt: text('posted_at'),
  redditCommentId: text('reddit_comment_id'),
  redditCommentUrl: text('reddit_comment_url'),
  commentScore: integer('comment_score'),
  createdAt: text('created_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
})

export const appSettings = sqliteTable('app_settings', {
  id: text('id')
    .$defaultFn(() => crypto.randomUUID())
    .primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  updatedAt: text('updated_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
})

export const scanLogs = sqliteTable('scan_logs', {
  id: text('id')
    .$defaultFn(() => crypto.randomUUID())
    .primaryKey(),
  // triggered_by: manual | scheduled
  triggeredBy: text('triggered_by').notNull().default('scheduled'),
  // status: running | completed | failed
  status: text('status').notNull().default('running'),
  postsFound: integer('posts_found').notNull().default(0),
  newPosts: integer('new_posts').notNull().default(0),
  claudeCalls: integer('claude_calls').notNull().default(0),
  errorMessage: text('error_message'),
  startedAt: text('started_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
  completedAt: text('completed_at'),
})
