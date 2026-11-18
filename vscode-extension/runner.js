// Parte sem dependência do VS Code: acha o Python, acha o scanner e executa o CLI.
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Mesmo launcher usado pelo hook do git: importa scanner.cli a partir de uma pasta.
//
// Com "python -c", o diretorio atual (aqui, a pasta do projeto aberto) entra no
// topo de sys.path. Um projeto com um json.py ou ast.py na raiz substituiria a
// biblioteca padrao e teria o proprio codigo executado. Por isso o launcher tira
// "" e "." de sys.path antes de importar qualquer coisa, e PYTHONSAFEPATH faz o
// mesmo nas versoes 3.11+ do Python.
const LAUNCHER =
  "import sys; sys.path[:] = [p for p in sys.path if p not in ('', '.')]; " +
  "sys.path.insert(0, sys.argv[1]); del sys.argv[1]; " +
  "from scanner.cli import main; sys.exit(main())";

// Devolve o caminho ABSOLUTO do interpretador. Executar "python" pelo nome com
// a pasta do projeto como diretorio atual faria o Windows procurar primeiro um
// python.exe dentro do projeto, que qualquer repositorio poderia trazer.
// A procura em si roda a partir da pasta da extensao, pelo mesmo motivo.
function findPython(preferred) {
  const candidates = preferred ? [preferred] : ["python", "python3", "py"];
  for (const cmd of candidates) {
    const r = spawnSync(
      cmd,
      ["-c", "import sys; assert sys.version_info >= (3, 11); print(sys.executable)"],
      { cwd: __dirname, timeout: 8000, windowsHide: true, encoding: "utf8" },
    );
    if (r.status !== 0 || !r.stdout) continue;
    const exe = r.stdout.trim().split(/\r?\n/).pop();
    if (exe && path.isAbsolute(exe) && fs.existsSync(exe)) return exe;
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

// Usa sempre o scanner embutido. Procurar um scanner/cli.py dentro do projeto
// aberto, como as versoes anteriores faziam, executava o codigo de qualquer
// repositorio que trouxesse um arquivo com esse nome.
//
// Para testar regras em desenvolvimento, defina "dedsec.scannerDir" nas
// configuracoes de USUARIO (a configuracao tem escopo "machine": o
// .vscode/settings.json de um projeto nao consegue altera-la).
function detectScannerDir(workspaceRoot, configured) {
  if (configured) {
    const abs = path.isAbsolute(configured)
      ? configured
      : workspaceRoot ? path.join(workspaceRoot, configured) : null;
    return abs && hasScanner(abs) ? abs : null;
  }
  return hasScanner(SCANNER_EMBUTIDO) ? SCANNER_EMBUTIDO : null;
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
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONSAFEPATH: "1" },
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
