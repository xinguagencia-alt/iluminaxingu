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
- Dashboard executivo com visao consolidada da gestao
- Prioridade automatica elimina subjetividade
- SLA rastreavel por solicitacao
- Notificacao via WhatsApp (canal usado pela populacao)
- Controle de acesso por perfis (admin, gestor, operador, consulta)
- Deploy automatizado (Vercel + Supabase)
- Codigo fonte documentado e versionado

---

## Roteiro de Demonstracao ao Prefeito

**Duracao estimada:** 15-20 minutos

### 1. Portal Publico (3 min)

**URL:** https://iluminaxingu.vercel.app

Mostrar como o cidadao acessa o sistema:
- Tela inicial limpa e objetiva
- Formulario deolicitacao com campos claros
- Selecao de localizacao no mapa (opcional)
- Upload de foto do problema (ate 4MB)
- Mensagem de erro amigavel para arquivo grande
- Consentimento LGPD visivel

**Acao ao vivo:** Criar uma solicitacao de teste com:
- Nome: cidadao ficticio
- Telefone: numero ficticio
- Tipo: lampada apagada
- Endereco: rua real de Xinguara

**Resultado:** Gerar protocolo e mostrar tela de confirmacao com opcao de WhatsApp.

### 2. Consulta por Protocolo (2 min)

**URL:** https://iluminaxingu.vercel.app

Mostrar como o cidadao acompanha:
- Campo de busca por protocolo
- Exibicao do status atual
- Historico de mudancas
- Informacao de SLA e prazo estimado

### 3. Painel da Prefeitura (5 min)

**URL:** https://iluminaxingu.vercel.app/prefeitura

**Login:** admin / admin123!

Mostrar o painel administrativo:
- Tela de login segura
- Dashboard com indicadores visuais
- KPIs: total, abertas, em atendimento, concluidas, atrasadas
- Graficos: solicitacoes por bairro, por tipo, por status
- Visao geral do SLA (barra visual)

### 4. Gestao de Solicitacoes (3 min)

Na lista de solicitacoes:
- Filtros por status, prioridade, SLA
- Badges de prioridade automatica (urgente, alta, media, baixa)
- Badges de SLA (dentro do prazo, vence hoje, atrasada)
- Botao WhatsApp para notificar cidadao
- Botao "Gerar OS" para criar ordem de servico

**Mostrar solicitacao urgente:** Explicar que o sistema automaticamente classificou como urgente por ser risco eletrico.

### 5. Ordem de Servico (2 min)

Mostrar ordem de servico ja criada:
- Vinculacao com solicitacao
- Equipe responsavel
- Status da ordem
- Timeline de execucao

### 6. Dashboard Executivo (3 min)

**URL:** https://iluminaxingu-api.vercel.app/api/dashboard/resumo

Ou acessar pelo painel em /prefeitura > Dashboard.

Mostrar indicadores consolidados:
- Total de solicitacoes e taxa de conclusao
- Solicitacoes por prioridade
- SLA geral (dentro do prazo, vence hoje, atrasada)
- Postes ativos por bairro
- Solicitacoes urgentes com prazo

### 7. Recursos Tecnicos (2 min)

Mencionar para a equipe tecnica:
- Prioridade automatica por tipo de problema
- SLA calculado por prioridade (urgente: 24h, alta: 48h, media: 5 dias, baixa: 10 dias)
- Notificacao via WhatsApp
- Controle de acesso por perfis
- Deploy automatizado Vercel + Supabase
- Custo zero (plano gratuito)

---

## Dados de Demonstracao

### Solicitacoes Cadastradas

| ID | Protocolo | Solicitante | Tipo | Prioridade | Status | Bairro |
|----|-----------|-------------|------|------------|--------|--------|
| 1 | ILX20260730-UF7V78 | Paulo Silva | Risco eletrico | Urgente | Concluida | Centro |
| 2 | ILX20260730-7Y4M0K | Teste iPhone | Lampada apagada | Media | Enviada | Centro |
| 3 | ILX20260730-SI19K8 | Teste Validacao | Lampada apagada | Media | Enviada | - |
| 4 | ILX20260803-4VL3BI | Maria Fernanda | Risco eletrico | Urgente | Enviada | Centro |
| 5 | ILX20260803-TZY9WS | Joao Pedro | Lampada apagada | Media | Concluida | Atalaia |
| 6 | ILX20260803-EC5EDV | Ana Beatriz | Lampada piscando | Media | Enviada | Jardim Novo Planalto |
| 7 | ILX20260803-HKMLOT | Roberto Carlos | Poste danificado | Alta | Em execucao | Primavera |
| 8 | ILX20260803-IEB0U0 | Luciana Ferreira | Fio exposto | Urgente | Em manutencao | Minerador |
| 9 | ILX20260803-1UR5RL | Carlos Eduardo | Risco eletrico | Urgente | Enviada | Montenegro |
| 10 | ILX20260803-5LRN9E | Fernanda Oliveira | Lampada apagada | Media | Em analise | Bela Vista |
| 11 | ILX20260803-VFHMBL | Pedro Henrique | Poste danificado | Alta | Enviada | Aeroporto |

### Ordens de Servico

| ID | Solicitacao | Equipe | Status |
|----|-------------|--------|--------|
| 1 | Paulo Silva (ILX...UF7V78) | Hugo Bruno | Concluida |
| 2 | Roberto Carlos (ILX...HKMLOT) | Equipe Alpha | Aberta |
| 3 | Luciana Ferreira (ILX...IEB0U0) | Equipe Beta | Aberta |

### Cenarios Importantes

- **Urgente:** Solicitacoes 1, 4, 8, 9 (risco eletrico / fio exposto)
- **Alta:** Solicitacoes 7, 11 (poste danificado)
- **Em atendimento:** Solicitacoes 7, 8 (em_execucao / em_manutencao)
- **Concluida:** Solicitacoes 1, 5
- **Com OS:** Solicitacoes 1, 7, 8

