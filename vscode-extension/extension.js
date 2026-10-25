const vscode = require("vscode");
const path = require("path");
const { findPython, detectScannerDir, runScan, toPosix } = require("./runner");

const SUPPORTED = new Set([
  ".py", ".js", ".ts", ".jsx", ".tsx", ".php", ".rb", ".java", ".go",
  ".html", ".htm", ".env", ".cfg", ".conf", ".ini", ".yaml", ".yml", ".json",
]);
const HASH_COMMENT = new Set([".py", ".rb", ".yaml", ".yml", ".env", ".ini", ".cfg", ".conf"]);
const SLASH_COMMENT = new Set([".js", ".ts", ".jsx", ".tsx", ".php", ".java", ".go"]);
const DEBOUNCE_MS = 600;

function isSupported(doc) {
  if (doc.uri.scheme !== "file") return false;
  const base = path.basename(doc.fileName).toLowerCase();
  return base === ".env" || base.startsWith(".env.") || SUPPORTED.has(path.extname(base));
}

function severityOf(level) {
  const S = vscode.DiagnosticSeverity;
  if (level === "critical" || level === "high") return S.Error;
  if (level === "medium") return S.Warning;
  return S.Information;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function activate(context) {
  const output = vscode.window.createOutputChannel("DedSec");
  const diagnostics = vscode.languages.createDiagnosticCollection("dedsec");
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
  status.command = "workbench.actions.view.problems";
  context.subscriptions.push(output, diagnostics, status);

  const timers = new Map();   // uri -> timeout (debounce)
  const running = new Map();  // uri -> { cancel }
  const warned = new Set();
  let pythonCmd; // undefined = ainda não procurou; null = não achou

  function notifyOnce(key, message) {
    if (warned.has(key)) return;
    warned.add(key);
    vscode.window.showWarningMessage(message);
  }

  function getPython() {
    if (pythonCmd === undefined) {
      const preferred = vscode.workspace.getConfiguration("dedsec").get("pythonPath") || "";
      pythonCmd = findPython(preferred.trim());
    }
    if (!pythonCmd) {
      notifyOnce("python", "DedSec: não encontrei o Python 3.10+. Instale ou defina 'dedsec.pythonPath'.");
    }
    return pythonCmd;
  }

  function getContext(uri) {
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (!folder) return null;
    const root = folder.uri.fsPath;
    const configured = (vscode.workspace.getConfiguration("dedsec").get("scannerDir") || "").trim();
    const scannerDir = detectScannerDir(root, configured);
    if (!scannerDir) {
      notifyOnce("scanner", "DedSec: não achei a pasta do scanner (scanner/cli.py). Defina 'dedsec.scannerDir'.");
      return null;
    }
    const python = getPython();
    if (!python) return null;
    return { root, scannerDir, python };
  }

  function updateStatus() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !isSupported(editor.document)) {
      status.hide();
      return;
    }
    const count = (diagnostics.get(editor.document.uri) || []).length;
    status.text = count ? `$(shield) DedSec: ${count}` : "$(shield) DedSec: ok";
    status.tooltip = count ? "Vulnerabilidades neste arquivo (clique para abrir Problemas)" : "Nenhum achado neste arquivo";
    status.show();
  }

  function toDiagnostic(doc, f) {
    const last = doc.lineCount - 1;
    const startLine = clamp(f.line_start - 1, 0, last);
    const endLine = clamp(f.line_end - 1, startLine, last);
    const range = new vscode.Range(
      startLine,
      doc.lineAt(startLine).firstNonWhitespaceCharacterIndex,
      endLine,
      doc.lineAt(endLine).range.end.character
    );
    const d = new vscode.Diagnostic(range, `${f.title}\n→ ${f.recommendation}`, severityOf(f.severity));
    d.source = "DedSec";
    if (f.cwe_id) {
      const num = String(f.cwe_id).replace(/\D/g, "");
      d.code = num
        ? { value: f.cwe_id, target: vscode.Uri.parse(`https://cwe.mitre.org/data/definitions/${num}.html`) }
        : f.cwe_id;
    }
    return d;
  }

  async function scanDocument(doc) {
    if (!isSupported(doc)) return;
    const ctx = getContext(doc.uri);
    if (!ctx) return;
    const rel = toPosix(path.relative(ctx.root, doc.uri.fsPath));
    if (!rel || rel.startsWith("..")) return; // fora do projeto

    const key = doc.uri.toString();
    if (running.has(key)) running.get(key).cancel();
    const handle = runScan({
      python: ctx.python,
      scannerDir: ctx.scannerDir,
      cwd: ctx.root,
      args: ["scan", "--stdin", "--stdin-filename", rel, "--json", "--fail-on", "none"],
      stdin: doc.getText(),
    });
    running.set(key, handle);
    const result = await handle.promise;
    if (running.get(key) === handle) running.delete(key);
    if (result.cancelled) return;
    if (!result.ok) {
      output.appendLine(`[erro] ${rel}: ${result.error}`);
      notifyOnce("run-error", "DedSec: o scanner falhou. Veja o painel 'Saída' > DedSec.");
      return;
    }
    if (result.warnings) output.appendLine(`[aviso] ${result.warnings}`);
    diagnostics.set(doc.uri, result.data.findings.map((f) => toDiagnostic(doc, f)));
    updateStatus();
  }

  function schedule(doc, delay) {
    if (!isSupported(doc)) return;
    const key = doc.uri.toString();
    if (timers.has(key)) clearTimeout(timers.get(key));
    timers.set(key, setTimeout(() => { timers.delete(key); scanDocument(doc); }, delay));
  }

  async function scanWorkspace() {
    const folders = vscode.workspace.workspaceFolders || [];
    if (!folders.length) return;
    diagnostics.clear();
    let total = 0;
    for (const folder of folders) {
      const ctx = getContext(folder.uri);
      if (!ctx) continue;
      const result = await runScan({
        python: ctx.python, scannerDir: ctx.scannerDir, cwd: ctx.root,
        args: ["scan", ".", "--json", "--fail-on", "none"],
      }).promise;
      if (!result.ok) {
        output.appendLine(`[erro] workspace: ${result.error}`);
        vscode.window.showErrorMessage("DedSec: falha ao analisar o projeto. Veja Saída > DedSec.");
        return;
      }
      const byFile = new Map();
      for (const f of result.data.findings) {
        if (!byFile.has(f.file_path)) byFile.set(f.file_path, []);
        byFile.get(f.file_path).push(f);
      }
      for (const [file, list] of byFile) {
        const uri = vscode.Uri.file(path.join(ctx.root, file));
        const doc = await vscode.workspace.openTextDocument(uri);
        diagnostics.set(uri, list.map((f) => toDiagnostic(doc, f)));
      }
      total += result.data.total;
    }
    updateStatus();
    vscode.window.showInformationMessage(
      total ? `DedSec: ${total} achado(s) no projeto. Veja o painel Problemas.` : "DedSec: nenhum achado no projeto."
    );
  }

  // Quick fix: acrescenta "dedsec: ignore" no fim da linha
  const actions = {
    provideCodeActions(doc, range, ctx) {
      const ext = path.extname(doc.fileName).toLowerCase();
      const base = path.basename(doc.fileName).toLowerCase();
      const marker = HASH_COMMENT.has(ext) || base === ".env" || base.startsWith(".env.")
        ? "#" : SLASH_COMMENT.has(ext) ? "//" : null;
      if (!marker) return [];
      const result = [];
      for (const d of ctx.diagnostics) {
        if (d.source !== "DedSec") continue;
        const line = doc.lineAt(d.range.start.line);
        const action = new vscode.CodeAction("DedSec: ignorar este achado (dedsec: ignore)", vscode.CodeActionKind.QuickFix);
        action.diagnostics = [d];
        action.edit = new vscode.WorkspaceEdit();
        action.edit.insert(doc.uri, line.range.end, `  ${marker} dedsec: ignore`);
        result.push(action);
      }
      return result;
    },
  };

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider({ scheme: "file" }, actions, {
      providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
    }),
    vscode.workspace.onDidOpenTextDocument((doc) => schedule(doc, 0)),
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (vscode.workspace.getConfiguration("dedsec").get("runOn") === "type") schedule(e.document, DEBOUNCE_MS);
    }),
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (path.basename(doc.fileName) === ".dedsec.toml") {
        vscode.workspace.textDocuments.forEach((d) => schedule(d, 0)); // config mudou: reanalisa tudo
      } else {
        schedule(doc, 0);
      }
    }),
    vscode.workspace.onDidCloseTextDocument((doc) => {
      const key = doc.uri.toString();
      if (timers.has(key)) { clearTimeout(timers.get(key)); timers.delete(key); }
      if (running.has(key)) { running.get(key).cancel(); running.delete(key); }
    }),
    vscode.window.onDidChangeActiveTextEditor(updateStatus),
    vscode.commands.registerCommand("dedsec.scanFile", () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) schedule(editor.document, 0);
    }),
    vscode.commands.registerCommand("dedsec.scanWorkspace", scanWorkspace)
  );

  vscode.workspace.textDocuments.forEach((doc) => schedule(doc, 0));
  updateStatus();
}

function deactivate() {}

module.exports = { activate, deactivate };
