import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  toggle: () => void
  isDark: boolean
}

const ThemeContext = createContext<ThemeContextType | null>(null)

function getInitialTheme(): Theme {
  // 1. Check localStorage first (user's explicit choice)
  const stored = localStorage.getItem('dedsec-theme') as Theme | null
  if (stored === 'light' || stored === 'dark') return stored
  // 2. Fall back to system preference
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
  return 'light'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme())

  useEffect(() => {
    localStorage.setItem('dedsec-theme', theme)
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggle = () => setTheme(t => t === 'light' ? 'dark' : 'light')

  return (
    <ThemeContext.Provider value={{ theme, toggle, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}

// ── Design tokens per theme ─────────────────────────────────────────────────
// Use these throughout all pages for consistency.
export function getTokens(isDark: boolean) {
  return {
    bg:           isDark ? '#0f0f0f' : '#ffffff',
    bgSecondary:  isDark ? '#1a1a1a' : '#fafafa',
    bgTertiary:   isDark ? '#222222' : '#f5f5f5',
    border:       isDark ? '#2a2a2a' : '#ebebeb',
    borderLight:  isDark ? '#1f1f1f' : '#f0f0f0',
    text:         isDark ? '#f0f0f0' : '#111111',
    textSecondary:isDark ? '#999999' : '#555555',
    textMuted:    isDark ? '#666666' : '#999999',
    navBg:        isDark ? 'rgba(15,15,15,0.95)' : 'rgba(255,255,255,0.95)',
    cardBg:       isDark ? '#1a1a1a' : '#fafafa',
    cardBorder:   isDark ? '#2a2a2a' : '#f0f0f0',
    inputBg:      isDark ? '#1a1a1a' : '#ffffff',
    inputBorder:  isDark ? '#333333' : '#e0e0e0',
    inputFocus:   isDark ? '#555555' : '#111111',
    btnPrimary:   isDark ? '#ffffff' : '#111111',
    btnPrimaryTxt:isDark ? '#111111' : '#ffffff',
    divider:      isDark ? '#ffffff' : '#111111',
    scrollThumb:  isDark ? '#444444' : '#d0d0d0',
    scrollTrack:  isDark ? '#1a1a1a' : '#f5f5f5',
  }
}