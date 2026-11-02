# Publicação

O sistema vai para o ar em três partes: o banco já está no Supabase, a API e a
fila vão para o Render e a interface vai para a Vercel. As três têm plano
gratuito suficiente para o porte do projeto.

A divisão não é arbitrária. A interface é um conjunto de arquivos estáticos e
fica mais rápida e mais barata numa rede de distribuição de conteúdo; a API
precisa de um processo sempre disponível e de acesso ao Redis.

---

## Antes de começar

Tenha em mãos, do painel do Supabase (*Project Settings → API*):

- a URL do projeto;
- a chave `anon`;
- a chave `service_role`.

A chave `service_role` ignora as políticas de segurança em nível de linha do
banco. Ela só pode existir no servidor — nunca em variável `VITE_`, que vai
inteira para o navegador.

Confirme também que o projeto do Supabase não está pausado. Ele hiberna sozinho
após um período sem uso, e o sintoma é um erro de conexão no login.

---

## 1. API e fila, no Render

O arquivo `render.yaml`, na raiz do repositório, descreve os dois serviços. O
Render lê esse arquivo e cria tudo de uma vez.

1. Em <https://dashboard.render.com>, escolha **New → Blueprint**.
2. Conecte a conta do GitHub e selecione o repositório `dedsec`.
3. O Render mostra o que vai criar: o serviço web `dedsec-api` e o
   `dedsec-redis`. Confirme.
4. Preencha os valores marcados como obrigatórios:

   | Variável | Valor |
   |---|---|
   | `SUPABASE_URL` | a URL do projeto |
   | `SUPABASE_ANON_KEY` | a chave `anon` |
   | `SUPABASE_SERVICE_ROLE_KEY` | a chave `service_role` |
   | `ALLOWED_ORIGINS` | deixe `http://localhost:5173` por enquanto |

   O `REDIS_URL` é preenchido sozinho, e o `SECRET_KEY` é gerado pelo Render.

5. Aguarde o primeiro build. Ao terminar, o endereço aparece no topo da página,
   no formato `https://dedsec-api.onrender.com`. **Anote.**
6. Confirme que subiu abrindo `https://dedsec-api.onrender.com/health`. A
   resposta esperada é `{"status":"ok","environment":"production"}`.

### O que esperar do plano gratuito

O serviço hiberna após cerca de 15 minutos sem requisições, e a primeira
chamada depois disso leva de 30 a 60 segundos para responder. Na apresentação,
abra o endereço alguns minutos antes para o serviço já estar acordado.

A API e o trabalhador do Celery dividem o mesmo contêiner, como explica o
comentário no `start.sh`: processos de segundo plano separados são recurso pago
no Render. No `docker-compose.yml`, usado em desenvolvimento, eles continuam
separados.

---

## 2. Interface, na Vercel

1. Em <https://vercel.com/new>, importe o mesmo repositório.
2. Em **Root Directory**, escolha `frontend`. Esse é o passo que mais passa
   despercebido: sem ele a Vercel tenta construir a raiz do repositório e falha.
3. O `frontend/vercel.json` já define o comando de build, a pasta de saída e o
   redirecionamento que faz as rotas internas funcionarem ao recarregar a
   página.
4. Em **Environment Variables**, informe:

   | Variável | Valor |
   |---|---|
   | `VITE_SUPABASE_URL` | a URL do projeto |
   | `VITE_SUPABASE_ANON_KEY` | a chave `anon` |
   | `VITE_API_URL` | o endereço do Render anotado no passo 1 |

5. Publique e anote o endereço, no formato `https://dedsec.vercel.app`.

---

## 3. Fechar o CORS

Volte ao Render, em `dedsec-api` → *Environment*, e troque `ALLOWED_ORIGINS`
pelo endereço da Vercel:

```
https://dedsec.vercel.app
```

Para liberar também os endereços de pré-visualização que a Vercel cria a cada
branch, use uma lista separada por vírgula:

```
https://dedsec.vercel.app,https://dedsec-git-main-seuusuario.vercel.app
```

O serviço reinicia sozinho. Sem esse passo, o navegador bloqueia as chamadas e
a interface aparece vazia, sem erro visível na tela — o motivo fica apenas no
console.

---

## 4. Autorizar os endereços no Supabase

Em *Authentication → URL Configuration*:

- **Site URL**: o endereço da Vercel;
- **Redirect URLs**: acrescente `https://dedsec.vercel.app/reset-password`.

Sem isso, o link de redefinição de senha enviado por e-mail leva de volta para
`localhost`.

---

## Conferência final

| Verificação | Como |
|---|---|
| API no ar | `https://dedsec-api.onrender.com/health` responde `ok` |
| Documentação fechada | `/docs` responde 404 em produção |
| Interface carrega | o painel abre e lista as análises |
| Análise completa | submeter um repositório público conclui com relatório |
| Limite ativo | repetir a submissão seis vezes em um minuto devolve o aviso de excesso |
| CORS correto | o console do navegador não acusa bloqueio |

A documentação interativa em `/docs` fica desligada fora de desenvolvimento,
conforme `app/main.py`, para não expor a superfície da API.

---

## Se algo falhar

**O build da API falha na instalação das dependências.** Verifique se o
`requirements.txt` não foi alterado; o `git` é instalado pela imagem e é
necessário em tempo de execução, porque o scanner clona os repositórios.

**A API sobe mas toda chamada devolve erro de autenticação.** As chaves do
Supabase foram trocadas entre si, ou a `service_role` ficou com a `anon`.

**A interface carrega mas nenhuma chamada funciona.** O `ALLOWED_ORIGINS` no
Render não corresponde ao endereço exato da Vercel. Compare incluindo o
`https://` e sem barra no final.

**As análises ficam presas em "na fila".** O trabalhador não subiu. Veja os
registros do serviço no Render: a linha `iniciando trabalhador do Celery` deve
aparecer logo antes de `iniciando API`.
