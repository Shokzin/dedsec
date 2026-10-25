# DedSec para VS Code

Mostra vulnerabilidades de segurança direto no editor, enquanto você digita,
antes de qualquer commit. Usa o scanner local do DedSec (Regex + AST), sem internet.

- Sublinha a linha com a falha (vermelho = high/critical, amarelo = medium).
- Passe o mouse para ver a explicação e como corrigir; o CWE abre a página oficial.
- Lâmpada (Ctrl+.) > "ignorar este achado" acrescenta `dedsec: ignore` na linha.
- Comandos (Ctrl+Shift+P): "DedSec: Analisar arquivo atual" e "DedSec: Analisar projeto inteiro".
- Respeita o `.dedsec.toml` do projeto.

Requisitos: Python 3.10+ e a pasta `backend/scanner` do projeto aberta no VS Code.
