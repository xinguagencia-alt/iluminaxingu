# IluminaXingu - Guia de Deploy (Vercel + Supabase)

## URLs de Produção (Operação)

| Serviço | URL |
|---------|-----|
| Portal do munícipe | https://iluminaxingu.vercel.app |
| Painel administrativo (prefeitura) | https://iluminaxingu.vercel.app/prefeitura |
| API | https://iluminaxingu-api.vercel.app |
| Health check da API | https://iluminaxingu-api.vercel.app/health |

### Modo offline (PWA)

- O portal é uma PWA: o primeiro acesso instala o app (banner/ícone) e o Service Worker
  guarda as telas e os dados de leitura (postes, bairros, ruas) em cache.
- Sem internet, o formulário **salva a solicitação no aparelho** (IndexedDB) e ela é
  **sincronizada automaticamente** quando a conexão volta; o protocolo oficial é gerado
  nesse momento. O envio é idempotente: repetir o envio com o mesmo `client_request_id`
  **não cria duplicidade** (a API retorna HTTP 200 com o mesmo protocolo).
- O modo offline **ainda não foi homologado em navegador/celular real** — valide em
  ao menos um iPhone e um Android antes da apresentação (teste: modo avião → enviar →
  reabrir online → confirmar protocolo).

### Limitações no iPhone

- iOS 13+ necessário; o app deve ser instalado por **Compartilhar → Adicionar à Tela de Início**
  (Safari). O ícone na tela funciona como app standalone.
- O iOS pode **descartar dados do IndexedDB** quando o armazenamento está sob pressão —
  não confie no aparelho como único registro: o cidadão deve guardar o protocolo.
- Não há Background Sync no iOS: a sincronização acontece ao **abrir o portal** com conexão.
- Notificações push e instalação automática não existem no iOS como no Android.

### Acesso administrativo

1. Painel: https://iluminaxingu.vercel.app/prefeitura
2. O **primeiro** administrador é criado pelo formulário de bootstrap exibido quando
   `GET /api/auth/bootstrap` responde `hasAdmins: false` (endpoint cria o admin apenas
   nesse caso; depois disso retorna 403 "Bootstrap ja foi realizado").
3. Depois do primeiro admin, acessar apenas com login (`POST /api/auth/login`) — rate
   limit de 10 tentativas/15min.
4. **Não há reset de senha por e-mail.** Se as credenciais forem perdidas, a recuperação
   exige acesso de dono ao banco (Supabase → SQL Editor → atualizar `password_hash` em
   `admin_users` com hash bcrypt) e é decisão do proprietário. O endpoint `/api/auth/seed`
   é bloqueado em `NODE_ENV=production`.

### Cuidados com dados de homologação

- Existem solicitações e anexos de teste identificados como **TESTE HOMOLOGACAO**
  (solicitações 13, 14, 15, 16 e anexos 3 e 4). **Não excluir** dados reais ao removê-los;
  filtre por `nome_solicitante = 'TESTE HOMOLOGACAO'` ou pelos protocolos anotados.
- Eles servem para provar idempotência e fluxo online; remova apenas após a homologação
  formal, com registro do que foi apagado.

### Publicação da API

- O projeto **iluminaxingu-api** não está conectado ao Git: o deploy da API é manual,
  a partir da pasta `deploy/api`:
  `vercel login` (se necessário) e depois `vercel deploy --prod`.
- O frontend (projeto **iluminaxingu**) publica automaticamente a cada push em `main`.

## Arquitetura Atual

```
┌─────────────────────────────┐     ┌─────────────────────────────┐
│   Frontend (Vercel)         │     │   API (Vercel Serverless)    │
│   iluminaxingu.vercel.app   │────▶│   iluminaxingu-api.vercel.app│
└─────────────────────────────┘     └──────────────┬──────────────┘
                                                   │
                                         ┌─────────▼─────────┐
                                         │  Supabase (Free)   │
                                         │  PostgreSQL + PostGIS│
                                         └───────────────────┘
```

## Passo a Passo

### 1. Criar Projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie uma conta gratuita
2. Clique em "New Project"
3. Preencha:
   - **Project name:** iluminaxingu
   - **Database Password:** (anote esta senha!)
   - **Region:** Brasil (ou mais próxima)
4. Aguarde o projeto ser criado
5. Vá em **Settings → Database** e copie a **Connection string** (URI)
   - Use o formato do **pooler** (obrigatório em produção):
     `postgresql://postgres.[REF]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres`
   - **Atenção:** o host direto `db.[REF].supabase.co` pode não resolver (sem registro A)
     e causa timeout de conexão. Prefira sempre o host do pooler acima.

### 2. Rodar Migration no Supabase

1. No painel do Supabase, vá em **SQL Editor**
2. Clique em "New query"
3. Cole o conteúdo do arquivo `scripts/supabase-migration.sql`
4. Clique em "Run" para criar todas as tabelas

### 3. Deploy da API no Vercel

1. Acesse [vercel.com](https://vercel.com)
2. Clique em "Add New → Project"
3. Importe o repositório Git do IluminaXingu
4. Configure:
   - **Project Name:** iluminaxingu-api
   - **Framework Preset:** Other
   - **Root Directory:** `deploy/api`
   - **Build Command:** (vazia — o `deploy/api/vercel.json` já define o restante)
5. Antes de deploy, vá em **Settings → Environment Variables** e adicione:

   | Variável | Valor |
   |----------|-------|
   | `DATABASE_URL` | `postgresql://postgres.[SENHA]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres` |
   | `JWT_SECRET` | (gere um aleatório, ex: `openssl rand -hex 32`) |
   | `CORS_ORIGIN` | `https://iluminaxingu.vercel.app` |
   | `SEED_SECRET` | (gere um aleatório para proteger endpoints de seed) |
   | `NODE_ENV` | `production` |

6. Clique em "Deploy"
7. Anote a URL atribuída (ex: `iluminaxingu-api-xxx.vercel.app`)

### 4. Configurar Frontend na Vercel

1. No projeto **iluminaxingu** (frontend) no Vercel
2. Vá em **Settings → Environment Variables**
3. Adicione ou atualize:

   | Variável | Valor |
   |----------|-------|
   | `VITE_API_URL` | `https://iluminaxingu-api-xxx.vercel.app` (URL da API) |

4. Faça redeploy do frontend

### 5. Criar Usuário Admin

Em produção, use o fluxo de bootstrap pelo painel:

1. Acesse `https://iluminaxingu.vercel.app/prefeitura`
2. Se ainda não existir usuário administrativo, o formulário de bootstrap será exibido
3. Crie o primeiro usuário admin com uma senha forte

> Observação: o endpoint `/api/auth/seed` é bloqueado em `NODE_ENV=production` e deve ser usado apenas em desenvolvimento/homologação.

### 6. Testar

1. Acesse `https://iluminaxingu.vercel.app`
2. Preencha uma solicitação
3. Anexe uma imagem
4. Marque o consentimento LGPD
5. Envie e confirme que o protocolo é gerado

## Variáveis de Ambiente Resumidas

### Frontend (Vercel)
| Variável | Valor |
|----------|-------|
| `VITE_API_URL` | URL da API (ex: `https://iluminaxingu-api-xxx.vercel.app`) |

### API (Vercel)
| Variável | Valor |
|----------|-------|
| `DATABASE_URL` | URL de conexão do Supabase |
| `JWT_SECRET` | Chave secreta para JWT |
| `CORS_ORIGIN` | `https://iluminaxingu.vercel.app` |
| `SEED_SECRET` | Chave para endpoints seed/migrate |
| `NODE_ENV` | `production` |

## Custos

| Serviço | Plano | Custo |
|---------|-------|-------|
| Vercel (Frontend) | Hobby | $0/mês |
| Vercel (API) | Hobby | $0/mês |
| Supabase | Free | $0/mês |
| **Total** | | **$0/mês** |

## Limitações do Plano Gratuito

- **Vercel:** 100GB de bandwidth, funções com max 10s (Hobby)
- **Supabase:** 500MB de banco, 1GB de storage, 50k requisições/mês
- **Rate limiting:** 200 req/15min global, 10 req/15min no login

## Solução de Problemas

### Erro "Load failed" no iPhone
- Verifique se `VITE_API_URL` está configurado corretamente na Vercel
- Verifique se a API está respondendo: `GET /health`

### Erro CORS
- Confirme que `CORS_ORIGIN` na API está como `https://iluminaxingu.vercel.app`

### Erro de conexão com banco
- Verifique se o `DATABASE_URL` está correto no Supabase
- Confirme que o Supabase não está em pausa (plano free pausa após inatividade)

