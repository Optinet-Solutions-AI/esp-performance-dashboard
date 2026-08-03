import { NextResponse, type NextRequest } from 'next/server'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

// This route runs on the server so it can safely use the service-role key, verify the
// portal's short-lived SSO token, JIT-provision the user, and mint a real Supabase session.
// It hands the resulting tokens to a same-origin client page (see ./finish) which calls
// supabase.auth.setSession() — the app reads its session from localStorage (plain
// @supabase/supabase-js browser client), so a cookie-based flow would never be seen by it.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Fail closed: if PORTAL_ISSUER / SSO_AUDIENCE are unset, jose would treat them as
// "no constraint" and SKIP those checks — a token minted for a DIFFERENT dashboard
// would then be accepted here. Missing env must break the route, not silently loosen it.
// Resolved lazily (at request time, not module load) so `next build` — which imports this
// module to read its config — doesn't fail before the SSO env vars exist.
function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} is required for SSO`)
  return v
}

let cachedConfig: {
  issuer: string
  audience: string
  supabaseUrl: string
  anonKey: string
  serviceRoleKey: string
  jwks: ReturnType<typeof createRemoteJWKSet>
} | null = null

function getConfig() {
  if (cachedConfig) return cachedConfig
  cachedConfig = {
    issuer: requireEnv('PORTAL_ISSUER'),
    audience: requireEnv('SSO_AUDIENCE'),
    supabaseUrl: requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    anonKey: requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    serviceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    jwks: createRemoteJWKSet(new URL(requireEnv('PORTAL_JWKS_URL'))),
  }
  return cachedConfig
}

function bounce(req: NextRequest, code?: string): NextResponse {
  return NextResponse.redirect(new URL(code ? `/login?error=${code}` : '/login', req.url))
}

// admin.auth.admin.listUsers is paginated; page through so lookup works past the first page.
async function findUserByEmail(admin: SupabaseClient, email: string): Promise<User | null> {
  const target = email.toLowerCase()
  const perPage = 200
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const found = data.users.find((u) => u.email?.toLowerCase() === target)
    if (found) return found
    if (data.users.length < perPage) break // last page reached
  }
  return null
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return bounce(req)

  const config = getConfig()

  // 1) Verify the portal's assertion: signature (via JWKS) + issuer + audience + expiry.
  let email: string
  try {
    const { payload } = await jwtVerify(token, config.jwks, {
      issuer: config.issuer,
      audience: config.audience,
    })
    // typeof check, not String(...): String(undefined) === "undefined" (truthy) would
    // silently defeat this guard.
    if (typeof payload.email !== 'string' || payload.email.length === 0) throw new Error('no email claim')
    email = payload.email
  } catch {
    return bounce(req, 'sso')
  }

  const admin = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 2) JIT-provision by email.
  let user: User | null
  try {
    user = await findUserByEmail(admin, email)
  } catch {
    return bounce(req, 'provision')
  }
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true })
    if (error || !data.user) return bounce(req, 'provision')
    user = data.user
  }

  // 2b) Approval gate. Our `profiles` table has status 'pending' | 'approved'; a DB trigger
  //     inserts new users as 'pending' and AuthGate signs out anyone not 'approved'. The portal
  //     is the access authority (no assignment → no token), so a verified token IS the approval:
  //     upsert this user to 'approved' or they'd be created 'pending' and instantly signed out.
  const { error: accessErr } = await admin.from('profiles').upsert(
    { id: user.id, email, status: 'approved', approved_at: new Date().toISOString() },
    { onConflict: 'id' },
  )
  if (accessErr) return bounce(req, 'access')

  // 3) Mint a real Supabase session server-side: generate a magic-link OTP, then verify it with
  //    the anon client to obtain access + refresh tokens. The service-role key never leaves here.
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (linkErr || !link.properties?.hashed_token) return bounce(req, 'session')

  const pub = createClient(config.supabaseUrl, config.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: verified, error: otpErr } = await pub.auth.verifyOtp({
    type: 'magiclink',
    token_hash: link.properties.hashed_token,
  })
  if (otpErr || !verified.session) return bounce(req, 'session')

  // 4) Hand the tokens to the app's OWN client via same-origin sessionStorage, then land on /.
  //    Tokens ride in the HTML body only (never the URL, never a header); the portal token in the
  //    query string never enters history because we replace() rather than navigate.
  const ssoValue = JSON.stringify({
    access_token: verified.session.access_token,
    refresh_token: verified.session.refresh_token,
  })
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Signing in…</title><meta name="robots" content="noindex"></head><body>
<script>
  try { sessionStorage.setItem('portal-sso', ${JSON.stringify(ssoValue)}); } catch (e) {}
  location.replace('/auth/portal-callback/finish');
</script>
<noscript>Enable JavaScript to finish signing in.</noscript>
</body></html>`

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
  })
}
