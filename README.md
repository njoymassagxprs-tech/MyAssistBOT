# 🤖 MyAssistBOT

### Assistente IA pessoal open-source com 16+ agentes autónomos, 6 interfaces, i18n multilingue (PT/EN/ES/FR) e controlo total do teu PC — 100% gratuito.

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Electron](https://img.shields.io/badge/Electron-28+-47848F?logo=electron&logoColor=white)](https://electronjs.org/)
[![Groq](https://img.shields.io/badge/AI-Groq%20LLaMA%203.3%2070B-orange)](https://groq.com)
[![i18n](https://img.shields.io/badge/i18n-PT%20|%20EN%20|%20ES%20|%20FR-blue)](.)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

---

> **💡 O que o diferencia?** Não é "mais um chat com IA". O MyAssistBOT é um *agente de sistema* — abre apps, controla o teclado/rato, cria projetos inteiros por descrição, pesquisa a web, gera PDFs, monitoriza o sistema, aprende as tuas preferências (Smart Memory), automatiza workflows, e funciona em desktop, browser, Telegram, Discord e terminal. Suporta 4 idiomas (PT/EN/ES/FR) e múltiplos provedores de IA (Groq, Cerebras, Gemini, HuggingFace, Ollama, ou o teu próprio).

---

## ⚡ O que Consegue Fazer (em 30 segundos)

```
👤 "Abre o Chrome e vai a github.com"          → Abre browser, digita URL, carrega Enter
👤 "Cria uma app de tarefas em React"           → Planifica, gera código, cria 6+ ficheiros
👤 "Preço do Bitcoin hoje"                      → Pesquisa web em tempo real + resumo IA
👤 "Cria PDF sobre energia solar"               → Documento A4 profissional gerado por IA
👤 "Tira screenshot e lista os processos"       → Captura ecrã + lista processos do sistema
👤 "Executar: [1,2,3].map(x => x * 10)"        → Executa código JS em sandbox seguro → [10,20,30]
```

---

## 🏗️ Arquitetura Multi-Agente

```
                    ┌──────────────────────────────────────────┐
                    │              6 INTERFACES                │
                    │  🖥️ Desktop  🌐 Web  📱 Telegram        │
                    │  🎮 Discord  ⌨️  CLI  🔌 API REST       │
                    └──────────────────┬───────────────────────┘
                                       │
                    ┌──────────────────▼───────────────────────┐
                    │            ORCHESTRATOR                   │
                    │  Intent Parser (Regex→LLM, 80+ intents)  │
                    │  LLM Router (Custom→Groq→Cerebras→...)   │
                    │  Agent Chaining · Plugin System            │
                    │  RAG Engine · i18n (PT/EN/ES/FR)          │
                    │  Security · Decision Engine · Memory      │
                    └──────────────────┬───────────────────────┘
                                       │
    ┌──────┬────────┬────────┬────────┼────────┬────────┬──────┬──────────┐
    ▼      ▼        ▼        ▼        ▼        ▼        ▼      ▼          ▼
 ┌──────┐┌───────┐┌──────┐┌──────┐┌──────┐┌──────┐┌───────┐┌──────┐┌────────┐
 │  🧠  ││  🔍   ││  📄  ││  💻  ││  🖥️  ││  ⌨️  ││  🏗️  ││  📡  ││  📊   │
 │  AI  ││Search ││ PDF  ││ Code ││System││Input ││Build  ││Remote││Dash-  │
 │Agent ││Agent  ││Agent ││Runner││Agent ││Agent ││Agent  ││Agent ││board  │
 └──────┘└───────┘└──────┘└──────┘└──────┘└──────┘└───────┘└──────┘└────────┘
 ┌──────┐┌───────┐┌──────┐┌──────┐┌──────┐┌──────┐┌───────┐
 │  ⏰  ││  🧩   ││  🎓  ││  👁️  ││  🚨  ││  🔄  ││  📋   │
 │Auto- ││Smart  ││Skill ││Vision││Alert ││Work- ││Clip-  │
 │mation││Memory ││Agent ││Agent ││Agent ││flow  ││board  │
 └──────┘└───────┘└──────┘└──────┘└──────┘└──────┘└───────┘
```

---

## 🚀 Início Rápido

```bash
git clone https://github.com/njoymassagxprs-tech/MyAssistBOT.git
cd MyAssistBOT
npm install
npm run setup     # Configura API key gratuita (Groq)
npm run dev        # Inicia desktop + API
```

> **API Key grátis:** [console.groq.com/keys](https://console.groq.com/keys) → 14.400 pedidos/dia, 0€.

---

## 🎯 16+ Agentes Especializados

| Agente | Capacidade | Exemplos |
|--------|-----------|----------|
| 🧠 **AI Agent** | Conversa inteligente, geração de texto, tradução | *"Explica quantum computing"* |
| 🔍 **Web Search** | Pesquisa em tempo real, notícias, cotações | *"Bitcoin hoje"*, *"Notícias de IA"* |
| 📄 **PDF Agent** | Cria documentos PDF profissionais | *"Cria PDF sobre blockchain"* |
| 📁 **File Agent** | Gestão de ficheiros, notas, documentos | *"Criar nota: reunião às 15h"* |
| 💻 **Code Runner** | Executa JavaScript em sandbox seguro | *"Executar: Math.PI * 100"* |
| 🖥️ **System Agent** | Abre apps, gere processos, janelas, comandos | *"Abre VS Code"*, *"Lista processos"* |
| ⌨️ **Input Agent** | Teclado, rato, screenshots, clipboard | *"Digita: Hello"*, *"Ctrl+S"* |
| 🏗️ **Project Builder** | Cria projetos completos via IA | *"Cria uma API REST em Express"* |
| 📡 **Remote Agent** | Automação SSH em máquinas remotas | *"Executa uptime no servidor1"* |
| ⏰ **Automation Agent** | Tarefas agendadas, cron jobs, lembretes | *"Lembra-me às 15h"*, *"Agenda backup"* |
| 🧩 **Smart Memory** | Aprende preferências, perfil do utilizador | *"Lembra que prefiro Python"* |
| 🎓 **Skill Agent** | Cria e reutiliza skills personalizados | *"Cria skill de deploy"* |
| 👁️ **Vision Agent** | Analisa screenshots, OCR, deteta erros | *"Analisa este screenshot"* |
| 🚨 **Alert Agent** | Monitores de sistema, alertas inteligentes | *"Alerta se CPU > 90%"* |
| 🔄 **Workflow Agent** | Workflows multi-passo reutilizáveis | *"Cria workflow de deploy"* |
| 📋 **Clipboard Agent** | Histórico de clipboard, pesquisa, monitorização | *"Mostra clipboard"*, *"Pesquisa no clipboard"* |
| 🔗 **Agent Chaining** | Multi-passo: compõe vários agentes numa instrução | *"Pesquisa sobre React e cria PDF resumo"* |
| 🔌 **Plugin System** | Extensibilidade via hot-reload | Cria ficheiros em `plugins/` |
| 📊 **Dashboard** | Métricas e logs em tempo real | Acede a `/dashboard` no browser |

---

## 💻 6 Interfaces

| Plataforma | Comando | Descrição |
|-----------|---------|-----------|
| 🖥️ **Desktop** | `npm run desktop` | App Electron com system tray |
| 🌐 **Web** | `npm run core` | Servidor unificado (API + Web + Dashboard) |
| 📱 **Telegram** | `npm run telegram` | Bot acessível de qualquer lugar |
| 🎮 **Discord** | `npm run discord` | Bot para servidores Discord |
| ⌨️ **CLI** | `npm run cli` | Terminal para devs |
| 🔌 **API** | `npm run core` | HTTP REST + WebSocket (porta 7777) |

```bash
# Iniciar tudo de uma vez
npm run dev:all
```

---

## 📦 Estrutura do Projeto

```
MyAssistBOT/
├── agents/                  # 16 Agentes especializados
│   ├── aiAgent.js          # LLM Router multi-provedor
│   ├── webSearchAgent.js   # DuckDuckGo / Serper
│   ├── pdfAgent.js         # Geração de PDFs
│   ├── fileAgent.js        # Operações de ficheiros
│   ├── codeRunner.js       # Sandbox JavaScript
│   ├── systemAgent.js      # Controlo do OS
│   ├── inputAgent.js       # Automação teclado/rato
│   ├── projectBuilder.js   # Criação de projetos via IA
│   ├── remoteAgent.js      # SSH remoto
│   ├── automationAgent.js  # Tarefas agendadas / cron
│   ├── smartMemory.js      # Memória inteligente
│   ├── skillAgent.js       # Skills reutilizáveis
│   ├── visionAgent.js      # Análise visual / OCR
│   ├── alertAgent.js       # Monitores e alertas
│   ├── workflowAgent.js    # Workflows multi-passo
│   └── clipboardAgent.js   # Clipboard avançado
│
├── orchestrator/            # Motor central
│   ├── orchestrator.js     # Coordenador principal
│   ├── intentParser.js     # Análise de intenções (80+ intents)
│   ├── llmRouter.js        # Router multi-provedor IA
│   ├── ragEngine.js        # RAG (Retrieval Augmented)
│   ├── router.js           # Roteamento de agentes
│   ├── security.js         # Rate limiting, sanitização
│   ├── pluginLoader.js     # Hot-reload de plugins
│   └── api-server.js       # Servidor HTTP + WebSocket
│
├── i18n/                    # Internacionalização
│   ├── i18n.js             # Motor i18n (auto-detect, per-user)
│   └── locales/            # Traduções (PT/EN/ES/FR)
│
├── memory/                  # Sistema de memória
│   ├── conversationStore.js # Conversas persistentes
│   └── decisionEngine.js   # Decisão texto/voz
│
├── desktop/                 # App Electron
├── web/                     # Interface web + dashboard
├── bots/                    # Telegram + Discord
├── cli/                     # Interface terminal
├── test/                    # Suite de testes (208 testes)
└── outputs/                 # PDFs, screenshots, projetos
```

---

## ⚙️ Configuração

### Variáveis de Ambiente (.env)

| Variável | Descrição | Obrigatório |
|----------|-----------|:-----------:|
| `GROQ_API_KEY` | API key Groq (grátis) | ✅ |
| `MODEL` | Modelo IA (default: llama-3.3-70b-versatile) | ❌ |
| `PORT` | Porta servidor (default: 7777) | ❌ |
| `TELEGRAM_BOT_TOKEN` | Token bot Telegram | ❌ |
| `DISCORD_BOT_TOKEN` | Token bot Discord | ❌ |
| `SERPER_API_KEY` | Pesquisa Google (opcional) | ❌ |
| `CEREBRAS_API_KEY` | Provedor Cerebras (fallback) | ❌ |
| `GEMINI_API_KEY` | Google Gemini (fallback) | ❌ |
| `HF_API_KEY` | HuggingFace (fallback) | ❌ |
| `OLLAMA_URL` | Ollama local (fallback) | ❌ |
| `CUSTOM_AI_*` | Provedor de IA personalizado | ❌ |
| `JWT_SECRET` | Secret para tokens | ❌ |

---

## 🌍 Internacionalização (i18n)

O MyAssistBOT suporta **4 idiomas** com deteção automática e preferências por utilizador:

| Idioma | Código | Flag |
|--------|--------|------|
| Português | `pt` | 🇵🇹 |
| English | `en` | 🇬🇧 |
| Español | `es` | 🇪🇸 |
| Français | `fr` | 🇫🇷 |

```
👤 "Muda para inglês"    → Interface muda para English
👤 "Change to français"  → Interface switches to French
👤 "/lang español"       → Cambia al español (CLI)
```

Cada utilizador pode ter o seu próprio idioma (Telegram/Discord usam userId). O sistema deteta o idioma do OS automaticamente.

---

## 🔀 Multi-Provedor de IA (LLM Router)

O MyAssistBOT suporta **múltiplos provedores de IA** com fallback automático:

| Prioridade | Provedor | Modelo | Custo |
|:----------:|----------|--------|:-----:|
| 0 | **Custom** (teu próprio) | Configurável | — |
| 1 | **Groq** | LLaMA 3.3 70B | Grátis |
| 2 | **Cerebras** | LLaMA 3.3 70B | Grátis |
| 3 | **Gemini** | Gemini 2.0 Flash | Grátis |
| 4 | **HuggingFace** | Mistral / Llama | Grátis |
| 5 | **Ollama** | Local (qualquer) | Grátis |

Se um provedor falhar, o sistema tenta automaticamente o próximo. Podes também configurar o teu próprio provedor OpenAI-compatible via `npm run setup`.

---

## 🔒 Segurança

- **Sandbox de Código** — Execução isolada em VM, sem acesso a `require`, `process`, `fs`
- **Rate Limiting** — 5 exec/minuto código, 30 req/minuto IA
- **Path Whitelists** — Ficheiros restritos a Home, Documents, Downloads, Desktop
- **Command Blacklists** — Bloqueio de `rm -rf`, `format`, fork bombs, etc.
- **Banking Protection** — Automação de input bloqueada em sites bancários/crypto
- **Confirmação Obrigatória** — Ações perigosas requerem aprovação explícita

---

## 🆚 O que Torna o MyAssistBOT Diferente

| Característica | ChatGPT | Open Interpreter | AutoGPT | Siri/Alexa | **MyAssistBOT** |
|---------------|:-------:|:----------------:|:-------:|:----------:|:---------:|
| Gratuito (sem limites reais) | ❌ | ❌ | ❌ | ✅ | ✅ |
| Controlo do OS (apps, processos) | ❌ | ✅ | ❌ | Parcial | ✅ |
| Automação teclado/rato | ❌ | ❌ | ❌ | ❌ | ✅ |
| Cria projetos completos | ❌ | Parcial | Parcial | ❌ | ✅ |
| Multi-plataforma (6 interfaces) | ❌ | ❌ | ❌ | ❌ | ✅ |
| Desktop + Mobile + Bots | ❌ | ❌ | Web only | Device only | ✅ |
| Pesquisa web em tempo real | ✅ | ❌ | ✅ | ✅ | ✅ |
| Português nativo + Multilingue | ❌ | ❌ | ❌ | Parcial | ✅ (4 idiomas) |
| Self-hosted / privado | ❌ | ✅ | ✅ | ❌ | ✅ |
| Modelo 70B (não um wrapper) | N/A | Local | GPT-4 ($) | Proprietário | ✅ Groq |

---

## 🛠️ Scripts NPM

| Comando | Descrição |
|---------|-----------|
| `npm run setup` | Assistente de configuração |
| `npm run dev` | Inicia tudo (recomendado) |
| `npm run core` | Servidor unificado (API + Web) |
| `npm run desktop` | App Electron |
| `npm run web` | Sinónimo de npm run core |
| `npm run telegram` | Bot Telegram |
| `npm run discord` | Bot Discord |
| `npm run cli` | Interface terminal |
| `npm run test` | Executa testes |
| `npm run icons` | Gerar ícones a partir do SVG |
| `npm run dist:win` | Build Windows (.exe) |

---

## 📦 Distribuição .exe (Windows)

O código fonte **não fica exposto** — os utilizadores recebem um executável compilado.

```bash
# 1. Gerar ícones (icon.ico, icon.png, tray-icon.png)
npm run icons

# 2. Criar instalador + portable
npm run dist:win
```

Os ficheiros ficam em `dist/`:
- **`MyAssistBOT Setup X.X.X.exe`** — Instalador NSIS (com atalho no Desktop + Menu Iniciar)
- **`MyAssistBOT X.X.X.exe`** — Versão portable (sem instalar)

> O ícone do executável é gerado automaticamente a partir de `assets/icon.svg`.

---

## 🤝 Contribuir

1. Fork do projeto
2. Cria branch: `git checkout -b feature/nova-funcionalidade`
3. Commit: `git commit -m 'Adiciona funcionalidade X'`
4. Push: `git push origin feature/nova-funcionalidade`
5. Abre Pull Request

### Adicionar Novo Agente

```javascript
// agents/meuAgente.js
async function execute(params) {
  // Lógica do agente
  return { success: true, result: 'Feito!' };
}
module.exports = { execute };
```

Depois adiciona padrões em `intentParser.js` e um `case` em `orchestrator.js`.

---

## 📜 Licença

MIT License — vê [LICENSE](LICENSE)

---

## 🙏 Créditos

- [Groq](https://groq.com) — API de IA ultra-rápida (gratuita!)
- [Electron](https://electronjs.org) — Framework desktop cross-platform
- [Express](https://expressjs.com) — Servidor web Node.js
- [PDFKit](https://pdfkit.org) — Geração de PDFs
- [DuckDuckGo](https://duckduckgo.com) — Pesquisa web gratuita

---

<p align="center">
  <b>🤖 MyAssistBOT v2.0</b><br>
  16+ agentes · 6 interfaces · 80+ comandos · 4 idiomas · 100% gratuito<br>
  <i>O teu Jarvis pessoal, open-source e multilingue.</i>
</p>
