# DedSec — Vulnerability Analysis Platform

<p align="center">
  <img src="https://img.shields.io/badge/python-3.11-3776AB?style=flat-square&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/react-18-61DAFB?style=flat-square&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/fastapi-0.111-009688?style=flat-square&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/supabase-2.4-3ECF8E?style=flat-square&logo=supabase&logoColor=white" />
  <img src="https://img.shields.io/badge/celery-5.4-37814A?style=flat-square&logo=celery&logoColor=white" />
  <img src="https://img.shields.io/badge/redis-7.4-DC382D?style=flat-square&logo=redis&logoColor=white" />
  <img src="https://img.shields.io/badge/docker-ready-2496ED?style=flat-square&logo=docker&logoColor=white" />
</p>

> Graduation project — Systems Analysis and Development.  
> Submit any public GitHub repository URL and receive a detailed security vulnerability report in seconds.

---

## What it does

DedSec scans public GitHub repositories for security vulnerabilities without executing a single line of code from the target. You paste a URL, the platform clones the repository, runs multiple layers of static analysis, and returns a structured report within seconds.

Each finding includes the exact file path, line number, severity rating, CWE classification, OWASP category, a code excerpt, and a specific remediation recommendation.

All scan history is isolated per user — no user can see another user's scans.

---

## What it detects

| Category | Examples |
|---|---|
| **Secrets & Credentials** | API keys, hardcoded passwords, tokens, AWS credentials, GitHub tokens, private keys |
| **Injection Vulnerabilities** | SQL injection, XSS via innerHTML/document.write, command injection via os.system, path traversal |
| **Misconfigurations** | Debug mode in production, CORS wildcards, SSL verification disabled |
| **Code Structure Issues** | Unsafe `eval()`, `exec()`, `pickle.loads()`, weak hashes (MD5/SHA1), subprocess with `shell=True` |
| **Access Control Flaws** | IDOR patterns, missing authentication checks, mass assignment via req.body spread |

Results are scored from 0 to 100 using a weighted algorithm with diminishing penalties, so large codebases are assessed fairly.

---

## Detections — Semester 1 (20 active rules)

| # | Detection | Severity | Type |
|---|---|---|---|
| 1 | Dynamic Code Execution via `eval()` | Critical | Code Quality |
| 2 | Dynamic Code Execution via `exec()` | Critical | Code Quality |
| 3 | Unsafe Deserialization with `pickle.loads()` | Critical | Code Quality |
| 4 | Hardcoded Password or Secret | Critical | Secrets |
| 5 | Hardcoded Cloud or Service Credential | Critical | Secrets |
| 6 | SQL Injection via String Formatting | Critical | Injection |
| 7 | SQL Injection — Raw Query Construction | Critical | Injection |
| 8 | Command Injection via `os.system()` | Critical | Injection |
| 9 | Cross-Site Scripting via `innerHTML` | High | XSS |
| 10 | Cross-Site Scripting via `document.write()` | High | XSS |
| 11 | Path Traversal via `open()` | High | Injection |
| 12 | subprocess Called with `shell=True` | High | Injection |
| 13 | Route Potentially Missing Authentication Check | High | Access Control |
| 14 | Potential Insecure Direct Object Reference (IDOR) | High | Access Control |
| 15 | Mass Assignment via Spread of `req.body` | High | Access Control |
| 16 | Use of Weak Cryptographic Hash (MD5/SHA1) | Medium | Code Quality |
| 17 | Debug Mode Enabled in Production | Medium | Misconfiguration |
| 18 | CORS Wildcard Origin | Medium | Misconfiguration |
| 19 | Private Key in Source Code | Critical | Secrets |
| 20 | SSL/TLS Certificate Verification Disabled | High | Misconfiguration |

---

## How it works

```
User submits GitHub URL
        │
        ▼
FastAPI receives request → validates JWT → queues Celery task → returns scan_id immediately
        │
        ▼
Celery worker picks up the task
        │
        ├─ GitPython clones the repository into a secure temp directory
        │
        ├─ Layer 1: Pattern Scanner (regex across all supported file types)
        ├─ Layer 2: AST Analyzer (Python Abstract Syntax Tree parsing)
        └─ Layer 3: Rule Engine (logic-based cross-pattern detection)
                │
                ▼
        Deduplication — findings from multiple layers merged by file + line + title
                │
                ▼
        Scorer calculates security score (0–100, weighted with diminishing penalties)
                │
                ▼
        Results saved to Supabase (PostgreSQL) with user_id isolation
                │
                ▼
Frontend receives real-time updates via Supabase Realtime + polling fallback
                │
                ▼
        Full report rendered with expandable vulnerability cards
```

## Tech stack

| Technology | Role |
|---|---|
| Python 3.11 | Backend language and scanner engine |
| FastAPI | REST API with JWT authentication via Bearer token |
| Celery | Asynchronous task queue (scans run in background workers) |
| Redis | Message broker between API and Celery worker |
| Supabase | PostgreSQL database, authentication, Realtime, Row Level Security |
| GitPython | Clones repositories into isolated temp directories |
| React 18 + TypeScript | Frontend — component-based, fully type-safe |
| Vite | Frontend build tool with hot reload |
| TailwindCSS | Utility-first styling |
| Docker Compose | Orchestrates API, worker, and Redis as isolated containers |

---

## Authentication

- Email/password sign up and sign in
- GitHub OAuth
- Google OAuth
- Password reset via email (custom branded template via Resend SMTP)
- Per-user scan isolation — users only see their own scan history
- JWT decoded server-side on every request without external HTTP calls

---

## Roadmap

**Semester 1 — completed ✅**
- [x] Pattern-based detection (20 rules across 5 categories)
- [x] AST code structure analysis
- [x] Multi-layer deduplication
- [x] Security score algorithm (0–100)
- [x] Real-time scan progress via Supabase Realtime
- [x] Authentication — email/password + GitHub OAuth + Google OAuth
- [x] Password reset with branded email template
- [x] Per-user scan isolation with JWT verification
- [x] Scan history with delete support
- [x] Expandable vulnerability cards with CWE/OWASP references
- [x] Light/dark theme
- [x] Profile page — avatar upload, display name, password change, account deletion
- [x] Custom branded email templates via Resend

**Semester 2 — planned 🔜**
- [ ] AI layer — AI integration for context-aware analysis
- [ ] 10 new detection rules (Open Redirect, JWT None Algorithm, Prototype Pollution, and more)
- [ ] Export report as PDF
- [ ] Compare two scans — diff between runs
- [ ] Public shareable report links
- [ ] Dashboard charts — vulnerability trends over time
- [ ] Rate limiting on scan endpoint
- [ ] Scan history pagination
- [ ] Centralized JWT middleware
- [ ] Full deployment

---

*Named after the hacker collective from the Watch Dogs series — exposing vulnerabilities before someone with bad intentions does.*
