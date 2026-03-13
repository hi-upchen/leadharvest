import { createClient, type InArgs, type Row } from '@libsql/client'

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
})

export async function query<T = Row>(sql: string, args: InArgs = []): Promise<T[]> {
  const result = await client.execute({ sql, args })
  return result.rows as T[]
}

export async function execute(
  sql: string,
  args: InArgs = []
): Promise<{ rowsAffected: number; lastInsertRowid?: bigint }> {
  const result = await client.execute({ sql, args })
  return { rowsAffected: result.rowsAffected, lastInsertRowid: result.lastInsertRowid }
}

export { client }
