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

Também é possível baixar o `.vsix` em https://dedsec-security.vercel.app e usar
**Extensions: Install from VSIX...**.

**Requisito:** Python 3.11 ou mais novo instalado e acessível no PATH.

## Privacidade e segurança

Tudo roda na sua máquina: o código nunca é enviado para lugar nenhum.

A extensão nunca executa código do projeto aberto: usa sempre o scanner
embutido e chama o Python pelo caminho absoluto. A configuração
`dedsec.pythonPath` só vale nas configurações de usuário; o
`.vscode/settings.json` de um projeto não a altera.

## Licença

Uso gratuito. Copiar, modificar ou redistribuir a extensão ou o seu código não
é permitido. Veja o arquivo LICENSE.
