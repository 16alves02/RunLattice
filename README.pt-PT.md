> **Idioma / Language:** [English](README.md) · [Português (Portugal)](README.pt-PT.md)

<div align="center">

# RunLattice

**Ligar. Executar. Orquestrar.**

Desenha, executa e monitoriza fluxos de trabalho num único espaço de trabalho.

Uma plataforma de automação em evolução, pensada para utilizadores sem conhecimentos técnicos, programadores, equipas e empresas.

</div>

---

## Direção do produto

O RunLattice combina automação acessível com controlos avançados de fluxos de trabalho. Os utilizadores podem começar com modelos ou descrever uma automação em linguagem natural; os programadores podem alargar os fluxos através de ações tipadas e integrações.

Os fluxos gerados por IA são rascunhos. Têm de ser revistos e guardados pelo utilizador; o assistente não os ativa nem executa automaticamente.

## Funcionalidades implementadas

- Autenticação por email e palavra-passe, registo com verificação de email, recuperação de palavra-passe e sessões suportadas por PostgreSQL através do Better Auth (em produção é necessário configurar um fornecedor de email transacional).
- Espaços de trabalho por organização, com funções de proprietário, administrador e membro.
- Operações CRUD de fluxos de trabalho e histórico de execuções isolados por espaço de trabalho.
- Construtor visual de fluxos e biblioteca pesquisável de modelos.
- Catálogo de integrações com operações ativas para Discord, HTTP/API REST, Gmail, Google Sheets e Slack; os restantes fornecedores estão identificados como planeados.
- Encriptação AES-256-GCM das credenciais de integração associadas a cada espaço de trabalho, incluindo tokens Discord, HTTP, Google e Slack.
- Execução em segundo plano com Redis/BullMQ e aquisição atómica de execuções.
- Envio real de mensagens para canais Discord e Slack, envio de email através do Gmail, leitura de intervalos e inserção de linhas no Google Sheets e pedidos HTTPS autenticados a APIs externas. Os campos de texto e JSON suportados aceitam mapeamentos seguros <code>{{input.path}}</code>.
- Triggers de webhook de entrada assinados com HMAC-SHA256, timestamp e validação da janela de repetição.
- Triggers agendados por cron, geridos pelo BullMQ, com suporte para fusos horários IANA e reconciliação no worker.
- Planeamento de fluxos por IA com adaptadores OpenAI, Anthropic e Google Gemini, chaves BYOK encriptadas por espaço de trabalho, desativado por predefinição e com propostas sujeitas a revisão.
- Checkout de subscrições alojado pelo Stripe, Customer Portal e processamento de webhooks assinados, com permissões Free/Pro/Team e quotas de fluxos, execuções e IA aplicadas no servidor (as credenciais sandbox e a validação ponta a ponta continuam pendentes).
- Orçamentos mensais de pedidos/tokens de IA por espaço de trabalho e limitação atómica de pedidos por utilizador e espaço de trabalho.
- Testes unitários Vitest para validação de fluxos, execução, encriptação de credenciais, configuração de triggers, assinaturas de webhooks e regras de subscrição.
- Testes de integração PostgreSQL/Redis que cobrem webhooks assinados, assinaturas inválidas, rejeição de repetições, ciclo de vida do agendador e tratamento de falhas pelo worker real.

## Limites atuais de execução

O worker suporta atualmente execuções manuais, por webhook assinado e por agendamento cron, com exatamente um trigger e, no máximo, um nó de condição. Os nós de condição avaliam os dados de entrada e encaminham a execução por um ramo verdadeiro ou falso; apenas o percurso selecionado é executado.

As ações externas ativas limitam-se às operações explicitamente disponíveis no catálogo: mensagem Discord, mensagem Slack, envio de email Gmail, leitura/inserção no Google Sheets e pedido HTTP seguro. Os restantes fornecedores, triggers e ações ainda não estão implementados. Não é suportada a execução arbitrária de código.

As falhas de ações são guardadas sem repetir automaticamente a execução. Envios e inserções sem idempotência podem ter um resultado externo desconhecido após um timeout de rede; o RunLattice não volta a enviá-los automaticamente. O worker atualiza um heartbeat na base de dados enquanto a execução está ativa; um processo de recuperação marca como FAILED as execuções cujo heartbeat de cinco minutos expirou. Não repete a execução, porque a ação externa pode já ter sido realizada. Os checkpoints de etapas são guardados, mas ainda não existe retoma a partir de checkpoints nem entrega exatamente uma vez.

## Segurança das integrações

As credenciais dos fornecedores são encriptadas em repouso e nunca são devolvidas pela API. Google e Slack utilizam autorização OAuth associada ao espaço de trabalho, com estado de utilização única e curta duração. O Google utiliza PKCE; os tokens de bot do Slack suportam rotação quando esta opção está ativada na aplicação Slack.

As ligações a APIs HTTP estão limitadas à origem HTTPS e ao caminho base configurados. Os pedidos externos bloqueiam redirecionamentos e aplicam timeouts limitados.

Define <code>INTEGRATION_ENCRYPTION_KEY</code> com uma chave única de 32 bytes, codificada em Base64, nos ambientes web e worker. Podes gerar uma chave com:

~~~bash
openssl rand -base64 32
~~~

Guarda uma cópia de segurança da chave num local seguro. Se a perderes, as credenciais de integração existentes deixam de poder ser desencriptadas.

## Stack tecnológica

| Área | Tecnologia |
| --- | --- |
| Frontend | Next.js, React, TypeScript, CSS |
| API | Next.js Route Handlers, Zod |
| Dados | PostgreSQL, Prisma ORM |
| Tarefas em segundo plano | Redis, BullMQ |
| Autenticação | Better Auth |
| Planeamento por IA | Adaptadores de servidor OpenAI, Anthropic e Google Gemini, com BYOK encriptado por espaço de trabalho |
| Testes | Vitest |
| Serviços locais | Docker Compose |

## Começar

### Requisitos

- Node.js 22 ou superior
- npm
- Docker Desktop ou Docker Engine

### 1. Instalar dependências

~~~bash
npm install
~~~

### 2. Configurar variáveis de ambiente

~~~bash
cp .env.example .env
~~~

Configura <code>DATABASE_URL</code>, <code>DIRECT_URL</code>, <code>REDIS_URL</code>, <code>BETTER_AUTH_SECRET</code>, <code>BETTER_AUTH_URL</code> e <code>BETTER_AUTH_TRUSTED_ORIGINS</code>. Configura <code>INTEGRATION_ENCRYPTION_KEY</code> antes de guardar credenciais de fornecedores.

Para Gmail e Google Sheets, configura também as variáveis OAuth do Google. Para Slack, configura as variáveis OAuth do Slack. Configura Resend e Stripe apenas quando estiveres a testar essas funcionalidades. Nunca guardes credenciais reais no repositório.

### 3. Iniciar PostgreSQL e Redis

~~~bash
docker compose up -d
~~~

### 4. Aplicar migrações da base de dados

~~~bash
npx prisma generate
npx prisma migrate deploy
~~~

### 5. Iniciar a aplicação web

~~~bash
npm run dev
~~~

Abre http://localhost:3000.

### 6. Iniciar o worker num segundo terminal

~~~bash
npm run worker
~~~

A aplicação web e o worker necessitam da mesma configuração PostgreSQL e Redis. O worker também precisa da mesma chave de encriptação para desencriptar as credenciais dos fornecedores guardadas.

## Comandos úteis

~~~bash
npm run dev
npm run typecheck
npm run lint
npm test
npm run worker
npm run build
docker compose down
~~~

## Resumo da API

| Método | Endpoint | Objetivo |
| --- | --- | --- |
| GET | <code>/api/health</code> | Verificação de disponibilidade da aplicação, PostgreSQL, Redis e worker |
| GET | <code>/api/integrations</code> | Listar o catálogo e as ligações do espaço de trabalho |
| POST | <code>/api/integrations</code> | Guardar uma ligação Discord webhook ou HTTP API encriptada |
| GET | <code>/api/integrations/google/connect</code> | Iniciar OAuth Google |
| GET | <code>/api/integrations/google/callback</code> | Concluir OAuth Google |
| GET | <code>/api/integrations/slack/connect</code> | Iniciar OAuth Slack |
| GET | <code>/api/integrations/slack/callback</code> | Concluir OAuth Slack |
| DELETE | <code>/api/integrations/:id</code> | Remover uma ligação do espaço de trabalho |
| GET | <code>/api/workflows</code> | Listar fluxos do espaço de trabalho |
| POST | <code>/api/workflows</code> | Criar um fluxo de trabalho |
| GET | <code>/api/workflows/:id</code> | Consultar um fluxo e execuções recentes |
| PATCH | <code>/api/workflows/:id</code> | Atualizar campos de um fluxo |
| DELETE | <code>/api/workflows/:id</code> | Eliminar um fluxo |
| POST | <code>/api/workflows/:id/runs</code> | Colocar um fluxo ativo em execução manual |
| POST | <code>/api/workflows/:id/webhook-secret</code> | Gerar ou rodar um segredo de webhook assinado (proprietário/administrador) |
| POST | <code>/api/webhooks/:workflowId</code> | Aceitar um webhook assinado e colocar uma execução em fila |
| POST | <code>/api/ai/workflow-plan</code> | Gerar uma proposta de fluxo sujeita a revisão (dependente de feature flag) |
| POST | <code>/api/ai/workflow-plan/test</code> | Simular um grafo sem efeitos externos |
| POST | <code>/api/billing</code> | Criar uma sessão Stripe Checkout ou Customer Portal (proprietário/administrador) |
| POST | <code>/api/billing/webhook</code> | Verificar e processar eventos de subscrição Stripe |

Todos os endpoints de fluxos e integrações exigem uma sessão autenticada e a validação da pertença à organização ativa. Os membros podem consultar dados; os proprietários e administradores podem alterar dados e colocar execuções em fila.

O endpoint de planeamento por IA exige a função de proprietário/administrador e permanece desativado, a menos que <code>AI_ASSISTANT_ENABLED=true</code>. Aplica limites ao tamanho dos pedidos, limitação por utilizador/espaço de trabalho e orçamentos mensais de utilização. O endpoint de simulação testa apenas a travessia do grafo e nunca chama adaptadores de integração. O endpoint público de health verifica a ligação PostgreSQL, a disponibilidade Redis e o heartbeat do worker. Não verifica integrações externas nem garante execuções bem-sucedidas.

## Publicação

Consulta [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) para a topologia web/worker e a checklist de publicação em produção. O ficheiro [docs/backup-and-recovery.md](docs/backup-and-recovery.md) define requisitos de cópias de segurança, proteção de segredos e testes de restauro. É um procedimento a implementar e validar, não uma prova de que as cópias de segurança ou a recuperação já estejam operacionais.

## Estado do projeto

O RunLattice é um protótipo de produto de automação em fase inicial, ainda não preparado para produção. A base de autenticação e espaços de trabalho está implementada e a primeira ação externa real está disponível através de webhooks Discord.

O planeamento por IA já tem adaptadores de fornecedores, orçamentos por espaço de trabalho, limitação de pedidos e propostas sujeitas a revisão, mas continua desativado por predefinição.

Continuam pendentes integrações adicionais, adaptadores de ações de uso geral, retoma durável de etapas, administração de membros e convites, proteção contra abuso na infraestrutura de publicação, observabilidade de produção, configuração Stripe sandbox, entrega de email transacional verificada, cópias de segurança, revisão legal e revisão de segurança completa. O código de faturação e a integração de email existem, mas as credenciais externas e os testes ponta a ponta ainda não estão completos. Os webhooks de entrada assinados, o agendamento cron e a suite de integração PostgreSQL/Redis da API e worker estão implementados e passam no CI.

## Roteiro

- [x] Autenticação e isolamento de espaços de trabalho por organização
- [x] Editor visual de fluxos e biblioteca de modelos
- [x] Fila Redis/BullMQ e primeira ação Discord ativa
- [x] Credenciais de integração encriptadas por espaço de trabalho
- [x] Heartbeats de execução e deteção conservadora de execuções paradas (sem repetição automática)
- [ ] Retoma durável de execuções e políticas de repetição seguras
- [x] Avaliação de condições e ramificações
- [ ] Integrações adicionais e ligações OAuth
- [x] Webhooks de entrada assinados e triggers agendados
- [ ] Administração de membros e validação de lugares por convite
- [x] Integração de email transacional (Resend; credenciais do fornecedor e verificação de domínio pendentes)
- [x] Base de planeamento de fluxos por IA, orçamentos de utilização e limitação de pedidos
- [ ] Proteção contra abuso na infraestrutura de publicação e observabilidade de produção
- [x] Código de faturação Stripe e aplicação de permissões de planos (configuração sandbox e testes ponta a ponta pendentes)
- [x] Testes de integração PostgreSQL/Redis para API e worker
- [ ] Demonstração pública gerida com PostgreSQL, Redis e worker persistente configurados
- [ ] Revisão de segurança e preparação para lançamento público

## Autor

Desenvolvido por [16alves02](https://github.com/16alves02).