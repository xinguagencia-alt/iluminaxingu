# IluminaXingu - Guia de Deploy (Vercel + Supabase)

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
   - Formato: `postgresql://postgres:[YOUR-PASSWORD]@db.[REF].supabase.co:5432/postgres`

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
   - **Root Directory:** `apps/api`
   - **Build Command:** `echo 'No build needed'`
   - **Output Directory:** (deixe vazio)
5. Antes de deploy, vá em **Settings → Environment Variables** e adicione:

   | Variável | Valor |
   |----------|-------|
   | `DATABASE_URL` | `postgresql://postgres:[SENHA]@db.[REF].supabase.co:5432/postgres` |
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

