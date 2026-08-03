# IluminaXingu

Sistema de gestao de iluminacao publica para o municipio de Xinguara-PA.

## Stack

- **Frontend:** React + Vite + TypeScript
- **API:** Node.js + Express + TypeScript (Vercel Serverless)
- **Banco:** PostgreSQL + PostGIS (Supabase)
- **Mapas:** OpenStreetMap + Leaflet
- **Armazenamento:** Banco PostgreSQL (BYTEA para anexos)

## Regra do projeto

Sempre priorizar ferramentas free/open source no MVP.

## Estrutura

```
iluminaxingu/
|-- apps/
|   |-- web/          # Frontend React + Vite
|   `-- api/          # Backend Express + PostgreSQL
|-- deploy/
|   `-- api/          # Build standalone para Vercel
|-- scripts/          # SQL migrations e seeds
```

## Variaveis de Ambiente

### Local (.env na raiz)

```env
JWT_SECRET=seu-segredo-aqui
DB_USER=iluminaxingu
DB_PASSWORD=iluminaxingu
DB_HOST=localhost
DB_PORT=5432
DB_NAME=iluminaxingu
CORS_ORIGIN=http://localhost:3000
```

### Producao (Vercel)

**Frontend:**
- `VITE_API_URL` - URL da API (ex: `https://iluminaxingu-api.vercel.app`)

**API:**
- `DATABASE_URL` - URL de conexao do Supabase
- `JWT_SECRET` - Chave secreta para JWT
- `CORS_ORIGIN` - `https://iluminaxingu.vercel.app`
- `NODE_ENV` - `production`

> **Importante:** Nao exponha DATABASE_URL, SUPABASE_SERVICE_ROLE_KEY ou 
> qualquer segredo no frontend.

## Limites de Upload

| Configuracao | Valor |
|--------------|-------|
| Tamanho maximo por arquivo | 4MB |
| Tipos permitidos | JPEG, PNG, GIF, WebP, PDF, DOC, DOCX, TXT |

> O limite foi reduzido de 10MB para 4MB devido ao timeout do Vercel Serverless.

## Scripts

```bash
# Instalar dependencias
npm install

# Rodar API localmente
npm run dev:api

# Rodar Frontend localmente
npm run dev:web

# Banco de dados (Docker)
docker-compose up -d
```

## Deploy

Consulte o arquivo `DEPLOY-GUIDE.md` para instrucoes detalhadas.

### URLs de Producao
- **Frontend:** https://iluminaxingu.vercel.app
- **API:** https://iluminaxingu-api.vercel.app
- **Banco:** Supabase (plano gratuito)

### Custos

| Servico | Plano | Custo |
|---------|-------|-------|
| Vercel (Frontend) | Hobby | $0/mes |
| Vercel (API) | Hobby | $0/mes |
| Supabase | Free | $0/mes |
| **Total** | | **$0/mes** |

## Seguranca

- O endpoint `/api/auth/seed` **NAO deve ser usado em producao**
- O usuario admin foi criado via bootstrap no primeiro deploy
- Para criar novos usuarios admin, use o painel administrativo
- Troque a senha padrao (`admin123!`) antes de usar em producao

## Autenticacao

O seed de administrador deve ser usado apenas em desenvolvimento. Em producao, o primeiro usuario admin e criado por um fluxo controlado.

---
**Ultima atualizacao:** 30/07/2026
