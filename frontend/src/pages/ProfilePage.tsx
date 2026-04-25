import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme, getTokens } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import AppLayout from '../components/Layout/AppLayout'

function Section({ title, desc, children, t }: {
  title: string; desc?: string; children: React.ReactNode; t: ReturnType<typeof getTokens>
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

export default function ProfilePage() {
  const { user } = useAuth()
  const { isDark } = useTheme()
  const t = getTokens(isDark)
  const navigate = useNavigate()
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [nameSuccess, setNameSuccess] = useState(false)

  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [savingPw, setSavingPw] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSuccess, setPwSuccess] = useState(false)

  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [nameFocused, setNameFocused] = useState(false)
  const [pwFocused, setPwFocused] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (user) {
      setDisplayName(user.user_metadata?.display_name ?? '')
      setAvatarUrl(user.user_metadata?.avatar_url ?? null)
    }
  }, [user])

  // ── Avatar upload ─────────────────────────────────────────────────────────
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be under 2MB.')
      return
    }

    setAvatarUploading(true)
    const ext = file.name.split('.').pop()
    const path = `avatars/${user.id}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })

    let newAvatarUrl: string | null = null

    if (uploadError) {
      // Supabase Storage bucket not set up — fall back to base64 in metadata
      const reader = new FileReader()
      await new Promise<void>(resolve => {
        reader.onload = async () => {
          const base64 = reader.result as string
          await supabase.auth.updateUser({ data: { avatar_url: base64 } })
          newAvatarUrl = base64
          resolve()
        }
        reader.readAsDataURL(file)
      })
    } else {
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      await supabase.auth.updateUser({ data: { avatar_url: data.publicUrl } })
      newAvatarUrl = data.publicUrl
    }

    // CRITICAL FIX: refreshSession forces Supabase to re-issue the JWT with
    // the updated metadata, so the avatar persists across page navigation.
    await supabase.auth.refreshSession()

    setAvatarUrl(newAvatarUrl)
    setAvatarUploading(false)

    // Reset file input so the same file can be re-selected if needed
    if (avatarInputRef.current) avatarInputRef.current.value = ''
  }

  const handleRemoveAvatar = async () => {
    await supabase.auth.updateUser({ data: { avatar_url: null } })
    await supabase.auth.refreshSession()
    setAvatarUrl(null)
  }

  // ── Display name ──────────────────────────────────────────────────────────
  const handleSaveName = async () => {
    setSavingName(true)
    setNameSuccess(false)
    const { error } = await supabase.auth.updateUser({
      data: { display_name: displayName.trim() },
    })
    if (!error) {
      // Refresh session so AppLayout and DashboardPage pick up the new name
      await supabase.auth.refreshSession()
      setNameSuccess(true)
      setTimeout(() => setNameSuccess(false), 3000)
    }
    setSavingName(false)
  }

  // ── Password ──────────────────────────────────────────────────────────────
  const handleChangePassword = async () => {
    setPwError(null); setPwSuccess(false)
    if (newPw.length < 8) { setPwError('A senha deve ter no mínimo 8 caracteres.'); return }
    if (newPw !== confirmPw) { setPwError('As senhas não coincidem.'); return }
    setSavingPw(true)
    const { error } = await supabase.auth.updateUser({ password: newPw })
    setSavingPw(false)
    if (error) setPwError(error.message)
    else {
      setPwSuccess(true)
      setNewPw(''); setConfirmPw('')
      setTimeout(() => setPwSuccess(false), 3000)
    }
  }

  // ── Delete account ────────────────────────────────────────────────────────
  const handleDeleteAccount = async () => {
    if (deleteConfirm !== user?.email || !user) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/auth/delete-account`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      )
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.detail ?? 'Failed to delete account.')
      }
      await supabase.auth.signOut()
      navigate('/')
    } catch (err: any) {
      setDeleteError(err.message)
      setDeleting(false)
    }
  }

  const inputStyle = (focused = false): React.CSSProperties => ({
    width: '100%', background: t.inputBg,
    border: `1.5px solid ${focused ? t.inputFocus : t.inputBorder}`,
    borderRadius: 8, padding: '11px 14px', fontSize: 14, color: t.text,
    fontFamily: 'inherit', outline: 'none', transition: 'border-color 0.2s',
  })

  const currentDisplayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || '?'

  return (
    <AppLayout>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>

      <div style={{ maxWidth: 680, animation: 'fadeIn 0.5s ease forwards' }}>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 300, letterSpacing: '-1px', color: t.text }}>
            Account <span style={{ fontWeight: 600 }}>Settings</span>
          </h1>
          <p style={{ fontSize: 14, color: t.textSecondary, marginTop: 6 }}>{user?.email}</p>
        </div>

        {/* ── Avatar ── */}
        <Section title="Profile picture" desc="Upload a photo to personalize your account." t={t}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: t.bgTertiary, border: `2px solid ${t.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
              }}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 28, fontWeight: 700, color: t.text }}>
                    {currentDisplayName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              {avatarUploading && (
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 20, height: 20, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                </div>
              )}
            </div>

            <div>
              <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" style={{ display: 'none' }} onChange={handleAvatarChange} />
              <button onClick={() => avatarInputRef.current?.click()} disabled={avatarUploading} style={{
                background: t.btnPrimary, color: t.btnPrimaryTxt,
                padding: '10px 20px', borderRadius: 8, fontSize: 13,
                fontWeight: 500, fontFamily: 'inherit', border: 'none',
                cursor: 'pointer', marginBottom: 8, display: 'block',
                opacity: avatarUploading ? 0.6 : 1,
              }}>
                {avatarUploading ? 'Uploading...' : 'Upload photo'}
              </button>
              {avatarUrl && (
                <button onClick={handleRemoveAvatar} style={{ fontSize: 12, color: t.textMuted, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, display: 'block', marginBottom: 6 }}>
                  Remove photo
                </button>
              )}
              <p style={{ fontSize: 12, color: t.textMuted }}>JPG, PNG, GIF, WebP · Max 2MB</p>
            </div>
          </div>
        </Section>

        {/* ── Display name ── */}
        <Section title="Profile" desc="Your display name appears on the dashboard greeting and navigation." t={t}>
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: t.textSecondary, display: 'block', marginBottom: 8 }}>Display name</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                placeholder={user?.email?.split('@')[0] ?? 'Your name'}
                style={inputStyle(nameFocused)}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
              />
              <button onClick={handleSaveName} disabled={savingName} style={{
                background: nameSuccess ? '#22c55e' : t.btnPrimary,
                color: nameSuccess ? '#fff' : t.btnPrimaryTxt,
                padding: '11px 20px', borderRadius: 8, fontSize: 13,
                fontWeight: 500, fontFamily: 'inherit', border: 'none',
                cursor: 'pointer', whiteSpace: 'nowrap',
                opacity: savingName ? 0.6 : 1, transition: 'all 0.2s',
              }}>
                {savingName ? 'Saving...' : nameSuccess ? '✓ Saved' : 'Save'}
              </button>
            </div>
            <p style={{ fontSize: 12, color: t.textMuted, marginTop: 6 }}>Leave blank to use your email username.</p>
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: t.textSecondary, display: 'block', marginBottom: 8 }}>Email</label>
            <div style={{ padding: '11px 14px', background: t.bgTertiary, border: `1.5px solid ${t.border}`, borderRadius: 8, fontSize: 14, color: t.textSecondary }}>
              {user?.email}
            </div>
            <p style={{ fontSize: 12, color: t.textMuted, marginTop: 6 }}>Email cannot be changed.</p>
          </div>
        </Section>

        {/* ── Password ── */}
        <Section title="Password" desc="Update your account password." t={t}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: t.textSecondary, display: 'block', marginBottom: 6 }}>New password</label>
              <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
                placeholder="Min. 8 characters"
                style={inputStyle(pwFocused['new'])}
                onFocus={() => setPwFocused(p => ({ ...p, new: true }))}
                onBlur={() => setPwFocused(p => ({ ...p, new: false }))}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: t.textSecondary, display: 'block', marginBottom: 6 }}>Confirm new password</label>
              <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                placeholder="Repeat new password"
                style={inputStyle(pwFocused['confirm'])}
                onFocus={() => setPwFocused(p => ({ ...p, confirm: true }))}
                onBlur={() => setPwFocused(p => ({ ...p, confirm: false }))}
              />
            </div>
            {pwError && <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 13, color: '#dc2626' }}>⚠ {pwError}</div>}
            {pwSuccess && <div style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 6, fontSize: 13, color: '#16a34a' }}>✓ Password updated successfully.</div>}
            <div>
              <button onClick={handleChangePassword} disabled={savingPw || !newPw || !confirmPw} style={{
                background: t.btnPrimary, color: t.btnPrimaryTxt,
                padding: '11px 24px', borderRadius: 8, fontSize: 13,
                fontWeight: 500, fontFamily: 'inherit', border: 'none', cursor: 'pointer',
                opacity: savingPw || !newPw || !confirmPw ? 0.5 : 1, transition: 'opacity 0.2s',
              }}>
                {savingPw ? 'Updating...' : 'Update password'}
              </button>
            </div>
          </div>
        </Section>

        {/* ── Danger zone ── */}
        <Section title="Danger zone" t={t}>
          <div style={{ border: '1px solid #fecaca', borderRadius: 10, padding: '20px 24px', background: isDark ? 'rgba(239,68,68,0.05)' : '#fff5f5' }}>
            <p style={{ fontSize: 14, fontWeight: 500, color: '#dc2626', marginBottom: 6 }}>Delete account</p>
            <p style={{ fontSize: 13, color: t.textSecondary, marginBottom: 16 }}>
              Permanently deletes your account and all associated scan data. This action cannot be undone.
              To confirm, type your email address below.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder={user?.email ?? 'your@email.com'}
                style={{ flex: 1, minWidth: 200, background: t.inputBg, border: '1.5px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: t.text, fontFamily: 'inherit', outline: 'none' }}
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
                {deleting ? 'Deleting...' : 'Delete account'}
              </button>
            </div>
            {deleteError && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 10 }}>⚠ {deleteError}</p>}
          </div>
        </Section>

      </div>
    </AppLayout>
  )
}