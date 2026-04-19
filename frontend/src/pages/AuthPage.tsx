import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTheme, getTokens } from '../hooks/useTheme'
import { supabase } from '../lib/supabase'
import ThemeToggle from '../components/ThemeToggle'

type Mode = 'login' | 'register'

// ── Input component ────────────────────────────────────────────────────────
function Input({
  label, type = 'text', value, onChange, placeholder, autoComplete, t,
}: {
  label: string; type?: string; value: string
  onChange: (v: string) => void; placeholder?: string
  autoComplete?: string; t: ReturnType<typeof getTokens>
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <label style={{
        display: 'block', fontSize: 13, fontWeight: 500,
        color: t.textSecondary, marginBottom: 8, letterSpacing: '0.01em',
      }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%',
          background: t.inputBg,
          border: `1.5px solid ${focused ? t.inputFocus : t.inputBorder}`,
          borderRadius: 8,
          padding: '12px 16px',
          fontSize: 15,
          color: t.text,
          outline: 'none',
          transition: 'border-color 0.2s',
          fontFamily: 'inherit',
        }}
      />
    </div>
  )
}

// ── OAuth button ───────────────────────────────────────────────────────────
function OAuthButton({
  provider, icon, label, onClick, t,
}: {
  provider: string; icon: React.ReactNode; label: string
  onClick: () => void; t: ReturnType<typeof getTokens>
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        background: hovered ? t.bgTertiary : t.inputBg,
        border: `1.5px solid ${hovered ? t.inputFocus : t.inputBorder}`,
        borderRadius: 8,
        padding: '12px 20px',
        fontSize: 14, fontWeight: 500, color: t.text,
        cursor: 'pointer', fontFamily: 'inherit',
        transition: 'all 0.2s',
      }}
    >
      {icon}
      {label}
    </button>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const { signIn, signUp } = useAuth()
  const { isDark } = useTheme()
  const t = getTokens(isDark)
  const navigate = useNavigate()

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!email || !password) return
    setError(null)
    setSuccess(null)
    setLoading(true)

    if (mode === 'login') {
      const { error } = await signIn(email, password)
      if (error) setError(error)
      else navigate('/dashboard')
    } else {
      if (password.length < 8) {
        setError('Password must be at least 8 characters.')
        setLoading(false)
        return
      }
      const { error } = await signUp(email, password)
      if (error) setError(error)
      else setSuccess('Account created! Check your email to confirm before signing in.')
    }
    setLoading(false)
  }

  const handleOAuth = async (provider: 'google' | 'github') => {
    setOauthLoading(provider)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/dashboard` },
    })
    if (error) {
      setError(error.message)
      setOauthLoading(null)
    }
  }

  const switchMode = (m: Mode) => {
    setMode(m)
    setError(null)
    setSuccess(null)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: t.bg,
      color: t.text,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
      transition: 'background 0.3s, color 0.3s',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        ::selection { background: ${t.text}; color: ${t.bg}; }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: ${t.scrollTrack}; }
        ::-webkit-scrollbar-thumb { background: ${t.scrollThumb}; border-radius: 4px; }
        input::placeholder { color: ${t.textMuted}; }
        input:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 100px ${t.inputBg} inset !important;
          -webkit-text-fill-color: ${t.text} !important;
        }
      `}</style>

      {/* ── Top bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 32px',
        borderBottom: `1px solid ${t.borderLight}`,
      }}>
        <button
          onClick={() => navigate('/')}
          style={{
            fontFamily: "'DM Mono', monospace", fontWeight: 500, fontSize: 16,
            background: 'none', border: 'none', cursor: 'pointer',
            color: t.text, letterSpacing: '-0.5px',
          }}
        >
          DedSec
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 13, color: t.textMuted }}>
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
          </span>
          <button
            onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
            style={{
              fontSize: 13, fontWeight: 500, color: t.text,
              background: 'none', border: `1.5px solid ${t.inputBorder}`,
              borderRadius: 6, padding: '7px 16px', cursor: 'pointer',
              fontFamily: 'inherit', transition: 'border-color 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = t.inputFocus}
            onMouseLeave={e => e.currentTarget.style.borderColor = t.inputBorder}
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
          <ThemeToggle />
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{
        flex: 1, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        padding: '48px 24px',
      }}>
        <div style={{ width: '100%', maxWidth: 420 }}>

          {/* Heading */}
          <div style={{ marginBottom: 36, textAlign: 'center' }}>
            <h1 style={{
              fontSize: 28, fontWeight: 600, letterSpacing: '-1px',
              marginBottom: 8, color: t.text,
            }}>
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h1>
            <p style={{ fontSize: 15, color: t.textSecondary, lineHeight: 1.6 }}>
              {mode === 'login'
                ? 'Sign in to access your scan history and reports.'
                : 'Start scanning repositories for vulnerabilities.'}
            </p>
          </div>

          {/* OAuth buttons */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
            <OAuthButton
              provider="github"
              label={oauthLoading === 'github' ? 'Connecting...' : 'GitHub'}
              onClick={() => handleOAuth('github')}
              t={t}
              icon={
                <svg width="17" height="17" viewBox="0 0 24 24" fill={t.text}>
                  <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                </svg>
              }
            />
            <OAuthButton
              provider="google"
              label={oauthLoading === 'google' ? 'Connecting...' : 'Google'}
              onClick={() => handleOAuth('google')}
              t={t}
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              }
            />
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <div style={{ flex: 1, height: 1, background: t.borderLight }} />
            <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 500, letterSpacing: '0.05em' }}>
              OR
            </span>
            <div style={{ flex: 1, height: 1, background: t.borderLight }} />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {mode === 'register' && (
              <Input label="Full name" value={name} onChange={setName}
                placeholder="Álefe Alexandre" autoComplete="name" t={t} />
            )}
            <Input label="Email address" type="email" value={email} onChange={setEmail}
              placeholder="you@example.com" autoComplete="email" t={t} />
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: t.textSecondary }}>Password</label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!email) { setError('Enter your email first.'); return }
                      const { error } = await supabase.auth.resetPasswordForEmail(email, {
                        redirectTo: `${window.location.origin}/auth`,
                      })
                      if (error) setError(error.message)
                      else setSuccess('Password reset link sent to your email.')
                    }}
                    style={{
                      fontSize: 12, color: t.textMuted, background: 'none',
                      border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      transition: 'color 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = t.text}
                    onMouseLeave={e => e.currentTarget.style.color = t.textMuted}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <Input
                label="" type="password" value={password} onChange={setPassword}
                placeholder={mode === 'register' ? 'Min. 8 characters' : '••••••••••••'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                t={t}
              />
            </div>

            {/* Error / success */}
            {error && (
              <div style={{
                padding: '12px 16px',
                background: isDark ? 'rgba(239,68,68,0.1)' : '#fef2f2',
                border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 8, fontSize: 13, color: '#ef4444',
                display: 'flex', alignItems: 'flex-start', gap: 8,
              }}>
                <span style={{ flexShrink: 0, marginTop: 1 }}>⚠</span>
                {error}
              </div>
            )}
            {success && (
              <div style={{
                padding: '12px 16px',
                background: isDark ? 'rgba(34,197,94,0.1)' : '#f0fdf4',
                border: '1px solid rgba(34,197,94,0.25)',
                borderRadius: 8, fontSize: 13, color: '#16a34a',
                display: 'flex', alignItems: 'flex-start', gap: 8,
              }}>
                <span style={{ flexShrink: 0, marginTop: 1 }}>✓</span>
                {success}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              style={{
                width: '100%',
                background: t.btnPrimary,
                color: t.btnPrimaryTxt,
                padding: '13px 24px',
                borderRadius: 8, fontSize: 15, fontWeight: 500,
                border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                opacity: loading || !email || !password ? 0.5 : 1,
                transition: 'opacity 0.2s, transform 0.15s',
                marginTop: 4,
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}
            >
              {loading
                ? (mode === 'login' ? 'Signing in...' : 'Creating account...')
                : (mode === 'login' ? 'Sign in' : 'Create account')}
            </button>
          </form>

          {/* Footer note */}
          {mode === 'register' && (
            <p style={{ fontSize: 12, color: t.textMuted, textAlign: 'center', marginTop: 20, lineHeight: 1.6 }}>
              By creating an account you agree that this is a graduation project
              and your data is stored securely in Supabase.
            </p>
          )}
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div style={{
        padding: '20px 32px',
        borderTop: `1px solid ${t.borderLight}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 12,
      }}>
        <span style={{ fontSize: 12, color: t.textMuted }}>
          DedSec · Graduation project
        </span>
        <a
          href="https://github.com/Shokzin/dedsec"
          target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 12, color: t.textMuted, textDecoration: 'none', transition: 'color 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.color = t.text}
          onMouseLeave={e => e.currentTarget.style.color = t.textMuted}
        >
          GitHub →
        </a>
      </div>
    </div>
  )
}