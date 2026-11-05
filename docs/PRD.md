# RunLattice — Product Requirements Document

**Estado:** visão de produto e requisitos de referência  
**Versão:** 1.0  
**Data:** 5 de novembro de 2026  
**Repositório:** https://github.com/16alves02/RunLattice

## 1. Resumo executivo

RunLattice é uma plataforma universal de automação e orquestração, AI-first e multi-plataforma, que permite a indivíduos, freelancers, pequenas e médias empresas, equipas técnicas e organizações de grande dimensão automatizar processos sem exigir programação, sem limitar quem precisa de controlo técnico.

A plataforma combina criação por linguagem natural, editor visual, configuração guiada e código. A IA pode planear, construir, testar, explicar, otimizar e monitorizar automações, mas a execução respeita permissões, políticas de risco, limites de utilização e aprovações humanas.

**Promessa central:** transformar uma intenção ou processo numa automação compreensível, testável, segura e observável.

O produto deve ser comercialmente sustentável, com planos recorrentes, consumo adicional, funcionalidades profissionais e empresariais e, numa fase posterior, um marketplace com receitas para criadores.

## 2. Visão e posicionamento

### Posicionamento

**Universal Automation Platform:** AI-first, no-code, low-code e pro-code, preparada para indivíduos, equipas e empresas.

O produto é universal desde o início em posicionamento e arquitetura. A aquisição e a experiência inicial serão segmentadas por necessidades e casos de uso, sem tentar comunicar todas as funcionalidades a todas as pessoas na mesma página.

### Princípios

1. **Acessível por defeito:** um utilizador não técnico consegue criar a primeira automação sem escrever código.
2. **Sem limites artificiais para profissionais:** APIs, código, lógica avançada, depuração e extensibilidade.
3. **IA com controlo:** a IA propõe e executa dentro de políticas explícitas; operações sensíveis exigem autorização.
4. **Observabilidade real:** cada execução deve ser explicável, rastreável e depurável.
5. **Segurança multi-tenant:** isolamento entre utilizadores, organizações, projetos, credenciais e execuções.
6. **Portabilidade:** workflows exportáveis e opções cloud, self-hosted, híbridas e locais, introduzidas por fases.
7. **Experiência consistente:** Web, Desktop e Mobile partilham modelos, contratos e linguagem visual.
8. **Monetização transparente:** quotas, consumo, créditos, custos de IA e limites sempre visíveis.

## 3. Públicos e necessidades

O RunLattice não será limitado a um único segmento. A experiência será adaptada a:

| Segmento | Necessidade principal | Exemplos |
|---|---|---|
| Indivíduos e freelancers | Poupar tempo e ligar ferramentas | emails, ficheiros, tarefas, notificações |
| PME | Reduzir trabalho manual e erros operacionais | leads, vendas, faturação, relatórios, atendimento |
| Programadores | Automatizar sistemas e APIs | webhooks, GitHub, HTTP, SQL, CI/CD |
| Equipas | Coordenar processos e aprovações | onboarding, operações, alertas, reporting |
| Enterprise | Segurança, governação e escala | SSO, RBAC, auditoria, regiões privadas, self-hosting |

O onboarding pergunta pelo perfil e objetivo, mas não bloqueia funcionalidades por profissão. Templates, exemplos, recomendações e complexidade da interface são adaptados ao contexto.

## 4. Proposta de valor e diferenciação

- Um único produto com quatro formas de construir: AI Builder, Guided Builder, Visual Builder e Code Builder.
- AI Architect que transforma objetivos em workflows completos, explica decisões, testa e sugere melhorias.
- Editor visual híbrido, com canvas infinito, nós, ligações, painel contextual, pesquisa de ações, minimapa, zoom, undo/redo e depuração.
- Editor visual completo também em Mobile, adaptado a toque e tablets.
- Sistema de execução durável, com retries, idempotência, histórico e recuperação.
- Integrações oficiais e ecossistema aberto.
- Agent Studio e orquestração multiagente.
- Knowledge Hub com documentos, fontes externas, pesquisa semântica e permissões.
- Marketplace de templates, agentes e extensões.
- Cloud, self-hosted, híbrido e Local Agent, disponibilizados progressivamente.

## 5. Plataformas

### Web
Experiência principal de criação, gestão, administração, billing, marketplace e desenvolvimento.

### Desktop
Aplicação para Windows, macOS e Linux, com editor completo, múltiplas janelas/workspaces, notificações nativas, atalhos e integração segura com o Local Agent. A primeira versão desktop poderá reutilizar a experiência Web dentro de Tauri; funcionalidades nativas são acrescentadas de forma incremental.

### Mobile
Aplicações iOS e Android com dashboard, notificações, gestão e **editor visual completo**. O editor deve suportar criação, edição, ligações, zoom, seleção, configuração de nós, AI Builder, testes, inspeção e colaboração. A experiência deve ser touch-first, não uma simples versão reduzida do Web. Tablets são suportados.

### Estratégia de desenvolvimento
Desenvolvimento paralelo das três plataformas, partilhando contratos, modelo de workflow, regras de negócio, design tokens e SDK. Os componentes visuais são adaptados a cada plataforma; não se força a partilha de componentes DOM com React Native.

## 6. Experiência de criação

Todos os modos criam o mesmo formato de workflow e usam o mesmo motor de validação e execução.

1. **AI Builder:** pedido em linguagem natural; a IA produz um plano e um workflow editável.
2. **Guided Builder:** criação passo a passo com perguntas e validação.
3. **Visual Builder:** edição manual por nós e ligações.
4. **Code Builder:** expressões, JavaScript/TypeScript e integração por API, sempre em sandbox isolado.

### AI Architect

O AI Architect deve:
- interpretar o objetivo e identificar etapas, dados e sistemas envolvidos;
- sugerir integrações e alternativas;
- construir um plano antes de criar o workflow;
- gerar nós, ligações, mapeamentos e validações;
- identificar credenciais em falta sem pedir para revelar segredos no chat;
- testar com dados de exemplo e ambientes de teste;
- explicar o resultado e os limites;
- detetar erros, propor correções e otimizações;
- acompanhar a saúde e recomendar manutenção.

O utilizador pode rever, editar e rejeitar qualquer proposta. A ativação e ações sensíveis obedecem às políticas definidas.

## 7. Editor visual de workflows

O editor é baseado em nós e ligações, com:
- canvas infinito, zoom, pan, minimapa e seleção múltipla;
- pesquisa de triggers, ações e integrações;
- painel contextual de configuração;
- ligações com validação de tipos e dados;
- undo/redo e histórico de versões;
- comentários e colaboração em fases posteriores;
- execução de teste, execução passo a passo e inspeção de input/output;
- estados visuais em tempo real;
- acessibilidade por teclado e alternativas ao drag-and-drop.

### Tipos de nós previstos
Triggers, Actions, Conditions, Delays, Loops, Variables, JavaScript/Code, AI, Error Handling, Approval/Human-in-the-loop e Sub-workflows.

O formato de workflow é versionado, validado por schema e independente da interface gráfica.

## 8. Motor de execução

O motor suporta progressivamente:
- execução sequencial, paralela e condicional;
- triggers manuais, webhooks, agendamentos e eventos;
- workflows long-running e esperas por aprovação humana;
- dados tipados entre etapas;
- retries com backoff, timeouts, rate limits e circuit breakers;
- idempotency keys e deduplicação;
- cancelamento, pausa, retoma e recuperação;
- políticas de concorrência e limites por plano;
- histórico de eventos e inspeção de dados;
- replay seguro, respeitando side effects e idempotência.

**Garantia:** não prometer exactly-once universal. O desenho deve assumir entrega pelo menos uma vez e proteger efeitos externos com idempotência, deduplicação e reconciliação quando suportado.

Cada execução deve ter correlação, versão exata do workflow, versão dos conectores, política aplicada e registo de decisões relevantes.

## 9. Integrações

### Primeira vaga de integrações
1. Webhooks e HTTP/REST.
2. Gmail.
3. Google Sheets.
4. Discord.
5. Slack.
6. GitHub.
7. Supabase.
8. Stripe.

A primeira versão de cada conector deve ter um conjunto pequeno e sólido de triggers/actions, documentação, testes de contrato, limites e tratamento de erros. Não é necessário cobrir todas as operações da API externa no primeiro lançamento.

### Arquitetura de conectores
- catálogo e registry com metadados, versões e schemas;
- OAuth 2.0 quando disponível, API keys e credenciais personalizadas;
- segredos cifrados e nunca devolvidos ao cliente;
- scopes mínimos e renovação/revogação;
- rate limits e tratamento de quotas do fornecedor;
- sandbox/test mode quando suportado;
- logs sem tokens, passwords ou payloads sensíveis por defeito;
- SDK para conectores próprios numa fase posterior.

HTTP/Webhooks devem ser uma integração universal, mas com allowlists, proteção SSRF, bloqueio de redes privadas e validação de destinos para impedir acesso a serviços internos.

## 10. IA, agentes e conhecimento

### AI Orchestration System
Um agente principal encaminha pedidos para agentes especializados: Workflow, Debug, Integration, Optimization, Analytics, Security e Support.

### Autonomia adaptativa
Políticas configuráveis por utilizador, organização, equipa, projeto e workflow:
- níveis de confiança e risco;
- ações permitidas, proibidas ou sujeitas a aprovação;
- limites de custo, tempo, volume e frequência;
- aprovação obrigatória para ações financeiras, destrutivas ou sensíveis;
- escalonamento para responsáveis;
- auditoria das decisões e ações.

A IA não pode aumentar as próprias permissões nem alterar políticas de segurança.

### Memória contextual
Memória separada por utilizador, organização, equipa, projeto e workflow, com permissões, origem, expiração, edição e eliminação. Informação privada de uma organização nunca pode ser usada por outra.

### Knowledge Hub
Documentos, URLs, bases de dados e fontes externas; sincronização, indexação semântica, RAG, versões, proveniência e permissões. A IA deve indicar as fontes relevantes e respeitar os acessos do utilizador que faz a pergunta.

### Agent Studio
Criação visual e conversacional de agentes, com objetivos, instruções, ferramentas, memória, modelos, triggers, avaliações, testes, versões e publicação. Equipas multiagente podem delegar trabalho, executar em paralelo e validar resultados, dentro de budgets e políticas.

Estas capacidades fazem parte da visão de produto; não são todas requisitos do primeiro MVP.

## 11. Observabilidade e colaboração

### Observabilidade
Dashboard de execuções, sucesso/falha, duração, custos, consumo de IA, integrações, alertas, logs, inputs/outputs com redaction, inspeção por nó, replay e análise assistida por IA. A retenção é configurável por plano e organização.

### Colaboração
Organizações, equipas, projetos e ambientes; convites, roles, permissões granulares, presença, comentários, menções, revisões, aprovações, histórico e auditoria. Edição simultânea avançada será fase posterior; conflitos não podem sobrescrever silenciosamente alterações.

## 12. Organizações, ambientes e deployments

Modelo multi-tenant:
- conta pessoal;
- organizações e membros;
- equipas, projetos e ambientes;
- roles predefinidas e permissões customizáveis;
- billing centralizado;
- convites e auditoria.

Ciclo de vida do workflow: Draft → Test → Development → Staging → Production, com versões imutáveis, comparação, variáveis por ambiente, approvals e rollback.

## 13. Modelo comercial e monetização

### Planos
- **Free:** utilização real e útil, com limites claros.
- **Pro:** utilizadores avançados, mais execução, integrações e capacidades AI.
- **Teams:** colaboração, administração, quotas partilhadas e aprovações.
- **Business:** governação, segurança e suporte reforçados.
- **Enterprise:** SSO, políticas avançadas, SLAs contratualizados, regiões privadas, self-hosting/on-prem e suporte dedicado.

### Receitas
- subscrições mensais e anuais;
- consumo adicional de execuções e créditos de IA;
- pay-as-you-go com orçamento e alertas;
- marketplace de templates, agentes e extensões;
- planos empresariais, implementação, migração e suporte.

### Princípios de billing
- quotas e custos visíveis antes de executar;
- limites e budgets configuráveis;
- sem cobranças surpresa;
- cancelamento e downgrade claros;
- trials sem cartão quando possível;
- IVA, faturação e requisitos fiscais por mercado.

Os preços e limites concretos são hipóteses a validar com custos reais de infraestrutura, IA e suporte. Não fixar preços no código: usar configuração e catálogo de planos.

### Marketplace
Três áreas: oficial, comunidade gratuita e premium. Comissão de referência: 15% RunLattice / 85% criador, sujeita a revisão de custos de pagamento, impostos, reembolsos e regras do programa. Não faz parte do MVP inicial.

## 14. Segurança, privacidade e conformidade

- GDPR by design, minimização, exportação e eliminação de dados.
- Isolamento multi-tenant em todas as operações.
- Encriptação em trânsito e em repouso; gestão segura de segredos.
- RLS onde aplicável e autorização no servidor em cada operação.
- RBAC, auditoria e sessões seguras.
- Sandboxes para código e ferramentas, sem acesso irrestrito ao host.
- Proteção contra SSRF, prompt injection, tool abuse e supply-chain attacks.
- Allowlist de ações e validação de argumentos antes de executar ferramentas.
- Redaction de dados sensíveis em logs e prompts.
- Controlo de dados enviados a fornecedores de IA; BYOK e modelos locais em fases posteriores.
- Retenção, localização de dados, subprocessadores e DPA documentados antes de comercialização.
- Política de resposta a incidentes e divulgação responsável de vulnerabilidades.

Não apresentar certificações, SLAs ou garantias legais que ainda não tenham sido auditados e contratualizados.

## 15. Deployment e extensibilidade

Visão de deployment: cloud SaaS, self-hosted, híbrido, on-prem, Docker e Kubernetes. O MVP é cloud-first; os outros modelos exigem documentação, instalação, atualização, backups e suporte próprios.

Ecossistema futuro: REST API versionada, webhooks bidirecionais, SDKs, CLI, developer portal, sandbox, extensões privadas/públicas, nós personalizados e marketplace.

Open-core é a direção estratégica provisória: motor/SDKs/componentes essenciais abertos, SaaS e funcionalidades empresariais comerciais. A licença concreta deve ser escolhida após revisão de compatibilidade de dependências e aconselhamento adequado; a marca RunLattice deve ser protegida separadamente do código.

## 16. Internacionalização e acessibilidade

Idiomas iniciais planeados: Português (Portugal), Inglês, Espanhol, Francês e Alemão. Interface, documentação, templates e mensagens devem ser localizáveis; evitar strings hardcoded.

Objetivo de acessibilidade: WCAG 2.2 AA, navegação por teclado, leitores de ecrã, contraste, tipografia ajustável, reduced motion e alternativas ao drag-and-drop.

## 17. Âmbito do MVP integrado

O MVP deve permitir completar um percurso real de ponta a ponta:

1. Criar conta e workspace.
2. Escolher objetivo ou template.
3. Ligar uma integração com OAuth/API key.
4. Pedir à IA para criar um workflow ou construí-lo no editor.
5. Rever, editar e validar o workflow.
6. Executar em modo de teste.
7. Ativar e executar na cloud.
8. Ver estado, logs e resultado.
9. Pausar, editar, versionar e voltar a executar.
10. Consultar consumo e limites.

### Incluído no MVP
- autenticação e gestão básica de conta/workspace;
- autorização e isolamento de dados;
- dashboard e gestão de workflows;
- editor visual web funcional;
- editor mobile touch-first funcional para os mesmos tipos de nós suportados;
- desktop como shell Tauri com experiência de editor e ligação segura ao Local Agent apenas quando este estiver implementado;
- AI Builder com revisão humana e limites de custo;
- engine com execução real e persistência;
- primeira vaga de oito integrações, com cobertura inicial limitada e documentada;
- histórico, logs e erros;
- planos Free/Pro e billing inicial;
- métricas, rate limiting e monitorização essenciais.

### Explicitamente fora do primeiro MVP
Marketplace transacional, edição colaborativa em tempo real, Agent Studio multiagente completo, Knowledge Hub com sincronização de múltiplas fontes, Local Agent com acesso a ficheiros/terminal, on-prem/Kubernetes gerido, SSO Enterprise, relatórios avançados e dezenas de integrações adicionais.

A arquitetura deve permitir estas capacidades sem fingir que já existem.

## 18. Métricas de sucesso

### North Star
**Workflows ativos que concluem execuções úteis e repetidas por workspace.**

### Ativação
- percentagem de workspaces que ligam uma integração;
- percentagem que cria e executa o primeiro workflow real;
- tempo até à primeira execução bem-sucedida.

### Retenção e valor
- workspaces ativos semanal/mensal;
- workflows ativos por workspace;
- execuções úteis concluídas;
- retenção por coorte e segmento;
- tempo poupado reportado pelo utilizador.

### Monetização
- conversão Free → pago;
- MRR/ARR e churn;
- receita média por workspace;
- margem por execução e por tarefa de IA;
- utilização de créditos e marketplace quando existir.

### Fiabilidade e qualidade
- taxa de sucesso por conector;
- latência de execução;
- erros recuperáveis vs. não recuperáveis;
- incidentes de segurança;
- custo por workflow concluído;
- satisfação e tickets de suporte.

Não definir metas numéricas sem baseline; estabelecer targets após Alpha e Beta.

## 19. Riscos principais e mitigação

| Risco | Mitigação |
|---|---|
| Âmbito demasiado grande | MVP com percurso vertical completo e funcionalidades faseadas |
| Custos de IA imprevisíveis | routing por tarefa, quotas, budgets, BYOK futuro e telemetria |
| Integrações frágeis | conectores versionados, testes de contrato e monitorização |
| Execução duplicada | idempotência, deduplicação e reconciliação |
| Fuga entre tenants | autorização server-side, testes de isolamento e RLS quando aplicável |
| Código malicioso | sandbox isolado, sem acesso ao host por defeito |
| Mobile editor complexo | canvas nativo touch-first e validação com utilizadores |
| Infraestrutura cara | medir custo real, limites por plano e adoção progressiva de serviços |
| Dependência de fornecedor | adapters e contratos independentes de providers |

## 20. Estado atual conhecido do repositório

Na auditoria inicial de 5 de novembro de 2026:
- existe uma aplicação Next.js 15 / React 19 / TypeScript;
- Prisma e PostgreSQL guardam workflows e runs;
- Redis/BullMQ disponibilizam a fila;
- existe worker, mas a travessia dos nós é simulada;
- não foi identificada autenticação nem isolamento multi-tenant;
- integrações externas reais ainda não estão implementadas;
- o README indica que build, testes, acessibilidade e Lighthouse ainda precisam de validação no ambiente de desenvolvimento.

Esta secção é uma fotografia inicial, não substitui uma auditoria local completa do código.

## 21. Referências técnicas

- Temporal TypeScript SDK: https://docs.temporal.io/develop/typescript
- Temporal Workflows: https://docs.temporal.io/workflows
- Expo Monorepos: https://docs.expo.dev/guides/monorepos/
- Tauri Sidecars: https://tauri.app/develop/sidecar/
- Tauri Capabilities: https://tauri.app/security/capabilities/
- Vercel AI SDK: https://ai-sdk.dev/docs
- Supabase Security: https://supabase.com/docs/guides/security

As tecnologias e versões devem ser novamente verificadas no início de cada fase de implementação.
