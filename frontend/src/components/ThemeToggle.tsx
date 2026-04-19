import { useTheme, getTokens } from '../hooks/useTheme'

export default function ThemeToggle() {
  const { toggle, isDark } = useTheme()
  const t = getTokens(isDark)

  return (
    <button
      onClick={toggle}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        border: `1.5px solid ${t.inputBorder}`,
        background: 'transparent',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'border-color 0.2s, background 0.2s',
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = t.inputFocus
        e.currentTarget.style.background = t.bgTertiary
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = t.inputBorder
        e.currentTarget.style.background = 'transparent'
      }}
    >
      {isDark ? (
        // Sun icon
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={t.textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/>
          <line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      ) : (
        // Moon icon
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      )}
    </button>
  )
}