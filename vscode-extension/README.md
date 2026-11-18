# DedSec para VS Code

Mostra vulnerabilidades de segurança direto no editor, enquanto você digita,
antes de qualquer commit. Usa o scanner local do DedSec (Regex + AST), sem internet.

- Sublinha a linha com a falha (vermelho = high/critical, amarelo = medium).
- Passe o mouse para ver a explicação e como corrigir; o CWE abre a página oficial.
- Lâmpada (Ctrl+.) > "ignorar este achado" acrescenta `dedsec: ignore` na linha.
- Comandos (Ctrl+Shift+P): "DedSec: Analisar arquivo atual" e "DedSec: Analisar projeto inteiro".
- Respeita o `.dedsec.toml` do projeto.

## Instalação

No VS Code, abra o painel de extensões (Ctrl+Shift+X), procure por **DedSec**
e clique em Instalar. Pela paleta de comandos, `ext install DedSec.dedsec`.

Página no Marketplace:
https://marketplace.visualstudio.com/items?itemName=DedSec.dedsec

Também é possível baixar o `.vsix` em https://dedsec-beta.vercel.app e usar
**Extensions: Install from VSIX...**.

**Requisito:** Python 3.11 ou mais novo instalado e acessível no PATH.

O scanner vem embutido na extensão e funciona em qualquer projeto, sem
internet. A extensão nunca executa código do projeto aberto: usa sempre o
scanner embutido e chama o Python pelo caminho absoluto.

As configurações `dedsec.pythonPath` e `dedsec.scannerDir` só valem nas
configurações de usuário; o `.vscode/settings.json` de um projeto não as altera.
Para testar regras em desenvolvimento, aponte `dedsec.scannerDir` para a pasta
`backend` do seu clone do DedSec.

## Como gerar o pacote

```
npm run package
```

O comando copia `backend/scanner` para dentro da extensão (`build.js`) e gera o
`.vsix`. A cópia não é versionada: o código vive apenas em `backend/scanner`.
Depois de gerar, atualize também `frontend/public/`, que é de onde o site serve
o download.
