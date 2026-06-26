# Planejamento Revisado do Sistema IluminaXingu

## 1. Objetivo

O IluminaXingu tem como objetivo permitir que moradores de Sao Felix do Xingu registrem problemas de iluminacao publica de forma simples, acompanhem o andamento da solicitacao e recebam retorno da prefeitura ou da equipe responsavel pela manutencao.

O sistema deve melhorar a organizacao do atendimento, reduzir o tempo de resposta e criar rastreabilidade desde a abertura do chamado ate a conclusao do servico.

## 2. Escopo do Produto

O produto sera composto por:

- uma interface para o cidadao registrar ocorrencias;
- uma central administrativa para triagem e acompanhamento;
- um modulo operacional para emissao e controle de ordens de servico;
- um banco de dados georreferenciado do parque de iluminacao.

## 3. Estrategia de Entrega

### 3.1 MVP

O MVP deve priorizar o menor conjunto de funcionalidades capaz de colocar o processo em operacao real.

#### Funcionalidades do MVP

- abertura de solicitacao pelo cidadao;
- identificacao do local por GPS ou endereco manual;
- selecao do tipo de problema;
- envio de observacoes e foto opcional;
- geracao de protocolo unico;
- consulta do status por protocolo;
- central administrativa para registrar, validar e atualizar solicitacoes;
- criacao de ordem de servico;
- cadastro basico de postes georreferenciados;
- notificacao por e-mail ou web push em mudancas de status.

#### Canais do MVP

- portal web responsivo para o cidadao;
- portal web administrativo para atendentes e operadores.

#### Fora do MVP

- aplicativo nativo para Android e iOS;
- dashboards avancados;
- avaliacao do atendimento pelo cidadao;
- integracao com ouvidoria externa;
- algoritmos de previsao de falha;
- notificacoes push proprietarias.

### 3.2 Fase 2

- aplicativo movel para o cidadao;
- historico de solicitacoes por usuario;
- autenticacao leve por codigo enviado por e-mail;
- anexos adicionais e fotos de conclusao;
- painel gerencial com indicadores;
- integracao com telefone e ouvidoria.

### 3.3 Fase 3

- roteirizacao de equipes;
- integracao com sistemas terceirizados;
- analise preditiva de manutencao;
- integracao com sensores ou iluminacao inteligente;
- indicadores avancados de desempenho territorial.

## 4. Premissas e Dependencias Criticas

O sucesso do sistema depende de algumas condicoes que precisam ser tratadas como requisitos de projeto:

- existencia ou construcao de uma base georreferenciada dos postes;
- definicao de equipes responsaveis pela triagem e execucao;
- disponibilidade de canal oficial para notificacao ao cidadao;
- definicao das regras de negocio da prefeitura para prioridade, prazo e conclusao;
- aprovacao juridica e institucional do tratamento de dados pessoais;
- prioridade para ferramentas free/open source sempre que houver alternativa viavel.

Se o cadastro de postes estiver incompleto no inicio, o sistema deve permitir abertura por endereco e ponto de referencia, com vinculacao posterior pela central.

## 5. Requisitos Funcionais

### 5.1 Abertura de solicitacoes

- O cidadao deve conseguir registrar uma ocorrencia informando nome e pelo menos um meio de contato.
- O sistema deve solicitar localizacao por GPS quando disponivel.
- O sistema deve permitir informar endereco manualmente quando a localizacao automatica falhar.
- O sistema deve permitir selecionar um poste no mapa quando esse dado estiver disponivel.
- O sistema deve permitir informar o codigo do poste quando conhecido.
- O sistema deve permitir escolher um tipo de problema em lista padronizada.
- O sistema deve permitir adicionar observacoes livres.
- O sistema deve permitir anexar foto opcional.
- O sistema deve gerar protocolo unico ao final do envio.

### 5.2 Acompanhamento

- O cidadao deve conseguir consultar o status da solicitacao usando protocolo e meio de validacao.
- O sistema deve registrar historico de mudancas de status.
- O sistema deve enviar notificacao quando houver alteracao relevante no andamento.

### 5.3 Operacao administrativa

- O atendente deve conseguir registrar chamados recebidos por telefone ou atendimento presencial.
- O operador deve conseguir validar dados da ocorrencia.
- O operador deve conseguir classificar prioridade.
- O operador deve conseguir criar, editar e encerrar ordens de servico.
- O operador deve conseguir encaminhar a demanda para equipe propria ou terceirizada.
- O sistema deve registrar justificativa para encerramento como nao procedente, duplicado ou cancelado.

### 5.4 Execucao em campo

- A equipe deve visualizar ordens de servico abertas.
- A equipe deve registrar data, hora, observacao e resultado da execucao.
- A equipe deve anexar foto de conclusao quando aplicavel.
- O sistema deve atualizar automaticamente a solicitacao vinculada quando a ordem de servico for concluida.

## 6. Regras de Negocio

### 6.1 Status da solicitacao

Estados sugeridos:

- enviada;
- em analise;
- em execucao;
- concluida;
- nao procedente;
- cancelada;
- duplicada.

### 6.2 Priorizacao

Sugestao inicial de prioridade:

- alta: risco eletrico, poste danificado, area critica ou grande concentracao de falhas;
- media: falha unitara em via relevante;
- baixa: ocorrencias sem risco imediato.

### 6.3 SLA operacional

Sugestao inicial para validacao com a prefeitura:

- triagem inicial em ate 1 dia util;
- resposta operacional em ate 3 dias uteis para casos comuns;
- ocorrencias criticas com tratamento prioritario no mesmo dia.

### 6.4 Duplicidade

- O sistema deve sinalizar possiveis chamados duplicados por proximidade geografica, poste e tipo de problema.
- A central decide se o novo chamado sera vinculado ao anterior ou mantido separadamente.

## 7. Requisitos Nao Funcionais

### 7.1 Desempenho

- tempo medio de resposta da API inferior a 2 segundos nas operacoes principais;
- suporte inicial a pelo menos 200 usuarios simultaneos no portal;
- processamento de anexos sem bloquear a confirmacao da abertura.

### 7.2 Disponibilidade

- disponibilidade mensal alvo de 99,0% no MVP;
- backup diario do banco de dados;
- monitoramento de falhas da aplicacao e da infraestrutura.

### 7.3 Seguranca

- uso obrigatorio de HTTPS;
- controle de acesso por perfil no modulo administrativo;
- registro de auditoria para criacao, alteracao e encerramento de chamados;
- protecao contra abuso com rate limiting e validacao de entrada;
- armazenamento seguro de anexos.

### 7.4 Privacidade e LGPD

- informar de forma clara quais dados sao coletados e para qual finalidade;
- coletar apenas dados necessarios para atender a solicitacao;
- definir prazo de retencao de dados pessoais e anexos;
- permitir atendimento a solicitacoes de anonimizaacao ou exclusao quando cabivel;
- restringir acesso a dados pessoais a perfis autorizados.

### 7.5 Usabilidade e acessibilidade

- fluxo de abertura em poucos passos;
- linguagem simples e objetiva;
- interface responsiva para celular, tablet e desktop;
- atendimento a boas praticas de acessibilidade digital.

## 8. Arquitetura Recomendada

### 8.1 Diretriz geral

Para o MVP, recomenda-se um monolito modular com separacao clara entre camadas de dominio, API, autenticacao, anexos e notificacoes. Essa abordagem reduz complexidade inicial e facilita manutencao.

Microservicos devem ser considerados apenas quando houver evidencia real de escala, integracoes complexas ou necessidade de autonomia operacional entre modulos.

### 8.2 Stack sugerida

#### Backend

- Python com Django e Django REST Framework; ou
- Node.js com NestJS.

#### Frontend

- portal cidadao em React ou Vue;
- portal administrativo em React ou Vue.

#### Banco de dados

- PostgreSQL com PostGIS.

#### Mapa

- OpenStreetMap com Leaflet.

#### Armazenamento

- MinIO ou filesystem local para fotos e anexos.

#### Notificacoes

- e-mail via SMTP livre e web push.

#### Infraestrutura complementar

- fila simples para notificacoes e processamento assincrono;
- observabilidade com logs, metricas e rastreamento de erros.

## 9. Modelo Inicial de Dados

Entidades principais:

- `postes`
- `solicitacoes`
- `status_logs`
- `ordens_servico`
- `anexos`
- `equipes`
- `usuarios_admin`
- `avaliacoes` (fase posterior)

Campos minimos sugeridos:

### 9.1 `postes`

- id
- codigo
- endereco
- latitude
- longitude
- tipo_luminaria
- potencia
- data_instalacao
- data_ultima_manutencao
- status_ativo

### 9.2 `solicitacoes`

- id
- protocolo
- nome_solicitante
- telefone
- email
- poste_id
- endereco_informado
- latitude
- longitude
- tipo_problema
- descricao
- status_atual
- prioridade
- origem_canal
- criado_em

### 9.3 `ordens_servico`

- id
- solicitacao_id
- equipe_id
- status
- data_abertura
- data_execucao
- data_encerramento
- observacao_execucao
- resultado

## 10. Fluxo Operacional

### 10.1 Fluxo do cidadao

1. O cidadao acessa o portal.
2. Informa localizacao ou endereco.
3. Seleciona o poste ou informa referencia.
4. Escolhe o tipo de problema.
5. Adiciona observacoes e foto, se desejar.
6. Envia a solicitacao.
7. Recebe protocolo para acompanhamento.

### 10.2 Fluxo interno

1. A central recebe a solicitacao.
2. O operador valida dados e classifica prioridade.
3. O sistema verifica duplicidade.
4. O operador cria ordem de servico quando necessario.
5. A equipe executa o atendimento.
6. O operador ou a equipe encerra a ordem.
7. O sistema atualiza a solicitacao e notifica o cidadao.

## 11. Roadmap de Implementacao

### Etapa 1. Descoberta e definicao

- validar escopo do MVP;
- definir regras de prioridade e SLA;
- mapear atores e responsabilidades;
- confirmar requisitos juridicos e de LGPD.

### Etapa 2. Base operacional

- consolidar inventario de postes;
- estruturar banco geoespacial;
- preparar ambientes e repositorios.

### Etapa 3. Desenvolvimento do MVP

- backend e API;
- portal do cidadao;
- portal administrativo;
- notificacoes basicas;
- testes principais.

### Etapa 4. Piloto

- implantar em area limitada;
- medir volume, tempo de resposta e qualidade dos dados;
- ajustar fluxo operacional.

### Etapa 5. Expansao

- ampliar cobertura;
- liberar novos canais;
- evoluir relatorios e automacoes.

## 12. Riscos Principais

- base de postes incompleta ou desatualizada;
- falta de definicao institucional sobre quem responde por cada etapa;
- escopo excessivo no inicio;
- dependencia de canais externos de notificacao;
- baixa adesao operacional se a central nao for simples de usar;
- risco de tratamento inadequado de dados pessoais.

## 13. Recomendacao Final

O melhor proximo passo para o IluminaXingu e validar este documento como base de MVP com os stakeholders da operacao, tecnologia e juridico. A partir disso, o projeto ja pode seguir para prototipacao de telas e detalhamento tecnico das historias de usuario.
