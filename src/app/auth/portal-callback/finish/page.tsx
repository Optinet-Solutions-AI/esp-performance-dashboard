'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// Second half of portal SSO. The server route (../route.ts) verified the token, provisioned +
// approved the user, minted a session, and stashed { access_token, refresh_token } in
// same-origin sessionStorage. Here we use the app's OWN supabase client to write that session
// to localStorage — the exact place useSession()/AuthGate read from — then land on '/'.
export default function PortalSsoFinish() {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false

    const raw = sessionStorage.getItem('portal-sso')
    sessionStorage.removeItem('portal-sso') // one-time use; never leave tokens lying around

    if (!raw) {
      router.replace('/login?error=session')
      return
    }

    let tokens: { access_token?: string; refresh_token?: string }
    try {
      tokens = JSON.parse(raw)
    } catch {
      router.replace('/login?error=session')
      return
    }

    if (!tokens.access_token || !tokens.refresh_token) {
      router.replace('/login?error=session')
      return
    }

    supabase.auth
      .setSession({ access_token: tokens.access_token, refresh_token: tokens.refresh_token })
      .then(({ error }) => {
        if (cancelled) return
        router.replace(error ? '/login?error=session' : '/')
      })

    return () => {
      cancelled = true
    }
  }, [router])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0d12',
        color: '#a8b0be',
        fontFamily: 'Space Mono, monospace',
        fontSize: 12,
        letterSpacing: '0.08em',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            border: '2px solid #00e5c3',
            borderTopColor: 'transparent',
            animation: 'portal-sso-spin 0.8s linear infinite',
            display: 'inline-block',
          }}
        />
        <span style={{ textTransform: 'uppercase' }}>Signing you in…</span>
      </div>
      <style>{`@keyframes portal-sso-spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
