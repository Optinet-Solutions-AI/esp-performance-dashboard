import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import type { GET as GetHandler } from '../route'

// Mock the crypto + Supabase layers so we exercise the route's control flow (especially the
// fail-closed token path) without a live JWKS endpoint or Supabase project.
const jwtVerify = vi.fn()
vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(() => 'JWKS'),
  jwtVerify: (...args: unknown[]) => jwtVerify(...args),
}))
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({})),
}))

let GET: typeof GetHandler

beforeAll(async () => {
  // Env must be present before the route module loads (module-level requireEnv throws otherwise).
  process.env.PORTAL_JWKS_URL = 'https://portal.example/api/sso/jwks'
  process.env.PORTAL_ISSUER = 'https://portal.example'
  process.env.SSO_AUDIENCE = 'aud-123'
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
  ;({ GET } = await import('../route'))
})

beforeEach(() => {
  jwtVerify.mockReset()
})

function request(path: string) {
  // Minimal shape the handler reads: nextUrl.searchParams + url.
  const url = new URL(path, 'https://app.example')
  return { nextUrl: url, url: url.toString() } as unknown as Parameters<typeof GET>[0]
}

function location(res: Awaited<ReturnType<typeof GET>>) {
  return res.headers.get('location') ?? ''
}

describe('portal-callback GET — fail closed', () => {
  it('redirects to /login when no token is present (no verification attempted)', async () => {
    const res = await GET(request('/auth/portal-callback'))
    expect(res.status).toBeGreaterThanOrEqual(300)
    expect(res.status).toBeLessThan(400)
    expect(location(res)).toContain('/login')
    expect(location(res)).not.toContain('error=')
    expect(jwtVerify).not.toHaveBeenCalled()
  })

  it('bounces to /login?error=sso when token verification fails', async () => {
    jwtVerify.mockRejectedValueOnce(new Error('bad signature'))
    const res = await GET(request('/auth/portal-callback?token=forged'))
    expect(location(res)).toContain('/login?error=sso')
  })

  it('enforces issuer + audience constraints (what stops another dashboard’s token)', async () => {
    jwtVerify.mockRejectedValueOnce(new Error('bad'))
    await GET(request('/auth/portal-callback?token=forged'))
    expect(jwtVerify).toHaveBeenCalledWith(
      'forged',
      'JWKS',
      expect.objectContaining({ issuer: 'https://portal.example', audience: 'aud-123' }),
    )
  })

  it('bounces to /login?error=sso when the verified token has no email claim', async () => {
    jwtVerify.mockResolvedValueOnce({ payload: {} })
    const res = await GET(request('/auth/portal-callback?token=valid-but-no-email'))
    expect(location(res)).toContain('/login?error=sso')
  })
})
