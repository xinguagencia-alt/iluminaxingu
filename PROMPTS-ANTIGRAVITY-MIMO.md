# Prompts para Antigravity e Mimo v2.5 free

Use estes prompts em tarefas pequenas e objetivas.

## 1. Criar feature no frontend

```text
Projeto: IluminaXingu
Stack: React + Vite + TypeScript
Objetivo: implementar a feature [NOME DA FEATURE]

Contexto:
- O projeto usa a pasta apps/web
- O MVP e para registro de solicitacoes de iluminacao publica
- Mantenha o codigo simples, tipado e organizado
- Nao mude a arquitetura sem necessidade
- Priorize bibliotecas e servicos free/open source

Tarefa:
- implemente a tela/componente para [OBJETIVO]
- reutilize os estilos existentes quando fizer sentido
- se precisar, crie componentes pequenos e claros
- responda com os arquivos alterados e uma explicacao curta
```

## 2. Criar endpoint na API

```text
Projeto: IluminaXingu
Stack: Node.js + Express + TypeScript
Objetivo: implementar o endpoint [NOME DO ENDPOINT]

Contexto:
- O projeto usa a pasta apps/api
- O codigo atual possui um servidor Express inicial
- O MVP inclui solicitacoes, postes e ordens de servico
- Evite dependencias pagas ou proprietarias

Tarefa:
- crie o endpoint [METODO E ROTA]
- valide os dados de entrada de forma simples
- mantenha o codigo preparado para futura integracao com banco
- responda com os arquivos alterados e observacoes importantes
```

## 3. Refatorar sem quebrar

```text
Refatore o codigo existente sem alterar comportamento.

Regras:
- preserve os nomes publicos usados hoje
- nao introduza bibliotecas novas sem justificar
- melhore legibilidade, separacao de responsabilidades e tipagem
- responda com diff ou arquivos alterados
```

## 4. Checklist por feature

Sempre pedir ao modelo:

```text
Antes de finalizar:
- liste riscos da implementacao
- diga quais arquivos foram alterados
- diga como testar localmente
```

## 5. Ordem recomendada de desenvolvimento

1. formulario de abertura de solicitacao;
2. envio real do formulario para a API;
3. validacao de campos;
4. listagem administrativa de solicitacoes;
5. cadastro de postes;
6. ordens de servico;
7. autenticacao administrativa.

## 6. Implementar prioridade automatica

```text
Projeto: IluminaXingu
Stack: React + Vite + TypeScript no frontend e Node.js + Express + TypeScript na API
Objetivo: implementar prioridade automatica nas solicitacoes sem quebrar o fluxo atual.

Contexto:
- A API principal fica em apps/api.
- O frontend fica em apps/web.
- As solicitacoes sao criadas em POST /api/solicitacoes.
- A tabela solicitacoes ja possui o campo prioridade, com valores usados no painel: urgente, alta, media e baixa.
- Hoje a prioridade padrao no banco e media.
- O painel administrativo ja exibe e filtra prioridade.

Regra de negocio desejada:
- Se tipo_problema for risco_eletrico ou fio_exposto, prioridade deve ser urgente.
- Se tipo_problema for poste_danificado, prioridade deve ser alta.
- Se tipo_problema for lampada_apagada ou lampada_piscando, prioridade deve ser media.
- Se tipo_problema for outro, prioridade deve ser baixa.
- Se houver mais de 3 solicitacoes abertas nos ultimos 7 dias para o mesmo poste ou mesmo codigo de poste informado, aumentar a prioridade em 1 nivel:
  - baixa vira media
  - media vira alta
  - alta vira urgente
  - urgente permanece urgente
- Considerar como abertas as solicitacoes que nao estejam em: concluida, cancelada, nao_procedente ou duplicada.
- A prioridade automatica deve ser calculada no backend no momento da criacao da solicitacao.

Tarefa backend:
- Criar uma funcao pequena e testavel para calcular a prioridade base por tipo_problema.
- Criar uma funcao auxiliar para elevar a prioridade quando houver recorrencia no mesmo poste/codigo.
- Alterar POST /api/solicitacoes para salvar a prioridade calculada no INSERT.
- Nao confiar em prioridade enviada pelo frontend para solicitacoes publicas.
- Manter compatibilidade com solicitacoes sem poste_id, usando codigo_poste_informado quando existir.
- Evitar alterar schema do banco se nao for necessario.

Tarefa frontend:
- No formulario publico, apos selecionar o tipo de problema, mostrar uma mensagem simples indicando que casos com risco eletrico recebem prioridade de atendimento.
- No painel administrativo, manter a exibicao atual dos badges de prioridade.
- Se possivel, destacar visualmente prioridade urgente sem mudar a arquitetura.

Cuidados:
- Nao alterar nomes de status existentes.
- Nao remover filtros atuais.
- Nao criar dependencia nova sem necessidade.
- Nao alterar login, autenticacao ou deploy.
- Manter TypeScript sem erros.

Antes de finalizar:
- Rodar npm run lint.
- Rodar npm run build.
- Informar arquivos alterados.
- Explicar como testar:
  1. criar solicitacao com risco_eletrico e verificar prioridade urgente;
  2. criar solicitacao com poste_danificado e verificar prioridade alta;
  3. criar mais de 3 solicitacoes abertas para o mesmo poste/codigo e verificar elevacao de prioridade;
  4. verificar se o filtro de prioridade no painel continua funcionando.
```
