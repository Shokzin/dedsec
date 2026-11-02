// Parte sem dependência do VS Code: acha o Python, acha o scanner e executa o CLI.
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Mesmo launcher usado pelo hook do git: importa scanner.cli a partir de uma pasta.
const LAUNCHER =
  "import sys; sys.path.insert(0, sys.argv[1]); del sys.argv[1]; " +
  "from scanner.cli import main; sys.exit(main())";

function findPython(preferred) {
  const candidates = preferred ? [preferred] : ["python", "python3", "py"];
  for (const cmd of candidates) {
    const r = spawnSync(cmd, ["-c", "import sys; sys.exit(sys.version_info < (3, 10))"], {
      timeout: 8000,
      windowsHide: true,
    });
    if (r.status === 0) return cmd;
  }
  return null;
}

function hasScanner(dir) {
  return fs.existsSync(path.join(dir, "scanner", "cli.py"));
}

// A extensao traz uma copia do scanner (pasta "scanner" ao lado deste arquivo,
// gerada por build.js). Sem ela, a extensao so funcionaria dentro do proprio
// repositorio do DedSec, que e onde existe backend/scanner.
const SCANNER_EMBUTIDO = __dirname;

function detectScannerDir(workspaceRoot, configured) {
  if (configured) {
    const abs = path.isAbsolute(configured) ? configured : path.join(workspaceRoot, configured);
    return hasScanner(abs) ? abs : null;
  }
  // O scanner do projeto aberto vem primeiro: quem desenvolve o DedSec testa as
  // regras que esta editando, nao as da versao empacotada.
  const candidatos = [];
  if (workspaceRoot) {
    candidatos.push(path.join(workspaceRoot, "backend"), workspaceRoot);
  }
  candidatos.push(SCANNER_EMBUTIDO);
  for (const dir of candidatos) {
    if (hasScanner(dir)) return dir;
  }
  return null;
}

function toPosix(p) {
  return p.split(path.sep).join("/");
}

function runScan({ python, scannerDir, cwd, args, stdin }) {
  let child;
  let cancelled = false;
  const promise = new Promise((resolve) => {
    child = spawn(python, ["-c", LAUNCHER, scannerDir, ...args], {
      cwd,
      windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });
    let out = "";
    let err = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => resolve({ ok: false, cancelled, error: String((e && e.message) || e) }));
    child.on("close", (code) => {
      if (cancelled) return resolve({ ok: false, cancelled: true });
      if (code !== 0 && code !== 1) {
        return resolve({ ok: false, error: (err || out).trim() || `código de saída ${code}` });
      }
      try {
        resolve({ ok: true, data: JSON.parse(out), warnings: err.trim() });
      } catch (_) {
        resolve({ ok: false, error: "saída inválida do scanner: " + out.slice(0, 200) });
      }
    });
    if (stdin !== undefined) {
      child.stdin.on("error", () => {});
      child.stdin.end(stdin, "utf8");
    }
  });
  return {
    promise,
    cancel() {
      cancelled = true;
      try { child.kill(); } catch (_) {}
    },
  };
}

module.exports = { findPython, detectScannerDir, runScan, toPosix };
