import { useNavigate } from 'react-router-dom'
import { useTheme, getTokens } from '../hooks/useTheme'
import ThemeToggle from '../components/ThemeToggle'
import { useEffect, useRef, useState, useCallback } from 'react'

// ─── Bidirectional reveal hook ─────────────────────────────────────────────
// Elements animate IN when scrolling down into view,
// and animate OUT when scrolling back up past them.
function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

// ─── Animated counter ─────────────────────────────────────────────────────
function Counter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0)
  const { ref, visible } = useReveal()
  useEffect(() => {
    if (!visible) { setCount(0); return }
    let start = 0
    const step = Math.ceil(target / (1200 / 16))
    const timer = setInterval(() => {
      start += step
      if (start >= target) { setCount(target); clearInterval(timer) }
      else setCount(start)
    }, 16)
    return () => clearInterval(timer)
  }, [visible, target])
  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>
}

// ─── Section reveal wrapper (bidirectional) ────────────────────────────────
function Reveal({ children, delay = 0, distance = 28 }: {
  children: React.ReactNode; delay?: number; distance?: number
}) {
  const { ref, visible } = useReveal()
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : `translateY(${distance}px)`,
      transition: `opacity 0.65s ease ${delay}ms, transform 0.65s ease ${delay}ms`,
      willChange: 'opacity, transform',
    }}>
      {children}
    </div>
  )
}

// ─── Data ──────────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: '🔑',
    title: 'Secrets & Credentials',
    desc: 'Detects exposed API keys, hardcoded passwords, tokens, AWS credentials, and private keys committed to repositories.',
  },
  {
    icon: '💉',
    title: 'Injection Vulnerabilities',
    desc: 'Identifies SQL injection, cross-site scripting, command injection, and path traversal patterns across multiple languages.',
  },
  {
    icon: '⚙️',
    title: 'Misconfigurations',
    desc: 'Catches exposed .env files, CORS wildcards, debug mode enabled in production, and insecure cookie settings.',
  },
  {
    icon: '🔬',
    title: 'Code Structure Analysis',
    desc: 'Uses Python AST parsing to detect unsafe deserialization, dynamic code execution, and dangerous subprocess calls.',
  },
  {
    icon: '🔐',
    title: 'Access Control Flaws',
    desc: 'Identifies potential IDOR vulnerabilities, missing authentication checks, and mass assignment patterns.',
  },
  {
    icon: '📊',
    title: 'Security Scoring',
    desc: 'Produces a 0–100 security score using a weighted algorithm with diminishing penalties so large codebases are assessed fairly.',
  },
]

const STEPS = [
  { n: '01', title: 'Submit a URL', desc: 'Paste any public GitHub repository URL into the scanner.' },
  { n: '02', title: 'Repository is cloned', desc: 'DedSec clones the repo in a sandboxed environment. No code is ever executed.' },
  { n: '03', title: 'Three-layer analysis', desc: 'Pattern matching, AST analysis, and rule-based detection run in parallel across all files.' },
  { n: '04', title: 'Results are generated', desc: 'Every finding is mapped to a CWE ID, OWASP category, file location, and remediation advice.' },
]

const STACK_ITEMS = [
  {
    name: 'Python',
    color: '#3776AB',
    role: 'Backend language',
    desc: 'Powers the scanner engine, AST analysis, and API. Chosen for its native AST module and security tooling ecosystem.',
  },
  {
    name: 'FastAPI',
    color: '#009688',
    role: 'API framework',
    desc: 'Async-native REST API with automatic OpenAPI documentation and Pydantic request validation.',
  },
  {
    name: 'React',
    color: '#61DAFB',
    role: 'Frontend framework',
    desc: 'Component-based UI with TypeScript for type-safe development and predictable data flow.',
  },
  {
    name: 'TypeScript',
    color: '#3178C6',
    role: 'Frontend language',
    desc: 'Static typing catches API contract mismatches at compile time rather than at runtime.',
  },
  {
    name: 'Supabase',
    color: '#3ECF8E',
    role: 'Database & Auth',
    desc: 'PostgreSQL with built-in Auth, Realtime subscriptions, and Row Level Security for data isolation.',
  },
  {
    name: 'Celery',
    color: '#37814A',
    role: 'Task queue',
    desc: 'Processes scans asynchronously so API requests return immediately while analysis runs in background workers.',
  },
  {
    name: 'Redis',
    color: '#DC382D',
    role: 'Message broker',
    desc: 'Bridges the API and worker containers. Also used as Celery result backend for task state tracking.',
  },
  {
    name: 'Docker',
    color: '#2496ED',
    role: 'Infrastructure',
    desc: 'Orchestrates four isolated containers — API, worker, Redis, and frontend — with a single command.',
  },
]

const SCAN_EXAMPLES = [
  {
    repo: 'acme-corp / backend-api',
    branch: 'main',
    duration: '8.4s',
    files: 42,
    score: 73,
    scoreColor: '#f59e0b',
    scoreLabel: 'Moderate',
    critical: 2, high: 5, medium: 8, low: 3,
    tag: 'Node.js',
  },
  {
    repo: 'startup-x / mobile-gateway',
    branch: 'develop',
    duration: '5.1s',
    files: 28,
    score: 54,
    scoreColor: '#ef4444',
    scoreLabel: 'Vulnerable',
    critical: 4, high: 9, medium: 3, low: 1,
    tag: 'Python',
  },
  {
    repo: 'devteam / auth-service',
    branch: 'main',
    duration: '12.2s',
    files: 71,
    score: 91,
    scoreColor: '#22c55e',
    scoreLabel: 'Secure',
    critical: 0, high: 1, medium: 4, low: 2,
    tag: 'Go',
  },
]

// ─── Stack Carousel ────────────────────────────────────────────────────────
function StackCarousel() {
  const [active, setActive] = useState(0)
  const total = STACK_ITEMS.length

  const prev = useCallback(() => setActive(a => (a - 1 + total) % total), [total])
  const next = useCallback(() => setActive(a => (a + 1) % total), [total])

  useEffect(() => {
    const t = setInterval(next, 4000)
    return () => clearInterval(t)
  }, [next])

  const item = STACK_ITEMS[active]

  return (
    <div style={{ position: 'relative' }}>
      {/* Main card */}
      <div style={{
        background: '#fff',
        border: '1px solid #ebebeb',
        borderRadius: 16,
        padding: '36px 40px',
        minHeight: 180,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 24,
        boxShadow: '0 4px 24px rgba(0,0,0,0.05)',
        transition: 'all 0.3s ease',
      }}>
        {/* Color dot */}
        <div style={{
          width: 52, height: 52, borderRadius: 12, flexShrink: 0,
          background: item.color + '18',
          border: `1.5px solid ${item.color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ width: 18, height: 18, borderRadius: '50%', background: item.color }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.5px' }}>{item.name}</span>
            <span style={{
              fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 100,
              background: '#f5f5f5', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              {item.role}
            </span>
          </div>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: '#666', maxWidth: 520 }}>{item.desc}</p>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 }}>
        {/* Dots */}
        <div style={{ display: 'flex', gap: 6 }}>
          {STACK_ITEMS.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              style={{
                width: i === active ? 24 : 8, height: 8,
                borderRadius: 4, border: 'none', cursor: 'pointer',
                background: i === active ? '#111' : '#e0e0e0',
                transition: 'all 0.3s',
                padding: 0,
              }}
            />
          ))}
        </div>
        {/* Arrows */}
        <div style={{ display: 'flex', gap: 8 }}>
          {[prev, next].map((fn, i) => (
            <button
              key={i}
              onClick={fn}
              style={{
                width: 36, height: 36, borderRadius: '50%',
                border: '1.5px solid #e0e0e0', background: '#fff',
                cursor: 'pointer', fontSize: 14, color: '#555',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'border-color 0.2s, color 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#111'; e.currentTarget.style.color = '#111' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e0e0e0'; e.currentTarget.style.color = '#555' }}
            >
              {i === 0 ? '←' : '→'}
            </button>
          ))}
        </div>
      </div>

      {/* Mini stack row */}
      <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
        {STACK_ITEMS.map((s, i) => (
          <button
            key={s.name}
            onClick={() => setActive(i)}
            style={{
              padding: '5px 12px', borderRadius: 100, border: '1.5px solid',
              borderColor: i === active ? '#111' : '#eee',
              background: i === active ? '#111' : 'transparent',
              color: i === active ? '#fff' : '#888',
              fontSize: 12, fontWeight: 500, cursor: 'pointer',
              transition: 'all 0.2s',
              fontFamily: 'inherit',
            }}
          >
            {s.name}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Scan result carousel ──────────────────────────────────────────────────
function ScanCarousel() {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setActive(a => (a + 1) % SCAN_EXAMPLES.length), 3500)
    return () => clearInterval(t)
  }, [])

  const scan = SCAN_EXAMPLES[active]
  const totalVulns = scan.critical + scan.high + scan.medium + scan.low
  const maxBar = Math.max(scan.critical, scan.high, scan.medium, scan.low, 1)

  return (
    <div style={{
      background: '#fafafa',
      border: '1px solid #ececec',
      borderRadius: 16,
      padding: 32,
      width: '100%',
      maxWidth: 380,
      boxShadow: '0 20px 60px rgba(0,0,0,0.07)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid #ebebeb' }}>
        <div style={{ width: 36, height: 36, background: '#111', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" fill="white"/>
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "'DM Mono', monospace", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {scan.repo}
          </div>
          <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
            {scan.branch} · {scan.duration} · {scan.tag}
          </div>
        </div>
        <div style={{
          background: '#dcfce7', color: '#16a34a',
          fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 100, flexShrink: 0,
        }}>
          Done
        </div>
      </div>

      {/* Score */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, color: '#999', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Security Score</div>
          <div style={{ fontSize: 48, fontWeight: 600, lineHeight: 1, color: '#111' }}>
            {scan.score}<span style={{ fontSize: 20, fontWeight: 400, color: '#999' }}>/100</span>
          </div>
          <div style={{ fontSize: 12, color: scan.scoreColor, fontWeight: 600, marginTop: 4 }}>{scan.scoreLabel}</div>
        </div>
        <svg width="72" height="72" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r="28" fill="none" stroke="#f0f0f0" strokeWidth="6" />
          <circle
            cx="36" cy="36" r="28" fill="none"
            stroke={scan.scoreColor} strokeWidth="6"
            strokeDasharray={`${2 * Math.PI * 28}`}
            strokeDashoffset={`${2 * Math.PI * 28 * (1 - scan.score / 100)}`}
            strokeLinecap="round"
            transform="rotate(-90 36 36)"
            style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s ease' }}
          />
          <text x="36" y="41" textAnchor="middle" fontSize="13" fontWeight="600" fill="#111">{scan.score}</text>
        </svg>
      </div>

      {/* Severity bars */}
      {[
        { label: 'Critical', count: scan.critical, color: '#ef4444' },
        { label: 'High', count: scan.high, color: '#f97316' },
        { label: 'Medium', count: scan.medium, color: '#eab308' },
        { label: 'Low', count: scan.low, color: '#3b82f6' },
      ].map(s => (
        <div key={s.label} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
            <span style={{ color: '#555', fontWeight: 500 }}>{s.label}</span>
            <span style={{ color: '#999' }}>{s.count}</span>
          </div>
          <div style={{ height: 4, background: '#f0f0f0', borderRadius: 2 }}>
            <div style={{
              height: '100%',
              width: `${(s.count / maxBar) * 100}%`,
              background: s.color, borderRadius: 2,
              transition: 'width 0.8s ease',
            }} />
          </div>
        </div>
      ))}

      <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #ebebeb', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#999' }}>
        <span>{scan.files} files scanned</span>
        <span>{totalVulns} vulnerabilities</span>
      </div>

      {/* Carousel dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 16 }}>
        {SCAN_EXAMPLES.map((_, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            style={{
              width: i === active ? 20 : 6, height: 6, borderRadius: 3,
              border: 'none', cursor: 'pointer', padding: 0,
              background: i === active ? '#111' : '#ddd',
              transition: 'all 0.3s',
            }}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────
export default function LandingPage() {
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const t = getTokens(isDark)
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setMenuOpen(false)
  }

  return (
    <div style={{ fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", background: t.bg, color: t.text, overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&family=DM+Mono:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        ::selection { background: #111; color: #fff; }

        /* Scrollbar */
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: ${t.scrollTrack}; }
        ::-webkit-scrollbar-thumb { background: ${t.scrollThumb}; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #aaa; }

        .btn-primary {
          display: inline-flex; align-items: center; gap: 8px;
          background: #111111; color: #ffffff;
          padding: 14px 28px; border-radius: 6px;
          font-size: 15px; font-weight: 500; font-family: inherit;
          border: none; cursor: pointer;
          transition: background 0.2s, transform 0.15s;
          text-decoration: none;
        }
        .btn-primary:hover { background: #333; transform: translateY(-1px); }

        .btn-secondary {
          display: inline-flex; align-items: center; gap: 8px;
          background: transparent; color: #111111;
          padding: 13px 28px; border-radius: 6px;
          font-size: 15px; font-weight: 500; font-family: inherit;
          border: 1.5px solid #e0e0e0; cursor: pointer;
          transition: border-color 0.2s, transform 0.15s;
          text-decoration: none;
        }
        .btn-secondary:hover { border-color: #111; transform: translateY(-1px); }

        .feature-card {
          background: #fafafa; border: 1px solid #f0f0f0;
          border-radius: 12px; padding: 32px 28px;
          transition: box-shadow 0.25s, transform 0.25s;
        }
        .feature-card:hover { box-shadow: 0 8px 32px rgba(0,0,0,0.08); transform: translateY(-3px); }

        .nav-link {
          font-size: 14px; font-weight: 500; color: #555; background: none;
          border: none; cursor: pointer; font-family: inherit;
          transition: color 0.2s; padding: 4px 0; text-decoration: none;
        }
        .nav-link:hover { color: #111; }

        .divider { width: 40px; height: 2px; background: #111; margin-bottom: 20px; }
        .section-label {
          font-size: 11px; font-weight: 600; letter-spacing: 0.12em;
          text-transform: uppercase; color: #999; margin-bottom: 12px;
        }

        @media (max-width: 900px) {
          .hero-split { flex-direction: column !important; }
          .hero-split > div:last-child { display: none !important; }
          .features-grid { grid-template-columns: 1fr 1fr !important; }
          .steps-grid { grid-template-columns: 1fr 1fr !important; }
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
          .about-grid { flex-direction: column !important; }
          .cta-inner { flex-direction: column !important; }
        }
        @media (max-width: 600px) {
          .features-grid { grid-template-columns: 1fr !important; }
          .steps-grid { grid-template-columns: 1fr !important; }
          .stats-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: scrolled ? 'rgba(255,255,255,0.95)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? '1px solid #f0f0f0' : '1px solid transparent',
        transition: 'all 0.3s',
        padding: '0 5%',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 500, fontSize: 18, letterSpacing: '-0.5px' }}>
            DedSec
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 32 }} className="desktop-nav">
            {[
              { id: 'features', label: 'Features' },
              { id: 'how-it-works', label: 'How it works' },
              { id: 'stack', label: 'Stack' },
              { id: 'about', label: 'About' },
            ].map(({ id, label }) => (
              <button key={id} className="nav-link" onClick={() => scrollTo(id)}>{label}</button>
            ))}
            <div style={{ width: 1, height: 20, background: '#e0e0e0' }} />
            <ThemeToggle />
            <button className="nav-link" onClick={() => navigate('/auth')}>Sign in</button>
            <button className="btn-primary" style={{ padding: '9px 20px', fontSize: 14 }} onClick={() => navigate('/auth')}>
              Get started
            </button>
          </div>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, display: 'none', flexDirection: 'column' }}
            className="mobile-menu-btn"
          >
            <div style={{ width: 22, height: 2, background: '#111', marginBottom: 5, transition: 'all 0.2s', transform: menuOpen ? 'rotate(45deg) translateY(7px)' : 'none' }} />
            <div style={{ width: 22, height: 2, background: '#111', marginBottom: 5, opacity: menuOpen ? 0 : 1 }} />
            <div style={{ width: 22, height: 2, background: '#111', transition: 'all 0.2s', transform: menuOpen ? 'rotate(-45deg) translateY(-7px)' : 'none' }} />
          </button>
        </div>

        {menuOpen && (
          <div style={{ background: '#fff', borderTop: '1px solid #f0f0f0', padding: '20px 5%', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {['features', 'how-it-works', 'stack', 'about'].map(id => (
              <button key={id} className="nav-link" style={{ textAlign: 'left' }} onClick={() => scrollTo(id)}>
                {id.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </button>
            ))}
            <button className="btn-primary" onClick={() => navigate('/auth')}>Get started →</button>
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '120px 5% 80px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', width: '100%' }}>
          <div className="hero-split" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 60 }}>
            <div style={{ flex: '0 0 55%', maxWidth: 580 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: '#f5f5f5', border: '1px solid #e8e8e8',
                padding: '6px 14px', borderRadius: 100, marginBottom: 32,
                fontSize: 13, fontWeight: 500, color: '#555',
              }}>
                <span style={{ width: 7, height: 7, background: '#22c55e', borderRadius: '50%', display: 'inline-block' }} />
                Open source · Graduation project
              </div>

              <h1 style={{
                fontSize: 'clamp(38px, 5.2vw, 64px)', fontWeight: 300,
                lineHeight: 1.1, letterSpacing: '-2px', marginBottom: 24, color: '#111',
              }}>
                DedSec — Find<br />
                <span style={{ fontWeight: 600 }}>vulnerabilities</span><br />
                before attackers do
              </h1>

              <p style={{ fontSize: 18, lineHeight: 1.7, color: '#666', marginBottom: 40, maxWidth: 480 }}>
                Submit any public GitHub repository URL. DedSec analyzes the codebase for security vulnerabilities and returns a detailed report with severity ratings, file locations, and remediation guidance.
              </p>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button className="btn-primary" onClick={() => navigate('/auth')}>
                  Scan a repository →
                </button>
                <a href="https://github.com/Shokzin/dedsec" target="_blank" rel="noopener noreferrer" className="btn-secondary">
                  View on GitHub
                </a>
              </div>
            </div>

            <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              <ScanCarousel />
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section style={{ padding: '60px 5%', borderTop: '1px solid #f0f0f0', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 40, textAlign: 'center' }}>
            {[
              { value: 12, suffix: '+', label: 'Vulnerability categories' },
              { value: 3, suffix: ' layers', label: 'Analysis depth' },
              { value: 100, suffix: ' pts', label: 'Security score range' },
              { value: 8, suffix: 's avg', label: 'Scan duration' },
            ].map(s => (
              <Reveal key={s.label}>
                <div style={{ fontSize: 40, fontWeight: 600, letterSpacing: '-1px', lineHeight: 1 }}>
                  <Counter target={s.value} suffix={s.suffix} />
                </div>
                <div style={{ fontSize: 14, color: '#888', marginTop: 6 }}>{s.label}</div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ padding: '100px 5%' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Reveal>
            <div style={{ marginBottom: 64 }}>
              <div className="section-label">Detection coverage</div>
              <div className="divider" />
              <h2 style={{ fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 300, letterSpacing: '-1.5px', lineHeight: 1.2, marginBottom: 16 }}>
                What DedSec <span style={{ fontWeight: 600 }}>detects</span>
              </h2>
              <p style={{ fontSize: 17, color: '#666', maxWidth: 520, lineHeight: 1.7 }}>
                The scanner runs three layers of analysis — pattern matching, code structure parsing, and rule-based detection — to find vulnerabilities across every major category.
              </p>
            </div>
          </Reveal>

          <div className="features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 70}>
                <div className="feature-card">
                  <div style={{ fontSize: 28, marginBottom: 16 }}>{f.icon}</div>
                  <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 10, letterSpacing: '-0.3px' }}>{f.title}</h3>
                  <p style={{ fontSize: 14, lineHeight: 1.7, color: '#666' }}>{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" style={{ padding: '100px 5%', background: '#fafafa', borderTop: '1px solid #f0f0f0' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Reveal>
            <div style={{ marginBottom: 64 }}>
              <div className="section-label">Process</div>
              <div className="divider" />
              <h2 style={{ fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 300, letterSpacing: '-1.5px', lineHeight: 1.2 }}>
                How it <span style={{ fontWeight: 600 }}>works</span>
              </h2>
            </div>
          </Reveal>

          <div className="steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 32 }}>
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 90}>
                <div style={{ position: 'relative' }}>
                  {i < STEPS.length - 1 && (
                    <div style={{ position: 'absolute', top: 18, left: '60%', right: '-40%', height: 1, background: '#e8e8e8' }} />
                  )}
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: '#111', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 600, marginBottom: 20,
                    fontFamily: "'DM Mono', monospace",
                  }}>
                    {s.n}
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 10, letterSpacing: '-0.3px' }}>{s.title}</h3>
                  <p style={{ fontSize: 14, lineHeight: 1.7, color: '#777' }}>{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={200}>
            <div style={{
              marginTop: 60, padding: '24px 32px',
              background: '#fff', border: '1px solid #ebebeb', borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 0, flexWrap: 'wrap',
              fontFamily: "'DM Mono', monospace", fontSize: 13,
            }}>
              {['Git Clone', 'Pattern Scanner', 'AST Analyzer', 'Scorer', 'Report'].map((step, i) => (
                <div key={step} style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ padding: '7px 16px', background: '#f5f5f5', borderRadius: 6, color: '#333', fontWeight: 500 }}>
                    {step}
                  </div>
                  {i < 4 && <span style={{ color: '#ccc', margin: '0 8px', fontSize: 16 }}>→</span>}
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── STACK ── */}
      <section id="stack" style={{ padding: '100px 5%' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Reveal>
            <div style={{ marginBottom: 48 }}>
              <div className="section-label">Technologies</div>
              <div className="divider" />
              <h2 style={{ fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 300, letterSpacing: '-1.5px', lineHeight: 1.2 }}>
                Built with <span style={{ fontWeight: 600 }}>modern tools</span>
              </h2>
              <p style={{ fontSize: 17, color: '#666', maxWidth: 480, lineHeight: 1.7, marginTop: 16 }}>
                Every technology was chosen deliberately. Each one solves a specific problem in the architecture.
              </p>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <StackCarousel />
          </Reveal>
        </div>
      </section>

      {/* ── ABOUT ── */}
      <section id="about" style={{ padding: '100px 5%', background: '#fafafa', borderTop: '1px solid #f0f0f0' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="about-grid" style={{ display: 'flex', gap: 80, alignItems: 'flex-start' }}>
            {/* Left */}
            <div style={{ flex: '0 0 45%' }}>
              <Reveal>
                <div className="section-label">The project</div>
                <div className="divider" />
                <h2 style={{ fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 300, letterSpacing: '-1.5px', lineHeight: 1.2, marginBottom: 24 }}>
                  Why DedSec<br /><span style={{ fontWeight: 600 }}>was built</span>
                </h2>
                <p style={{ fontSize: 16, lineHeight: 1.8, color: '#555', marginBottom: 20 }}>
                  DedSec started as a graduation project in Systems Analysis and Development, with a simple premise: most developers don't have access to professional security tooling. Enterprise solutions like Snyk or SonarQube are expensive and often overkill for smaller teams or individual projects.
                </p>
                <p style={{ fontSize: 16, lineHeight: 1.8, color: '#555', marginBottom: 20 }}>
                  The goal was to build something genuinely useful — a tool that any developer can point at a repository and immediately understand what security issues exist, where they are, and how to fix them.
                </p>
                <p style={{ fontSize: 16, lineHeight: 1.8, color: '#555' }}>
                  The name is a reference to the hacker collective from the Watch Dogs video game series — chosen because the project is about exposing hidden vulnerabilities before someone with bad intentions finds them first.
                </p>
              </Reveal>
            </div>

            {/* Right — principles */}
            <div style={{ flex: 1 }}>
              <Reveal delay={150}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {[
                    {
                      title: 'No code execution',
                      desc: 'The scanner clones repositories and reads files as plain text. It never imports, runs, or evaluates any code from the target repository.',
                    },
                    {
                      title: 'Three analysis layers',
                      desc: 'Pattern matching catches known signatures. AST analysis understands code structure. Rule-based detection finds logic-level issues that regex alone misses.',
                    },
                    {
                      title: 'Actionable results',
                      desc: 'Every finding includes the file path, line number, a code excerpt, CWE classification, OWASP category, and a specific remediation recommendation.',
                    },
                    {
                      title: 'Designed to grow',
                      desc: 'The scanner engine is modular — new detection rules can be added without touching the API or frontend. AI-enhanced analysis is planned for a future release.',
                    },
                  ].map((p, i) => (
                    <Reveal key={p.title} delay={i * 80}>
                      <div style={{
                        background: '#fff', border: '1px solid #ebebeb',
                        borderRadius: 12, padding: '24px 28px',
                      }}>
                        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, letterSpacing: '-0.3px' }}>{p.title}</h3>
                        <p style={{ fontSize: 14, lineHeight: 1.7, color: '#666' }}>{p.desc}</p>
                      </div>
                    </Reveal>
                  ))}
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ── USE CASES ── */}
      <section style={{ padding: '100px 5%' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Reveal>
            <div style={{ marginBottom: 56 }}>
              <div className="section-label">Use cases</div>
              <div className="divider" />
              <h2 style={{ fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 300, letterSpacing: '-1.5px', lineHeight: 1.2 }}>
                Who it's <span style={{ fontWeight: 600 }}>for</span>
              </h2>
            </div>
          </Reveal>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }} className="features-grid">
            {[
              {
                label: 'Developers',
                title: 'Before you ship',
                desc: 'Run a scan before opening a pull request or deploying a release. Catch credential leaks and injection vulnerabilities before they reach production.',
              },
              {
                label: 'Security students',
                title: 'Learn by example',
                desc: 'Scan open-source repositories to understand how real vulnerabilities appear in production code. Each finding links to CWE documentation.',
              },
              {
                label: 'Code reviewers',
                title: 'Augment your review',
                desc: 'Use DedSec as a first pass before a manual security review. Focus your attention on the findings the automated scanner flagged.',
              },
            ].map((u, i) => (
              <Reveal key={u.label} delay={i * 90}>
                <div style={{
                  padding: '40px 36px',
                  borderTop: '2px solid #111',
                  background: i === 1 ? '#111' : '#fff',
                  color: i === 1 ? '#fff' : '#111',
                }}>
                  <div style={{
                    fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
                    textTransform: 'uppercase', marginBottom: 16,
                    color: i === 1 ? '#888' : '#999',
                  }}>
                    {u.label}
                  </div>
                  <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16, letterSpacing: '-0.5px' }}>{u.title}</h3>
                  <p style={{ fontSize: 15, lineHeight: 1.7, color: i === 1 ? '#aaa' : '#666' }}>{u.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: '100px 5%', background: '#111', color: '#fff' }}>
        <div className="cta-inner" style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 40 }}>
          <Reveal>
            <div>
              <h2 style={{ fontSize: 'clamp(28px, 3.5vw, 48px)', fontWeight: 300, letterSpacing: '-1.5px', lineHeight: 1.2, marginBottom: 16 }}>
                Ready to scan<br /><span style={{ fontWeight: 600 }}>your repository?</span>
              </h2>
              <p style={{ fontSize: 17, color: '#888', maxWidth: 440, lineHeight: 1.7 }}>
                Create an account and run your first scan in under a minute. No setup required.
              </p>
            </div>
          </Reveal>
          <Reveal delay={150}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                onClick={() => navigate('/auth')}
                style={{
                  background: '#fff', color: '#111',
                  padding: '14px 28px', borderRadius: 6,
                  fontSize: 15, fontWeight: 500, fontFamily: 'inherit',
                  border: 'none', cursor: 'pointer',
                  transition: 'opacity 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                Get started →
              </button>
              <a
                href="https://github.com/Shokzin/dedsec"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center',
                  background: 'transparent', color: '#888',
                  padding: '13px 28px', borderRadius: 6,
                  fontSize: 15, fontWeight: 500, fontFamily: 'inherit',
                  border: '1.5px solid #333', cursor: 'pointer',
                  transition: 'border-color 0.2s, color 0.2s',
                  textDecoration: 'none',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#888'; e.currentTarget.style.color = '#fff' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = '#888' }}
              >
                View on GitHub
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ padding: '28px 5%', borderTop: '1px solid #222', background: '#111' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, color: '#555' }}>DedSec</span>
          <span style={{ fontSize: 13, color: '#555' }}>Graduation project — Systems Analysis and Development</span>
          <a
            href="https://github.com/Shokzin/dedsec"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 13, color: '#555', textDecoration: 'none', transition: 'color 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={e => (e.currentTarget.style.color = '#555')}
          >
            GitHub →
          </a>
        </div>
      </footer>
    </div>
  )
}