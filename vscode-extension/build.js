// Copia o scanner do backend para dentro da extensao, antes de empacotar.
//
// O codigo vive em um lugar so: backend/scanner. Esta copia e gerada, nao
// versionada, para que a extensao funcione em qualquer projeto e nao apenas
// dentro do repositorio do DedSec.
const fs = require("fs");
const path = require("path");

// Apenas o que o CLI local precisa. pipeline.py e git_fetcher.py ficam de fora:
// pertencem ao caminho web e trariam dependencias externas.
const ARQUIVOS = [
  "__init__.py",
  "__main__.py",
  "cli.py",
  "engine/__init__.py",
  "engine/finding.py",
  "engine/local_scanner.py",
  "engine/pattern_scanner.py",
  "engine/ast_analyzer.py",
];

const origem = path.join(__dirname, "..", "backend", "scanner");
const destino = path.join(__dirname, "scanner");

if (!fs.existsSync(path.join(origem, "cli.py"))) {
  console.error("nao encontrei o scanner em " + origem);
  process.exit(1);
}

// Sobrescreve em vez de apagar a pasta: apagar nem sempre e permitido
// (pastas sincronizadas, permissoes restritas) e aqui nao e necessario,
// porque a lista de arquivos e fixa.
for (const rel of ARQUIVOS) {
  const de = path.join(origem, rel);
  const para = path.join(destino, rel);
  if (!fs.existsSync(de)) {
    console.error("faltando: " + rel);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(para), { recursive: true });
  fs.copyFileSync(de, para);
}
console.log("scanner embutido: " + ARQUIVOS.length + " arquivos");
