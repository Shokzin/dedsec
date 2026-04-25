# DedSec — Vulnerability Analysis Platform

<p align="center">
  <img src="https://img.shields.io/badge/python-3.11-3776AB?style=flat-square&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/react-18-61DAFB?style=flat-square&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/fastapi-0.111-009688?style=flat-square&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/supabase-2.4-3ECF8E?style=flat-square&logo=supabase&logoColor=white" />
  <img src="https://img.shields.io/badge/docker-ready-2496ED?style=flat-square&logo=docker&logoColor=white" />
</p>

> Graduation project — Systems Analysis and Development.  
> Submit any public GitHub repository URL and receive a detailed security vulnerability report.

---

## What it does

DedSec scans public GitHub repositories for security vulnerabilities without executing a single line of code from the target. You paste a URL, the platform clones the repository, runs three layers of static analysis in parallel, and returns a structured report within seconds.

Each finding includes the exact file path, line number, severity rating, CWE classification, OWASP category, a code excerpt, and a specific remediation recommendation.

---

## What it detects

| Category | Examples |
|---|---|
| **Secrets & Credentials** | API keys, hardcoded passwords, tokens, AWS credentials, private keys |
| **Injection Vulnerabilities** | SQL injection, XSS, command injection, path traversal |
| **Misconfigurations** | Exposed `.env` files, debug mode in production, CORS wildcards, insecure cookies |
| **Code Structure Issues** | Unsafe `eval()`, `exec()`, `pickle`, dynamic code execution, dangerous subprocess calls |
| **Access Control Flaws** | IDOR patterns, missing authentication checks, mass assignment |

Results are scored from 0 to 100 using a weighted algorithm with diminishing penalties, so large codebases are assessed fairly.

---

## How it works

```
User submits GitHub URL
        │
        ▼
FastAPI receives request → queues Celery task → returns scan_id immediately
        │
        ▼
Celery worker picks up the task
        │
        ├─ GitPython clones the repository into a temp directory
        │
        ├─ Layer 1: Pattern Scanner (regex across all files)
        ├─ Layer 2: AST Analyzer (Python Abstract Syntax Tree parsing)
        └─ Layer 3: Rule Engine (logic-based detection)
                │
                ▼
        Scorer calculates security score
                │
                ▼
        Results saved to Supabase (PostgreSQL)
                │
                ▼
Frontend receives real-time updates via Supabase Realtime + polling fallback
                │
                ▼
        Full report rendered with expandable vulnerability cards
```

---

## Tech stack

| Technology | Role |
|---|---|
| Python 3.11 | Backend language and scanner engine |
| FastAPI | REST API with automatic OpenAPI docs |
| Celery | Asynchronous task queue (scan runs in background) |
| Redis | Message broker between API and worker |
| Supabase | PostgreSQL database, authentication, Realtime, RLS |
| React 18 + TypeScript | Frontend — component-based, type-safe |
| Vite | Frontend build tool |
| Docker Compose | Orchestrates API, worker, Redis as isolated containers |

---

---

## Roadmap

- [x] Pattern-based detection
- [x] AST code structure analysis
- [x] Real-time scan progress via Supabase Realtime
- [x] Authentication (email/password + GitHub OAuth + Google OAuth)
- [x] Scan history with delete support
- [x] Light/dark theme
- [ ] AI layer — Anthropic Claude integration (next semester)

---

*Named after the hacker collective from the Watch Dogs series — exposing vulnerabilities before someone with bad intentions does.*
