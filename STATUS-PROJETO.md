# IluminaXingu - Status do Projeto

**Ultima atualizacao:** 27/06/2026

---

## Arquitetura

```
iluminaxingu/
|-- apps/
|   |-- web/          # Frontend React + Vite
|   `-- api/          # Backend Express + PostgreSQL
|-- scripts/          # SQL migrations e seeds
|-- vercel.json       # Deploy do front
`-- railway.json      # Deploy da API
```

## URLs de Producao

| Servico | URL | Status |
|---------|-----|--------|
| Frontend (Vercel) | https://iluminaxingu.vercel.app | Online |
| API (Railway) | https://iluminaxingu-api-production.up.railway.app | Online |
| Banco (Railway PostgreSQL) | Via Railway | Online |

## Rotas do Sistema

| Rota | Experiencia | Descricao |
|------|-------------|-----------|
| `/` | Publica | Portal do cidadao - abrir solicitacao e consultar protocolo |
| `/prefeitura` | Admin | Painel administrativo (login + gestao) |

## Login Admin

- **Usuario:** admin
- **Senha:** admin123 (TROCAR antes de usar com dados reais)

## Estrutura de Componentes (Frontend)

### Portal Publico (`/`)
- `RequestForm` - Formulario de solicitacao do cidadao
- `SolicitacaoPublica` - Consulta por protocolo
- `FileUpload` - Upload de anexos
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
| `auth` | `/api/auth/login`, `/bootstrap`, `/me`, `/seed`, `/migrate`, CRUD usuarios |
| `solicitacoes` | CRUD + status + publica por protocolo |
| `postes` | CRUD com campos estruturados (rua, numero, bairro) |
| `ordens_servico` | CRUD ordens de servico |
| `equipes` | CRUD equipes |
| `anexos` | Upload/download de arquivos |
| `notificacoes` | Email (nodemailer) |

## Banco de Dados - Tabelas

- `admin_users` - Usuarios administrativos (username, password_hash, perfil)
- `solicitacoes` - Solicitacoes do cidadao
- `postes` - Cadastro de postes (com rua, numero, bairro, complemento)
- `ordens_servico` - Ordens de servico
- `equipes` - Equipes de campo
- `anexos` - Arquivos anexos
- `status_logs` - Historico de status

## Endpoints Especiais

| Endpoint | Metodo | Descricao |
|----------|--------|-----------|
| `/api/auth/seed` | POST | Criar/resetar admin (requer SEED_SECRET) |
| `/api/auth/migrate` | POST | Rodar migrations (requer SEED_SECRET) |
| `/health` | GET | Health check da API |

## Variaveis de Ambiente

### Frontend (Vercel)
- `VITE_API_URL` - URL da API Railway

### API (Railway)
- `DATABASE_URL` - Conexao com PostgreSQL
- `JWT_SECRET` - Chave JWT
- `CORS_ORIGIN` - https://iluminaxingu.vercel.app
- `SEED_SECRET` - Chave para endpoints seed/migrate

## Funcionalidades Implementadas

### Concluido
- Portal publico de solicitacoes
- Consulta por protocolo
- Upload de anexos
- Selecao de localizacao no mapa (leaflet)
- Login administrativo com JWT
- Gestao de solicitacoes (listagem, status)
- Gestao de postes com campos estruturados
- Captura GPS automatica no celular
- Gestao de equipes
- Ordens de servico
- Gestao de usuarios e perfis (admin, gestor, operador, consulta)
- Separacao de rotas (publica vs admin)
- Deploy automatizado (Vercel + Railway)
- Migration de endereco estruturado (rua, numero, bairro)
- Relatorios por bairro
- Dashboard com metricas

### Pendente
- Trocar senha admin123 por senha forte
- Notificacoes por email
- Relatorios PDF


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



