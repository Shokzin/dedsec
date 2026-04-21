import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useTheme, getTokens } from '../../hooks/useTheme'
import ThemeToggle from '../ThemeToggle'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, signOut } = useAuth()
  const { isDark } = useTheme()
  const t = getTokens(isDark)
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    setSigningOut(true)
    await signOut()
    navigate('/')
  }

  const isActive = (path: string) => location.pathname === path

  const navItem = (path: string, label: string) => (
    <button
      onClick={() => navigate(path)}
      style={{
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

      {/* Nav */}
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
            {/* Logo → navigates to landing page */}
            <button
              onClick={() => navigate('/')}
              style={{
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 13, color: t.textMuted }}>
              {user?.email}
            </span>
            <ThemeToggle />
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              style={{
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