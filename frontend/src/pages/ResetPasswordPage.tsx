import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useTheme, getTokens } from '../hooks/useTheme'

export default function ResetPasswordPage() {
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [ready, setReady] = useState(false)

  const { isDark } = useTheme()
  const t = getTokens(isDark)
  const navigate = useNavigate()

  useEffect(() => {
    const hash = window.location.hash
    const params = new URLSearchParams(hash.replace('#', ''))

    if (params.get('error') || params.get('error_code')) {
      setError('Reset link expired. Please request a new one.')
      window.history.replaceState(null, '', '/reset-password')
      return
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setReady(true)
        window.history.replaceState(null, '', '/reset-password')
      }
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setReady(true)
        window.history.replaceState(null, '', '/reset-password')
      }
    })

    const timeout = setTimeout(() => {
      setReady(prev => {
        if (!prev) setError('Reset link expired. Please request a new one.')
        return prev
      })
      window.history.replaceState(null, '', '/reset-password')
    }, 3000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  const handleSubmit = async () => {
    setError(null)
    if (newPw.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (newPw !== confirmPw) { setError('Passwords do not match.'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPw })
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
      setTimeout(() => navigate('/dashboard'), 2000)
    }
  }

  const inputStyle = {
    width: '100%', background: t.inputBg,
    border: `1.5px solid ${t.inputBorder}`,
    borderRadius: 8, padding: '12px 16px', fontSize: 15,
    color: t.text, outline: 'none', fontFamily: 'inherit',
  }

  return (
    <div style={{
      minHeight: '100vh', background: t.bg, color: t.text,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
    }}>
      <div style={{ width: '100%', maxWidth: 400, padding: '0 24px' }}>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔐</div>
          <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-1px', marginBottom: 8 }}>
            Set new password
          </h1>
          <p style={{ fontSize: 15, color: t.textSecondary }}>
            {ready ? 'Choose a strong new password for your account.' : 'Verifying your reset link...'}
          </p>
        </div>

        {!ready && !error && (
          <div style={{ textAlign: 'center', color: t.textMuted, fontSize: 14 }}>
            ⏳ Loading...
          </div>
        )}

        {ready && !success && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: t.textSecondary, marginBottom: 8 }}>
                New password
              </label>
              <input
                type="password" value={newPw}
                onChange={e => setNewPw(e.target.value)}
                placeholder="Min. 8 characters"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: t.textSecondary, marginBottom: 8 }}>
                Confirm new password
              </label>
              <input
                type="password" value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                placeholder="Repeat new password"
                style={inputStyle}
              />
            </div>

            {error && (
              <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, fontSize: 13, color: '#ef4444' }}>
                ⚠ {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading || !newPw || !confirmPw}
              style={{
                width: '100%', background: t.btnPrimary, color: t.btnPrimaryTxt,
                padding: '13px 24px', borderRadius: 8, fontSize: 15, fontWeight: 500,
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                opacity: loading || !newPw || !confirmPw ? 0.5 : 1,
              }}
            >
              {loading ? 'Updating...' : 'Update password'}
            </button>
          </div>
        )}

        {success && (
          <div style={{ textAlign: 'center', padding: '20px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 12 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
            <p style={{ color: '#16a34a', fontWeight: 500 }}>Password updated! Redirecting...</p>
          </div>
        )}

        {error && !ready && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#ef4444', marginBottom: 16, fontSize: 14 }}>⚠ {error}</p>
            <button onClick={() => navigate('/auth')} style={{ color: t.textMuted, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, textDecoration: 'underline' }}>
              Back to login
            </button>
          </div>
        )}
      </div>
    </div>
  )
}