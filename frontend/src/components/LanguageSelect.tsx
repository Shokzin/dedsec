import { useEffect, useRef, useState } from 'react'
import { useTheme, getTokens } from '../hooks/useTheme'
import { useI18n, LANGUAGES } from '../hooks/useI18n'

export default function LanguageSelect() {
  const { isDark } = useTheme()
  const t = getTokens(isDark)
  const { lang, setLang, t: tr } = useI18n()
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  // Fecha ao clicar fora ou com Esc, para o menu não ficar preso aberto.
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const atual = LANGUAGES.find(l => l.code === lang) ?? LANGUAGES[1]

  return (
    <div ref={boxRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(o => !o)}
        title={tr('common.language')}
        aria-label={tr('common.language')}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          height: 36, borderRadius: 18, padding: '0 12px',
          border: `1.5px solid ${open ? t.inputFocus : t.inputBorder}`,
          background: open ? t.bgTertiary : 'transparent',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
          color: t.textSecondary, letterSpacing: '0.04em',
          transition: 'border-color 0.2s, background 0.2s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = t.inputFocus
          e.currentTarget.style.background = t.bgTertiary
        }}
        onMouseLeave={e => {
          if (!open) {
            e.currentTarget.style.borderColor = t.inputBorder
            e.currentTarget.style.background = 'transparent'
          }
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        {atual.short}
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={tr('common.language')}
          style={{
            position: 'absolute', top: 44, right: 0, zIndex: 200,
            minWidth: 170, padding: 5,
            background: t.cardBg, border: `1.5px solid ${t.border}`,
            borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            display: 'flex', flexDirection: 'column', gap: 2,
          }}
        >
          {LANGUAGES.map(l => {
            const selecionado = l.code === lang
            return (
              <button
                key={l.code}
                role="option"
                aria-selected={selecionado}
                onClick={() => { setLang(l.code); setOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                  width: '100%', padding: '9px 11px', borderRadius: 7,
                  background: selecionado ? t.bgTertiary : 'transparent',
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                  fontFamily: 'inherit', fontSize: 13,
                  color: selecionado ? t.text : t.textSecondary,
                  fontWeight: selecionado ? 600 : 400,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = t.bgTertiary }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = selecionado ? t.bgTertiary : 'transparent'
                }}
              >
                <span>{l.label}</span>
                <span style={{ fontSize: 11, opacity: 0.65, letterSpacing: '0.04em' }}>{l.short}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
