import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useTheme, getTokens } from '../../hooks/useTheme'
import { supabase } from '../../lib/supabase'
import ThemeToggle from '../ThemeToggle'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, signOut } = useAuth()
  const { isDark } = useTheme()
  const t = getTokens(isDark)
  const [signingOut, setSigningOut] = useState(false)

  // ── Live display name + avatar ─────────────────────────────────────────
  // We keep local state and subscribe to auth changes so the nav updates
  // immediately when the user saves changes in the Profile page.
  const [displayName, setDisplayName] = useState(
    user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Account'
  )
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    user?.user_metadata?.avatar_url ?? null
  )

  useEffect(() => {
    // Sync from initial user object
    if (user) {
      setDisplayName(user.user_metadata?.display_name || user.email?.split('@')[0] || 'Account')
      setAvatarUrl(user.user_metadata?.avatar_url ?? null)
    }
  }, [user])

  useEffect(() => {
    // Subscribe to auth state changes (fires after updateUser / refreshSession)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const u = session.user
        setDisplayName(u.user_metadata?.display_name || u.email?.split('@')[0] || 'Account')
        setAvatarUrl(u.user_metadata?.avatar_url ?? null)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    setSigningOut(true)
    await signOut()
    navigate('/')
  }

  const isActive = (path: string) => location.pathname === path

  const navItem = (path: string, label: string) => (
    <button key={path} onClick={() => navigate(path)} style={{
      fontSize: 14,
      fontWeight: isActive(path) ? 500 : 400,
      color: isActive(path) ? t.text : t.textSecondary,
      background: 'none', border: 'none', cursor: 'pointer',
      fontFamily: 'inherit', padding: '4px 0',
      borderBottom: `2px solid ${isActive(path) ? t.text : 'transparent'}`,
      transition: 'color 0.2s, border-color 0.2s',
    }}
      onMouseEnter={e => { if (!isActive(path)) e.currentTarget.style.color = t.text }}
      onMouseLeave={e => { if (!isActive(path)) e.currentTarget.style.color = t.textSecondary }}
    >
      {label}
    </button>
  )

  return (
    <div style={{
      minHeight: '100vh', background: t.bg, color: t.text,
      fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
      transition: 'background 0.3s, color 0.3s',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: ${t.scrollTrack}; }
        ::-webkit-scrollbar-thumb { background: ${t.scrollThumb}; border-radius: 4px; }
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>

      <nav style={{
        borderBottom: `1px solid ${t.borderLight}`,
        padding: '0 5%', background: t.bg,
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto', height: 60,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            {/* Logo → landing page */}
            <button onClick={() => navigate('/')} style={{
              fontFamily: "'DM Mono', monospace", fontWeight: 500, fontSize: 16,
              color: t.text, background: 'none', border: 'none', cursor: 'pointer',
              letterSpacing: '-0.5px', transition: 'opacity 0.2s',
            }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              title="Back to home"
            >
              DedSec
            </button>
            <div style={{ display: 'flex', gap: 24 }}>
              {navItem('/dashboard', 'Dashboard')}
              {navItem('/scan', 'New scan')}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ThemeToggle />

            {/* Profile button with live avatar */}
            <button onClick={() => navigate('/profile')} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: isActive('/profile') ? t.bgTertiary : 'none',
              border: `1.5px solid ${isActive('/profile') ? t.border : 'transparent'}`,
              borderRadius: 6, padding: '5px 10px', cursor: 'pointer',
              fontFamily: 'inherit', transition: 'all 0.2s',
            }}
              onMouseEnter={e => {
                e.currentTarget.style.background = t.bgTertiary
                e.currentTarget.style.borderColor = t.border
              }}
              onMouseLeave={e => {
                if (!isActive('/profile')) {
                  e.currentTarget.style.background = 'none'
                  e.currentTarget.style.borderColor = 'transparent'
                }
              }}
            >
              {/* Avatar circle */}
              <div style={{
                width: 26, height: 26, borderRadius: '50%',
                background: avatarUrl ? 'transparent' : t.text,
                color: t.bg, overflow: 'hidden', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700,
                border: `1.5px solid ${t.border}`,
              }}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  displayName.charAt(0).toUpperCase()
                )}
              </div>
              <span style={{ fontSize: 13, fontWeight: 500, color: t.text, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {displayName}
              </span>
            </button>

            <button onClick={handleSignOut} disabled={signingOut} style={{
              fontSize: 13, fontWeight: 500, color: t.textSecondary,
              background: 'none', border: `1.5px solid ${t.border}`,
              borderRadius: 6, padding: '6px 14px', cursor: 'pointer',
              fontFamily: 'inherit', transition: 'color 0.2s, border-color 0.2s',
            }}
              onMouseEnter={e => { e.currentTarget.style.color = t.text; e.currentTarget.style.borderColor = t.text }}
              onMouseLeave={e => { e.currentTarget.style.color = t.textSecondary; e.currentTarget.style.borderColor = t.border }}
            >
              {signingOut ? 'Signing out...' : 'Sign out'}
            </button>
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 5%' }}>
        {children}
      </main>
    </div>
  )
}