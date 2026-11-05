# RunLattice — Roadmap de desenvolvimento

**Data:** 5 de novembro de 2026  
**Estratégia:** desenvolvimento paralelo de Web, Desktop e Mobile, com núcleo partilhado.  
**Objetivo:** transformar a base atual num MVP integrado, utilizável e comercializável, sem tentar entregar toda a visão universal na primeira versão.

## Princípios de execução

- Cada fase tem critérios de saída verificáveis.
- Não avançar para funcionalidades dependentes enquanto a segurança e os contratos da fase anterior não estiverem estáveis.
- Web, Desktop e Mobile avançam em paralelo assim que existirem contratos e APIs estáveis.
- O Mobile terá editor visual completo, adaptado a toque; não será apenas uma aplicação de monitorização.
- Reutilizar a aplicação atual quando estiver correta; refatorar apenas com motivo demonstrado.
- Não declarar funcionalidades concluídas sem testes e execução real.
- Fazer deploys Preview por pull request e produção apenas após validação.
- Cada fase começa com um plano curto, ficheiros envolvidos, riscos e testes; a execução dessa fase aguarda aprovação explícita do utilizador.

## Fase 0 — Auditoria e estabilização da base

**Objetivo:** perceber exatamente o que existe e tornar a base reproduzível.

### Trabalho
- Clonar o repositório e inventariar a estrutura real.
- Instalar dependências com o lockfile existente.
- Executar lint, typecheck, testes e build.
- Confirmar o comportamento do dashboard, editor, API, Prisma, PostgreSQL, Redis e worker.
- Identificar bugs, dívida técnica, vulnerabilidades e funcionalidades simuladas.
- Documentar variáveis de ambiente sem expor segredos.
- Confirmar o fluxo local em Windows e Docker/WSL.
- Criar CI com checks de qualidade, sem alterar arquitetura desnecessariamente.

### Critérios de saída
- Comandos de instalação e execução documentados e reproduzíveis.
- Build e testes passam, ou falhas conhecidas estão registadas com issues concretas.
- Nenhuma funcionalidade simulada é apresentada como execução real.
- Existe mapa de arquitetura e inventário de riscos.

## Fase 1 — Fundamentos de plataforma e segurança

**Objetivo:** preparar o produto para utilizadores reais e múltiplos clientes.

### Trabalho
- Definir workspace monorepo com pnpm/Turborepo apenas quando o plano de apps for iniciado; preservar o estado atual até haver migração testada.
- Estabelecer contratos partilhados de workflow, execução, integrações e API, com schemas versionados.
- Implementar autenticação, sessões e recuperação de conta.
- Introduzir utilizadores, workspaces/organizações, membership e roles.
- Proteger cada endpoint e operação por autorização server-side.
- Criar isolamento multi-tenant e testes de acesso cruzado.
- Preparar gestão segura de credenciais, cifragem e redaction.
- Criar migrations versionadas e estratégia de backup/restore.
- Adicionar rate limiting, audit trail e gestão de sessões.

### Critérios de saída
- Um utilizador não consegue ler ou alterar dados de outro workspace.
- Não existem segredos no browser, logs ou repositório.
- Testes automatizados cobrem permissões e isolamento.
- Migrações e rollback estão documentados.

## Fase 2 — Motor de execução real e integrações

**Objetivo:** deixar de simular workflows e executar ações reais com segurança.

### Trabalho
- Definir runtime independente da UI e do fornecedor de filas.
- Implementar registry de nós e adapters de integrações.
- Implementar validação de grafo, tipos de dados e versão do workflow.
- Introduzir Temporal como orquestrador durável para workflows long-running, esperas, retries e recuperação; manter BullMQ para tarefas auxiliares curtas quando fizer sentido.
- Implementar idempotência, deduplicação, timeouts, backoff, rate limits, cancelamento e concorrência.
- Construir primeiro os conectores HTTP/Webhooks, Gmail, Google Sheets e Discord; seguir com Slack, GitHub, Supabase e Stripe.
- Implementar OAuth/API keys, scopes mínimos, rotação e revogação.
- Proteger HTTP contra SSRF, destinos privados, redirects perigosos e abuso.
- Adicionar ambientes de teste, payloads de exemplo e contratos de integração.
- Registar inputs/outputs com redaction e histórico por nó.

### Critérios de saída
- Workflow real completa pelo menos um percurso de trigger → transformação/condição → ação externa.
- Retries não duplicam efeitos externos quando o provider suporta idempotência.
- Falhas e execuções interrompidas podem ser inspecionadas e recuperadas.
- Cada conector publicado tem testes e documentação.
- Custos, rate limits e falhas dos fornecedores são observáveis.

## Fase 3 — AI Builder e AI Architect

**Objetivo:** permitir que uma pessoa descreva o que quer e obtenha um workflow funcional, explicável e testável.

### Trabalho
- Integrar uma camada multi-provider de modelos, com routing por custo, latência, qualidade e privacidade.
- Implementar AI Builder com output estruturado e validação de schema.
- Criar plano de execução antes de gerar ou alterar o workflow.
- Permitir rever, editar, testar e aceitar alterações.
- Criar ferramentas de IA com permissões mínimas e aprovação humana.
- Implementar quotas, budgets, medição de tokens/custos e limites por plano.
- Adicionar análise de erros e sugestões de correção.
- Criar guardrails contra prompt injection, tool abuse e exfiltração de segredos.
- Guardar histórico das propostas e decisões da IA.

### Critérios de saída
- Pedidos de teste produzem workflows válidos e editáveis.
- A IA não ativa nem executa ações sensíveis sem autorização exigida.
- Utilização e custos são medidos por workspace.
- Existem testes de avaliação para qualidade, segurança e regressões.

## Fase 4 — Experiência multiplataforma em paralelo

**Objetivo:** disponibilizar uma experiência coerente em Web, Desktop e Mobile.

### Web
- Melhorar editor, dashboard, onboarding e responsividade.
- Implementar estados de execução em tempo real, inspeção por nó, logs e histórico.
- Adicionar acessibilidade por teclado e leitores de ecrã.

### Mobile — iOS e Android
- Criar app Expo/React Native.
- Implementar editor touch-first completo para os mesmos modelos de workflow suportados.
- Suportar pan, zoom, seleção, ligação de nós, painel de configuração, pesquisa, undo/redo, AI Builder, testes e inspeção.
- Criar UX adaptada a telemóveis e tablets.
- Implementar notificações push, autenticação biométrica e cache/offline seguro de drafts.
- Não armazenar credenciais ou outputs sensíveis em cache local sem proteção.

### Desktop — Windows, macOS e Linux
- Criar app Tauri 2, inicialmente com a experiência web.
- Adicionar atalhos, notificações, janelas/workspaces e atualizações.
- Desenvolver Local Agent separado, com permissões explícitas por pasta, comando e integração.
- Aplicar capabilities de Tauri com privilégio mínimo; nunca expor uma shell irrestrita ao frontend.

### Critérios de saída
- O mesmo workflow é aberto e editado nas três plataformas sem perda de dados.
- Mobile consegue construir, configurar, testar e inspecionar workflows sem depender do desktop.
- Desktop funciona sem Node.js instalado pelo utilizador.
- Testes de interface cobrem os fluxos críticos em cada plataforma.

## Fase 5 — Monetização, lançamento e operação

**Objetivo:** lançar um produto com billing transparente e capacidade de operar com clientes.

### Trabalho
- Implementar Free e Pro; preparar Teams, Business e Enterprise por configuração.
- Stripe Billing para subscrições, portal de cliente, webhooks idempotentes, invoices e cancelamento.
- Quotas de execuções, limites de concorrência e créditos de IA.
- Budgets, alertas e estimativas de consumo antes de operações dispendiosas.
- Analytics de ativação, retenção, execução, custos e conversão.
- Sentry/OpenTelemetry e alertas operacionais.
- Termos, Política de Privacidade, DPA e lista de subprocessadores revistos antes de recolher dados reais.
- Alpha privada, Beta fechada, Beta pública e lançamento gradual com feature flags.
- Testes de carga, recuperação de backups, incident response e rollback.

### Critérios de saída
- Subscrições, upgrades, downgrades e cancelamentos foram testados em sandbox.
- Nenhuma execução ultrapassa silenciosamente os budgets configurados.
- Suporte, incidentes e comunicação de falhas têm processo documentado.
- O lançamento tem métricas e critérios de rollback.

## Fase 6 — Expansão do ecossistema

**Objetivo:** aumentar retenção, distribuição e receitas sem comprometer a fiabilidade do core.

### Trabalho
- Agent Studio e equipas multiagente.
- Knowledge Hub, RAG, sincronização e proveniência.
- Memória contextual por utilizador, organização, equipa, projeto e workflow.
- Marketplace oficial, comunidade e premium; pagamentos a criadores e comissão.
- SDKs, CLI, API pública, developer portal e sandbox.
- Extensões e conectores privados/públicos com revisão de segurança.
- Colaboração em tempo real, comentários, aprovações e histórico.
- Templates recomendados e descoberta de automações com IA.
- Self-hosted, híbrido, on-prem e gestão de deployments.
- SSO, auditoria avançada, regiões privadas e SLAs empresariais.

### Critérios de saída
- Extensões têm versionamento, permissões, assinatura/verificação e processo de revogação.
- Marketplace tem regras para pagamentos, reembolsos, impostos, moderação e disputas.
- Novas capacidades mantêm isolamento, observabilidade e controlo de custos.

## Streams de trabalho paralelos

| Stream | Responsabilidade | Dependências principais |
|---|---|---|
| Core & Runtime | schema, validação, execução, retries, eventos | Fase 0 |
| Web | dashboard, editor, onboarding, billing | contratos e API |
| Mobile | editor touch-first, gestão, notificações | contratos e API |
| Desktop | shell Tauri, integração nativa, Local Agent | contratos e políticas de segurança |
| AI | AI Builder, routing, agentes, avaliações | schemas, permissões, runtime |
| Integrations | adapters, OAuth, webhooks, SDK | runtime e vault |
| Platform & Security | auth, tenancy, CI/CD, observabilidade | Fase 0 |

## Decisões técnicas de referência

- Linguagem principal: TypeScript.
- Web existente: Next.js e React; preservar e estabilizar antes de migrar.
- Mobile: Expo + React Native.
- Desktop: Tauri 2.
- Monorepo futuro: pnpm workspaces + Turborepo.
- Dados: PostgreSQL + Prisma; Supabase Auth/Storage são opções de managed services, com segurança e RLS avaliados antes de expor tabelas.
- Execução durável: Temporal TypeScript SDK.
- Tarefas auxiliares: Redis + BullMQ, quando apropriado.
- Editor Web: React Flow ou alternativa validada por protótipo.
- Editor Mobile: canvas nativo touch-first; partilhar modelo e comandos, não forçar componentes DOM.
- IA: Vercel AI SDK e camada própria de providers/routing; não acoplar lógica de produto a um único fornecedor.
- Pagamentos: Stripe.
- Qualidade: Vitest, Playwright, testes de integração e Maestro para Mobile.
- Observabilidade: OpenTelemetry + Sentry; analytics de produto com consentimento e minimização.

Estas decisões são propostas de arquitetura. Versões, compatibilidade, custos e requisitos dos serviços devem ser validados em cada fase.

## Regra de aprovação

Antes de começar cada fase, apresentar:
1. objetivo e resultado esperado;
2. ficheiros e módulos que serão alterados;
3. plano técnico em passos curtos;
4. riscos e dependências;
5. comandos e testes de validação.

A fase só começa depois de aprovação explícita do utilizador.
