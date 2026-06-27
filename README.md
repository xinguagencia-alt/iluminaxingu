# IluminaXingu

Base inicial do projeto MVP do IluminaXingu.

## Stack escolhida

- `apps/web`: React + Vite + TypeScript
- `apps/api`: Node.js + Express + TypeScript
- banco de dados: PostgreSQL + PostGIS
- mapas: OpenStreetMap + Leaflet
- armazenamento de arquivos: MinIO ou armazenamento local
- notificacoes: e-mail e web push

## Regra do projeto

Sempre priorizar ferramentas free/open source no MVP. Se uma integracao paga for considerada no futuro, ela deve ficar fora da primeira entrega e ser tratada como opcional.

## Estrutura

```text
apps/
  api/
  web/
```

## Scripts

```bash
npm install
npm run dev:api
npm run dev:web
```

## Proximo passo recomendado

1. Subir as dependencias.
2. Implementar banco PostgreSQL com PostGIS.
3. Criar os modulos iniciais de `solicitacoes`, `postes` e `ordens_servico`.
4. Ligar o formulario do portal ao endpoint da API.
5. Integrar o mapa com OpenStreetMap/Leaflet.

## Uso com Antigravity e Mimo v2.5 free

Esta base foi preparada para voces iterarem por modulos pequenos. A melhor sequencia e:

1. gerar ou ajustar codigo por feature pequena;
2. validar no navegador e na API local;
3. consolidar no repositorio antes da proxima feature.
# IluminaXingu

## Variaveis de ambiente

Crie um arquivo `.env` na raiz do projeto com pelo menos:

```env
JWT_SECRET=troque-este-segredo-em-local
DB_USER=iluminaxingu
DB_PASSWORD=iluminaxingu
DB_HOST=localhost
DB_PORT=5432
DB_NAME=iluminaxingu
CORS_ORIGIN=http://localhost:3000
```

## Autenticacao

O seed de administrador deve ser usado apenas em desenvolvimento ou homologacao interna. Em producao, o primeiro usuario admin deve ser criado por um fluxo controlado pela equipe responsavel.

rebuild 06/27/2026 14:25:11
