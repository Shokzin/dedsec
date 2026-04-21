import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme, getTokens } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import AppLayout from '../components/Layout/AppLayout'

function Section({ title, desc, children, t }: {
  title: string; desc?: string
  children: React.ReactNode; t: ReturnType<typeof getTokens>
}) {
  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${t.borderLight}` }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: t.text, marginBottom: 4 }}>{title}</h2>
        {desc && <p style={{ fontSize: 13, color: t.textSecondary }}>{desc}</p>}
      </div>
      {children}
    </div>
  )
}

function Field({ label, t, children }: { label: string; t: ReturnType<typeof getTokens>; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', marginBottom: 24 }}>
      <div style={{ minWidth: 160 }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{label}</p>
      </div>
      <div style={{ flex: 1, minWidth: 240 }}>
        {children}
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const { user } = useAuth()
  const { isDark } = useTheme()
  const t = getTokens(isDark)
  const navigate = useNavigate()

  const [displayName, setDisplayName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameSuccess, setNameSuccess] = useState(false)

  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [savingPw, setSavingPw] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSuccess, setPwSuccess] = useState(false)

  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Load saved display name from user metadata
  useEffect(() => {
    const savedName = user?.user_metadata?.display_name ?? ''
    setDisplayName(savedName)
  }, [user])

  const handleSaveName = async () => {
    setSavingName(true)
    setNameSuccess(false)
    const { error } = await supabase.auth.updateUser({
      data: { display_name: displayName.trim() },
    })
    setSavingName(false)
    if (!error) {
      setNameSuccess(true)
      setTimeout(() => setNameSuccess(false), 3000)
    }
  }

  const handleChangePassword = async () => {
    setPwError(null)
    setPwSuccess(false)
    if (newPw.length < 8) { setPwError('Password must be at least 8 characters.'); return }
    if (newPw !== confirmPw) { setPwError('Passwords do not match.'); return }
    setSavingPw(true)
    const { error } = await supabase.auth.updateUser({ password: newPw })
    setSavingPw(false)
    if (error) setPwError(error.message)
    else {
      setPwSuccess(true)
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
      setTimeout(() => setPwSuccess(false), 3000)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== user?.email) return
    setDeleting(true)
    // Sign out first, then the account would need server-side deletion
    // For now we sign out and show a message
    await supabase.auth.signOut()
    navigate('/')
  }

  const inputStyle = (focused = false): React.CSSProperties => ({
    width: '100%', background: t.inputBg,
    border: `1.5px solid ${focused ? t.inputFocus : t.inputBorder}`,
    borderRadius: 8, padding: '11px 14px', fontSize: 14, color: t.text,
    fontFamily: 'inherit', outline: 'none', transition: 'border-color 0.2s',
  })

  const [nameFocused, setNameFocused] = useState(false)
  const [pwFocused, setPwFocused] = useState<Record<string, boolean>>({})

  return (
    <AppLayout>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
      `}</style>

      <div style={{ maxWidth: 680, animation: 'fadeIn 0.5s ease forwards' }}>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 300, letterSpacing: '-1px', color: t.text }}>
            Account <span style={{ fontWeight: 600 }}>Settings</span>
          </h1>
          <p style={{ fontSize: 14, color: t.textSecondary, marginTop: 6 }}>{user?.email}</p>
        </div>

        {/* Profile */}
        <Section title="Profile" desc="Your display name appears on the dashboard greeting." t={t}>
          <Field label="Display name" t={t}>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder={user?.email?.split('@')[0] ?? 'Your name'}
                style={inputStyle(nameFocused)}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
              />
              <button
                onClick={handleSaveName}
                disabled={savingName}
                style={{
                  background: t.btnPrimary, color: t.btnPrimaryTxt,
                  padding: '11px 20px', borderRadius: 8, fontSize: 13,
                  fontWeight: 500, fontFamily: 'inherit', border: 'none',
                  cursor: 'pointer', whiteSpace: 'nowrap',
                  opacity: savingName ? 0.6 : 1, transition: 'opacity 0.2s',
                }}
              >
                {savingName ? 'Saving...' : nameSuccess ? '✓ Saved' : 'Save'}
              </button>
            </div>
            <p style={{ fontSize: 12, color: t.textMuted, marginTop: 6 }}>
              Leave blank to use your email username.
            </p>
          </Field>

          <Field label="Email" t={t}>
            <div style={{
              padding: '11px 14px', background: t.bgTertiary,
              border: `1.5px solid ${t.border}`, borderRadius: 8,
              fontSize: 14, color: t.textSecondary, fontFamily: 'inherit',
            }}>
              {user?.email}
            </div>
            <p style={{ fontSize: 12, color: t.textMuted, marginTop: 6 }}>
              Email cannot be changed.
            </p>
          </Field>
        </Section>

        {/* Password */}
        <Section title="Password" desc="Change your account password." t={t}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: t.textSecondary, display: 'block', marginBottom: 6 }}>New password</label>
              <input
                type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
                placeholder="Min. 8 characters"
                style={inputStyle(pwFocused['new'])}
                onFocus={() => setPwFocused(p => ({ ...p, new: true }))}
                onBlur={() => setPwFocused(p => ({ ...p, new: false }))}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: t.textSecondary, display: 'block', marginBottom: 6 }}>Confirm new password</label>
              <input
                type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                placeholder="Repeat new password"
                style={inputStyle(pwFocused['confirm'])}
                onFocus={() => setPwFocused(p => ({ ...p, confirm: true }))}
                onBlur={() => setPwFocused(p => ({ ...p, confirm: false }))}
              />
            </div>

            {pwError && (
              <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 13, color: '#dc2626' }}>
                ⚠ {pwError}
              </div>
            )}
            {pwSuccess && (
              <div style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 6, fontSize: 13, color: '#16a34a' }}>
                ✓ Password updated successfully.
              </div>
            )}

            <div>
              <button
                onClick={handleChangePassword}
                disabled={savingPw || !newPw || !confirmPw}
                style={{
                  background: t.btnPrimary, color: t.btnPrimaryTxt,
                  padding: '11px 24px', borderRadius: 8, fontSize: 13,
                  fontWeight: 500, fontFamily: 'inherit', border: 'none', cursor: 'pointer',
                  opacity: savingPw || !newPw || !confirmPw ? 0.5 : 1,
                  transition: 'opacity 0.2s',
                }}
              >
                {savingPw ? 'Updating...' : 'Update password'}
              </button>
            </div>
          </div>
        </Section>

        {/* Danger zone */}
        <Section title="Danger zone" t={t}>
          <div style={{
            border: '1px solid #fecaca', borderRadius: 10,
            padding: '20px 24px', background: isDark ? 'rgba(239,68,68,0.05)' : '#fff5f5',
          }}>
            <p style={{ fontSize: 14, fontWeight: 500, color: '#dc2626', marginBottom: 6 }}>Delete account</p>
            <p style={{ fontSize: 13, color: t.textSecondary, marginBottom: 16 }}>
              This will sign you out. Account deletion must be completed by a system administrator.
              To confirm, type your email address below.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder={user?.email ?? 'your@email.com'}
                style={{
                  flex: 1, minWidth: 200,
                  background: t.inputBg, border: '1.5px solid #fecaca',
                  borderRadius: 8, padding: '10px 14px', fontSize: 13,
                  color: t.text, fontFamily: 'inherit', outline: 'none',
                }}
              />
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirm !== user?.email || deleting}
                style={{
                  background: '#dc2626', color: '#fff',
                  padding: '10px 20px', borderRadius: 8, fontSize: 13,
                  fontWeight: 500, fontFamily: 'inherit', border: 'none',
                  cursor: deleteConfirm !== user?.email ? 'not-allowed' : 'pointer',
                  opacity: deleteConfirm !== user?.email || deleting ? 0.5 : 1,
                  transition: 'opacity 0.2s',
                }}
              >
                {deleting ? 'Signing out...' : 'Delete account'}
              </button>
            </div>
          </div>
        </Section>

      </div>
    </AppLayout>
  )
}