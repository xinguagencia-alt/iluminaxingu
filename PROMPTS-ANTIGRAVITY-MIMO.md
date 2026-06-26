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
