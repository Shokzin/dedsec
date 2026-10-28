import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { translations, type Lang, type TranslationKey } from '../i18n/translations'

export const LANGUAGES: { code: Lang; label: string; short: string; locale: string }[] = [
  { code: 'pt', label: 'Português', short: 'PT', locale: 'pt-BR' },
  { code: 'en', label: 'English',   short: 'EN', locale: 'en-US' },
  { code: 'es', label: 'Español',   short: 'ES', locale: 'es-ES' },
  { code: 'ru', label: 'Русский',   short: 'RU', locale: 'ru-RU' },
]

const STORAGE_KEY = 'dedsec-lang'

type Vars = Record<string, string | number>

interface I18nContextType {
  lang: Lang
  /** Locale correspondente, para formatar datas e números. */
  locale: string
  setLang: (lang: Lang) => void
  /** Traduz uma chave. Aceita variáveis no formato {nome}. */
  t: (key: TranslationKey, vars?: Vars) => string
}

const I18nContext = createContext<I18nContextType | null>(null)

function isLang(value: string): value is Lang {
  return LANGUAGES.some(l => l.code === value)
}

function getInitialLang(): Lang {
  // 1. Escolha explícita do usuário
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && isLang(stored)) return stored
  } catch {
    // modo privado ou armazenamento bloqueado: segue para a detecção
  }
  // 2. Idioma do navegador (pt-BR -> pt)
  const fromBrowser = (navigator.language || '').slice(0, 2).toLowerCase()
  if (isLang(fromBrowser)) return fromBrowser
  // 3. Inglês como último recurso
  return 'en'
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => getInitialLang())

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      // sem armazenamento, a escolha vale só para esta visita
    }
    document.documentElement.setAttribute('lang', lang)
  }, [lang])

  const value = useMemo<I18nContextType>(() => ({
    lang,
    locale: LANGUAGES.find(l => l.code === lang)?.locale ?? 'en-US',
    setLang,
    t: (key, vars) => {
      // O inglês é a referência: se faltar tradução, cai nele em vez de mostrar a chave.
      const texto = translations[lang][key] ?? translations.en[key] ?? key
      if (!vars) return texto
      return texto.replace(/\{(\w+)\}/g, (match, nome) =>
        nome in vars ? String(vars[nome]) : match
      )
    },
  }), [lang])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider')
  return ctx
}
