import { cookies } from 'next/headers'
import { createHmac, timingSafeEqual } from 'crypto'

export const SESSION_COOKIE = 'rmm_session'
const SESSION_VALUE_LENGTH = 64 // HMAC-SHA256 hex

// Known-weak passwords to reject at startup
const WEAK_PASSWORDS = new Set([
  'admin123', 'password', 'password123', '123456', 'admin', 'changeme',
  'qwerty', 'letmein', 'welcome', 'monkey', 'dragon', 'master', 'test',
  'rmm', 'secret', 'reddit',
])

// Known-weak encryption keys to reject
const WEAK_KEYS = new Set([
  '12345678901234567890123456789012',
  '32-character-random-string-here!!',
  'your_encryption_key_here_32chars',
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
])

export function getPassword(): string {
  const pw = process.env.APP_PASSWORD
  if (!pw) throw new Error('APP_PASSWORD env var not set')
  return pw
}

/**
 * Called at startup (instrumentation.ts) to catch misconfiguration early.
 * Logs warnings rather than crashing — the app can still start for first-run setup.
 */
export function validateStartupSecrets(): void {
  const pw = process.env.APP_PASSWORD
  const key = process.env.ENCRYPTION_KEY

  if (!pw || WEAK_PASSWORDS.has(pw.toLowerCase())) {
    console.error(
      '[security] ⚠️  APP_PASSWORD is missing or uses a known-weak value. ' +
      'Set a strong password in .env.local before exposing this app to any network.'
    )
  }

  if (!key || WEAK_KEYS.has(key) || /^(.)\1+$/.test(key)) {
    console.error(
      '[security] ⚠️  ENCRYPTION_KEY is missing or uses a weak/placeholder value. ' +
      'Run setup.sh to auto-generate a secure key.'
    )
  }

  const geminiKey = process.env.GEMINI_API_KEY
  if (geminiKey && geminiKey.startsWith('AIzaSy') && geminiKey === 'AIzaSyDmISK9OSLNo1OBdW_dFyyq_rq3cfx2j3U') {
    console.error(
      '[security] ⚠️  The Gemini API key in .env.local appears to be the shared development key. ' +
      'Rotate it at https://aistudio.google.com/apikey'
    )
  }
}

export function computeSessionToken(): string {
  return createHmac('sha256', getPassword()).update('rmm-session-v1').digest('hex')
}

/**
 * Constant-time session validation.
 * Used by individual API routes for defense-in-depth (middleware already checks).
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE)?.value
    if (!token || token.length !== SESSION_VALUE_LENGTH) return false
    const expected = computeSessionToken()
    return timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(expected, 'hex'))
  } catch {
    return false
  }
}
