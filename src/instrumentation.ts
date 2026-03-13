export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateStartupSecrets } = await import('@/lib/auth')
    validateStartupSecrets()

    // Ensure sessions table exists (auto-migration)
    const { execute } = await import('@/lib/db')
    await execute(`CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`, []).catch(e => {
      console.error('[db] Failed to create sessions table:', e)
    })

    // Clean up expired sessions on startup
    await execute(
      `DELETE FROM sessions WHERE expires_at < datetime('now')`,
      []
    ).catch(() => {})

    // Drop old reply_drafts (had incorrect FK: product_id referenced reddit_posts instead of products)
    await execute(`DROP TABLE IF EXISTS reply_drafts`, []).catch(() => {})

    // Recreate reply_drafts with corrected FK and variant column
    await execute(`CREATE TABLE IF NOT EXISTS reply_drafts (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL REFERENCES reddit_posts(id),
      product_id TEXT NOT NULL REFERENCES products(id),
      body TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      variant INTEGER NOT NULL DEFAULT 1,
      is_approved INTEGER NOT NULL DEFAULT 0,
      is_posted INTEGER NOT NULL DEFAULT 0,
      approved_at TEXT,
      posted_at TEXT,
      reddit_comment_id TEXT,
      reddit_comment_url TEXT,
      comment_score INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(post_id, version, variant)
    )`, []).catch(e => {
      console.error('[db] Failed to create reply_drafts table:', e)
    })
  }
}
