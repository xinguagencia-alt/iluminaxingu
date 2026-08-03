# IluminaXingu - Status do Projeto

**Ultima atualizacao:** 03/08/2026

---

## Arquitetura

```
iluminaxingu/
|-- apps/
|   |-- web/          # Frontend React + Vite (deploy: Vercel)
|   `-- api/          # Backend Express + PostgreSQL (deploy: Vercel Serverless)
|-- deploy/
|   `-- api/          # Build standalone para deploy da API no Vercel
|-- scripts/          # SQL migrations e seeds
|-- vercel.json       # Deploy do frontend
`-- DEPLOY-GUIDE.md   # Guia completo de deploy
```

## URLs de Producao

| Servico | URL | Status |
|---------|-----|--------|
| Frontend (Vercel) | https://iluminaxingu.vercel.app | Online |
| API (Vercel Serverless) | https://iluminaxingu-api.vercel.app | Online |
| Banco (Supabase PostgreSQL) | Via Supabase (sa-east-1) | Online |

> **Nota:** A API no Railway foi descontinuada (trial expirado). 
> Migracao para Vercel Serverless + Supabase (plano gratuito).

## Limites de Upload

| Configuracao | Valor |
|--------------|-------|
| Tamanho maximo por arquivo | 4MB |
| Tipos permitidos | JPEG, PNG, GIF, WebP, PDF, DOC, DOCX, TXT |
| Armazenamento | Banco PostgreSQL (BYTEA) |

> **Nota:** O limite foi reduzido de 10MB para 4MB devido ao timeout 
> do Vercel Serverless (30s). Arquivos maiores podem causar erros.

## Rotas do Sistema

| Rota | Experiencia | Descricao |
|------|-------------|-----------|
| `/` | Publica | Portal do cidadao - abrir solicitacao e consultar protocolo |
| `/prefeitura` | Admin | Painel administrativo (login + gestao) |

## Login Admin

- **Usuario:** admin
- **Senha:** admin123!
- **Importante:** Trocar a senha antes de usar com dados reais

## Criacao de Admin em Producao

O endpoint `/api/auth/seed` **NAO deve ser usado em producao**.
O usuario admin foi criado via bootstrap durante o primeiro deploy.

Para criar novos usuarios admin em producao:
1. Faca login com o admin existente
2. Acesse a pagina de gestao de usuarios
3. Crie um novo usuario com o perfil desejado

## Estrutura de Componentes (Frontend)

### Portal Publico (`/`)
- `RequestForm` - Formulario de solicitacao do cidadao
- `SolicitacaoPublica` - Consulta por protocolo
- `FileUpload` - Upload de anexos (limite: 4MB)
- `MapPicker` - Selecao de localizacao no mapa

### Painel Admin (`/prefeitura`)
- `LoginForm` - Login administrativo
- `BootstrapForm` - Primeiro acesso (criar admin inicial)
- `Dashboard` - Painel de visao geral
- `SolicitacaoList` - Lista de solicitacoes
- `PosteList` - Listagem de postes
- `PosteForm` - Cadastro de postes com GPS automatico
- `OrdemServicoList` - Ordens de servico
- `OrdemServicoDetail` - Detalhe da ordem
- `EquipeList` - Gestao de equipes
- `UserManagement` - Gestao de usuarios e perfis

## Modulos da API

| Modulo | Rotas |
|--------|-------|
| `auth` | `/api/auth/login`, `/bootstrap`, `/me`, CRUD usuarios |
| `solicitacoes` | CRUD + status + publica por protocolo |
| `postes` | CRUD com campos estruturados (rua, numero, bairro) |
| `ordens_servico` | CRUD ordens de servico |
| `equipes` | CRUD equipes |
| `anexos` | Upload/download de arquivos (max 4MB) |
| `auditoria` | Logs de auditoria |
| `export` | Exportacao de dados |
| `estoque` | Controle de materiais |
| `dashboard` | `/api/dashboard/resumo` - Dashboard executivo com metricas |

## Banco de Dados - Tabelas

- `admin_users` - Usuarios administrativos (username, password_hash, perfil)
- `solicitacoes` - Solicitacoes do cidadao
- `postes` - Cadastro de postes (com rua, numero, bairro, complemento)
- `ordens_servico` - Ordens de servico
- `equipes` - Equipes de campo
- `anexos` - Arquivos anexos (armazenados em BYTEA no banco)
- `status_logs` - Historico de status
- `bairros` - Cadastro de bairros
- `ruas` - Cadastro de ruas/avenidas
- `auditoria` - Logs de auditoria
- `configuracao_estoque` - Configuracoes do estoque
- `itens_estoque` - Itens do estoque
- `movimentacoes_estoque` - Movimentacoes do estoque
- `itens_usados_os` - Itens usados em ordens de servico

## Endpoints Especiais

| Endpoint | Metodo | Descricao |
|----------|--------|-----------|
| `/health` | GET | Health check da API |
| `/api/problem-types` | GET | Lista de tipos de problema |
| `/api/solicitacoes/publica/:protocolo` | GET | Consulta publica por protocolo |

> **Nota:** Os endpoints `/api/auth/seed` e `/api/auth/migrate` existem 
> mas nao devem ser usados em producao.

## Variaveis de Ambiente

### Frontend (Vercel)
- `VITE_API_URL` - URL da API Vercel Serverless

### API (Vercel Serverless)
- `DATABASE_URL` - Conexao com PostgreSQL (Supabase)
- `JWT_SECRET` - Chave JWT
- `CORS_ORIGIN` - https://iluminaxingu.vercel.app
- `SEED_SECRET` - Chave para endpoints seed/migrate (nao usar em producao)
- `NODE_ENV` - production

## Funcionalidades Implementadas

### Concluido
- Portal publico de solicitacoes
- Consulta por protocolo
- Upload de anexos (limite: 4MB, armazenamento em BYTEA)
- Selecao de localizacao no mapa (leaflet)
- Login administrativo com JWT
- Gestao de solicitacoes (listagem, status)
- Gestao de postes com campos estruturados
- Captura GPS automatica no celular
- Gestao de equipes
- Ordens de servico
- Gestao de usuarios e perfis (admin, gestor, operador, consulta)
- Separacao de rotas (publica vs admin)
- Deploy automatizado (Vercel + Supabase)
- Migration de endereco estruturado (rua, numero, bairro)
- Relatorios por bairro
- Dashboard com metricas
- Controle de estoque de materiais

### Pendente
- Trocar senha admin123 por senha forte
- Notificacoes por email
- Relatorios PDF
- Upload de anexos via Supabase Storage (opcional)

## Como Rodar Localmente

```bash
# Instalar dependencias
npm install

# Rodar API
npm run dev:api

# Rodar Frontend
npm run dev:web

# Banco de dados (Docker)
docker-compose up -d
```

## Proximos Passos

1. **Seguranca:** Trocar senha admin123
2. **Relatorios:** Filtro por bairro, dashboard com metricas
3. **Notificacoes:** Email quando solicitacao muda de status
4. **Relatorios PDF:** Gerar relatorio de postes por bairro
5. **Performance:** Otimizar queries para muitos registros
6. **Migrar anexos para Supabase Storage:** Atualmente os arquivos sao armazenados como BYTEA no PostgreSQL. Para melhor performance e escalabilidade, migrar para Supabase Storage e salvar no banco apenas metadados/URL dos arquivos.

---

## Checklist de Demonstracao

**Data da apresentacao:** Quinta-feira (prefeitura/prefeito)

### Links

| Item | URL |
|------|-----|
| Portal Publico | https://iluminaxingu.vercel.app |
| Painel Prefeitura | https://iluminaxingu.vercel.app/prefeitura |
| API | https://iluminaxingu-api.vercel.app |
| Health Check | https://iluminaxingu-api.vercel.app/health |
| Dashboard Executivo | https://iluminaxingu-api.vercel.app/api/dashboard/resumo |

### Credenciais

- **Usuario:** admin
- **Perfil:** Administrador
- **Obs.:** Trocar senha antes de uso em producao real

### Funcionalidades para Demonstrar

1. **Portal Publico**
   - Abertura de solicitacao pelo cidadao
   - Upload de imagem (ate 4MB)
   - Erro amigavel para imagem > 4MB
   - Selecao de localizacao no mapa
   - Consulta por protocolo

2. **Painel Prefeitura**
   - Login administrativo
   - Dashboard Executivo com indicadores
   - Lista de solicitacoes com filtros
   - Detalhe com prioridade automatica e SLA
   - Criacao de ordem de servico
   - Gestao de equipes
   - Gestao de usuarios e perfis
   - Controle de estoque

3. **Integracoes**
   - WhatsApp para notificacao ao cidadao
   - Prioridade automatica por tipo de problema
   - Calculo de SLA por prioridade
   - Logs de auditoria

### Pontos Fortes do Sistema

- Portal publico acessivel para qualquer cidadao
- Dashboard executivo com visao consolidada da gestão
- Prioridade automatica elimina subjetividade
- SLA rastreavel por solicitacao
- Notificacao via WhatsApp (canal usado pela populacao)
- Controle de acesso por perfis (admin, gestor, operador, consulta)
- Deploy automatizado (Vercel + Supabase)
- Codigo fonte documentado e versionado

