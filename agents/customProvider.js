/**
 * 🔑 Custom AI Provider — Integração de IA Paga por Utilizador
 * 
 * Permite que utilizadores profissionais integrem a sua própria IA paga
 * (OpenAI, Anthropic Claude, Mistral, DeepSeek, xAI, Cohere, ou qualquer
 * API OpenAI-compatível) com a sua API key pessoal.
 * 
 * O provider customizado tem PRIORIDADE sobre o Groq gratuito.
 * Se o provider pago falhar, faz fallback automático para a cadeia Groq.
 * 
 * Configuração por utilizador — cada user pode ter o seu próprio provider.
 */

const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '..', 'user_data', 'custom_providers.json');

// ═══════════════════════════════════════════════════════════
// CATÁLOGO DE PROVIDERS SUPORTADOS
// ═══════════════════════════════════════════════════════════

const PROVIDER_CATALOG = {
  openai: {
    name: 'OpenAI',
    description: 'GPT-4o, GPT-4 Turbo, o1, o3 — o melhor em raciocínio e código',
    baseUrl: 'https://api.openai.com/v1',
    format: 'openai',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', desc: 'Mais rápido e económico, multimodal', recommended: true },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', desc: 'Leve e barato, bom para chat' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', desc: 'Mais potente, 128k contexto' },
      { id: 'o1', name: 'o1', desc: 'Raciocínio avançado, melhor para problemas complexos' },
      { id: 'o3-mini', name: 'o3-mini', desc: 'Raciocínio eficiente e rápido' }
    ],
    defaultModel: 'gpt-4o',
    maxTokens: 4096,
    supportsStreaming: true,
    supportsVision: true,
    website: 'https://platform.openai.com/api-keys',
    pricing: '~$2.50/1M tokens (GPT-4o)'
  },

  anthropic: {
    name: 'Anthropic Claude',
    description: 'Claude 3.5 Sonnet, Claude 4 — excelente em texto longo e código',
    baseUrl: 'https://api.anthropic.com/v1',
    format: 'anthropic',
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', desc: 'Melhor equilíbrio qualidade/custo', recommended: true },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', desc: 'Rápido e muito capaz' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', desc: 'Ultra-rápido, económico' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', desc: 'Máxima qualidade, mais lento' }
    ],
    defaultModel: 'claude-sonnet-4-20250514',
    maxTokens: 4096,
    supportsStreaming: true,
    supportsVision: true,
    website: 'https://console.anthropic.com/settings/keys',
    pricing: '~$3/1M tokens (Sonnet)'
  },

  mistral: {
    name: 'Mistral AI',
    description: 'Mistral Large, Codestral — europeu, rápido e eficiente',
    baseUrl: 'https://api.mistral.ai/v1',
    format: 'openai',
    models: [
      { id: 'mistral-large-latest', name: 'Mistral Large', desc: 'Mais potente, multilingue', recommended: true },
      { id: 'mistral-medium-latest', name: 'Mistral Medium', desc: 'Bom equilíbrio' },
      { id: 'mistral-small-latest', name: 'Mistral Small', desc: 'Rápido e económico' },
      { id: 'codestral-latest', name: 'Codestral', desc: 'Especializado em código' }
    ],
    defaultModel: 'mistral-large-latest',
    maxTokens: 4096,
    supportsStreaming: true,
    supportsVision: false,
    website: 'https://console.mistral.ai/api-keys/',
    pricing: '~$2/1M tokens (Large)'
  },

  deepseek: {
    name: 'DeepSeek',
    description: 'DeepSeek V3, R1 — chinês, barato e muito competente em código',
    baseUrl: 'https://api.deepseek.com/v1',
    format: 'openai',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek V3', desc: 'Chat geral, muito económico', recommended: true },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1', desc: 'Raciocínio avançado (chain-of-thought)' }
    ],
    defaultModel: 'deepseek-chat',
    maxTokens: 4096,
    supportsStreaming: true,
    supportsVision: false,
    website: 'https://platform.deepseek.com/api_keys',
    pricing: '~$0.27/1M tokens (V3)'
  },

  xai: {
    name: 'xAI Grok',
    description: 'Grok-2, Grok-3 — IA da X/Twitter, dados em tempo real',
    baseUrl: 'https://api.x.ai/v1',
    format: 'openai',
    models: [
      { id: 'grok-3', name: 'Grok-3', desc: 'Último modelo, raciocínio avançado', recommended: true },
      { id: 'grok-3-mini', name: 'Grok-3 Mini', desc: 'Mais rápido e económico' },
      { id: 'grok-2', name: 'Grok-2', desc: 'Estável e confiável' }
    ],
    defaultModel: 'grok-3',
    maxTokens: 4096,
    supportsStreaming: true,
    supportsVision: true,
    website: 'https://console.x.ai/',
    pricing: '~$3/1M tokens (Grok-3)'
  },

  cohere: {
    name: 'Cohere',
    description: 'Command R+ — otimizado para RAG e aplicações empresariais',
    baseUrl: 'https://api.cohere.ai/v2',
    format: 'openai',
    models: [
      { id: 'command-r-plus', name: 'Command R+', desc: 'Máximo poder, multilíngue', recommended: true },
      { id: 'command-r', name: 'Command R', desc: 'RAG otimizado' },
      { id: 'command-light', name: 'Command Light', desc: 'Rápido e leve' }
    ],
    defaultModel: 'command-r-plus',
    maxTokens: 4096,
    supportsStreaming: true,
    supportsVision: false,
    website: 'https://dashboard.cohere.com/api-keys',
    pricing: '~$2.50/1M tokens (R+)'
  },

  openrouter: {
    name: 'OpenRouter',
    description: 'Acesso a 100+ modelos (GPT-4, Claude, Llama, etc.) com uma só key',
    baseUrl: 'https://openrouter.ai/api/v1',
    format: 'openai',
    models: [
      { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4 (via OpenRouter)', recommended: true },
      { id: 'openai/gpt-4o', name: 'GPT-4o (via OpenRouter)' },
      { id: 'google/gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (via OpenRouter)' },
      { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1 (via OpenRouter)' },
      { id: 'meta-llama/llama-3.3-70b-instruct', name: 'LLaMA 3.3 70B (via OpenRouter)' }
    ],
    defaultModel: 'anthropic/claude-sonnet-4',
    maxTokens: 4096,
    supportsStreaming: true,
    supportsVision: true,
    website: 'https://openrouter.ai/keys',
    pricing: 'Variável por modelo (pay-per-use)'
  },

  custom: {
    name: 'Custom (OpenAI-Compatible)',
    description: 'Qualquer API compatível com o formato OpenAI (LM Studio, vLLM, etc.)',
    baseUrl: '',  // user sets this
    format: 'openai',
    models: [],
    defaultModel: '',
    maxTokens: 4096,
    supportsStreaming: true,
    supportsVision: false,
    website: '',
    pricing: 'Definido pelo utilizador'
  }
};

// ═══════════════════════════════════════════════════════════
// ESTADO
// ═══════════════════════════════════════════════════════════

let userProviders = {};  // { userId: { providerId, apiKey, model, baseUrl, ... } }

/**
 * Inicializa — carrega configurações guardadas
 */
function init() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      userProviders = data || {};
      const count = Object.keys(userProviders).length;
      if (count > 0) {
        console.log(`[CustomProvider] 🔑 ${count} provider(s) personalizado(s) carregado(s)`);
      }
    }
  } catch (e) {
    console.error('[CustomProvider] Erro ao carregar configs:', e.message);
    userProviders = {};
  }
}

function save() {
  try {
    const dir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(userProviders, null, 2), 'utf-8');
  } catch (e) {
    console.error('[CustomProvider] Erro ao guardar:', e.message);
  }
}

// ═══════════════════════════════════════════════════════════
// CONFIGURAÇÃO DE PROVIDER
// ═══════════════════════════════════════════════════════════

/**
 * Configura um provider personalizado para um utilizador
 * @param {string} userId
 * @param {Object} config - { providerId, apiKey, model?, baseUrl? }
 */
function setupProvider(userId, config) {
  const { providerId, apiKey, model, baseUrl } = config;

  if (!providerId || !apiKey) {
    return { success: false, error: 'Faltam dados: providerId e apiKey são obrigatórios.' };
  }

  const catalog = PROVIDER_CATALOG[providerId];
  if (!catalog) {
    return { success: false, error: `Provider "${providerId}" não reconhecido. Usa "listar providers" para ver os disponíveis.` };
  }

  // Para provider "custom", baseUrl é obrigatório
  if (providerId === 'custom' && !baseUrl) {
    return { success: false, error: 'Para provider custom, o baseUrl é obrigatório.' };
  }

  // Mascarar a key para segurança (guardar completa mas mostrar mascarada)
  const maskedKey = apiKey.substring(0, 8) + '...' + apiKey.substring(apiKey.length - 4);

  const providerConfig = {
    providerId,
    providerName: catalog.name,
    apiKey,          // guardada encriptada seria ideal, mas por agora plaintext
    maskedKey,
    model: model || catalog.defaultModel,
    baseUrl: baseUrl || catalog.baseUrl,
    format: catalog.format,
    maxTokens: catalog.maxTokens,
    supportsStreaming: catalog.supportsStreaming,
    supportsVision: catalog.supportsVision,
    configuredAt: new Date().toISOString(),
    totalCalls: 0,
    totalTokens: 0,
    lastUsed: null,
    enabled: true
  };

  userProviders[userId] = providerConfig;
  save();

  return {
    success: true,
    provider: {
      name: catalog.name,
      model: providerConfig.model,
      maskedKey,
      streaming: catalog.supportsStreaming,
      vision: catalog.supportsVision
    }
  };
}

/**
 * Remove o provider personalizado de um utilizador
 */
function removeProvider(userId) {
  if (!userProviders[userId]) {
    return { success: false, error: 'Não tens nenhum provider personalizado configurado.' };
  }
  const name = userProviders[userId].providerName;
  delete userProviders[userId];
  save();
  return { success: true, name };
}

/**
 * Obtém o provider personalizado de um utilizador (se existir e estiver ativo)
 */
function getUserProvider(userId) {
  const config = userProviders[userId];
  if (!config || !config.enabled) return null;
  return config;
}

/**
 * Ativa/desativa o provider personalizado
 */
function toggleProvider(userId) {
  const config = userProviders[userId];
  if (!config) {
    return { success: false, error: 'Nenhum provider configurado.' };
  }
  config.enabled = !config.enabled;
  save();
  return { success: true, enabled: config.enabled, name: config.providerName };
}

/**
 * Atualiza o modelo selecionado
 */
function setModel(userId, modelId) {
  const config = userProviders[userId];
  if (!config) {
    return { success: false, error: 'Nenhum provider configurado.' };
  }
  config.model = modelId;
  save();
  return { success: true, model: modelId, provider: config.providerName };
}

/**
 * Regista uso do provider (para estatísticas)
 */
function trackUsage(userId, tokens = 0) {
  const config = userProviders[userId];
  if (!config) return;
  config.totalCalls = (config.totalCalls || 0) + 1;
  config.totalTokens = (config.totalTokens || 0) + tokens;
  config.lastUsed = new Date().toISOString();
  save();
}

// ═══════════════════════════════════════════════════════════
// CHAMADAS AO PROVIDER PERSONALIZADO
// ═══════════════════════════════════════════════════════════

/**
 * Chama o provider personalizado do utilizador
 * @param {string} userId
 * @param {Array} messages - [{role, content}]
 * @param {Object} options - {maxTokens, temperature}
 * @returns {Object} {success, text, provider, model, tokens}
 */
async function callCustomProvider(userId, messages, options = {}) {
  const config = getUserProvider(userId);
  if (!config) return { success: false, error: 'Sem provider personalizado.' };

  const maxTokens = options.maxTokens || config.maxTokens || 4096;
  const temperature = options.temperature ?? 0.7;
  const model = options.model || config.model;

  try {
    let result;

    switch (config.format) {
      case 'openai':
        result = await callOpenAIFormat(config, messages, { model, maxTokens, temperature });
        break;
      case 'anthropic':
        result = await callAnthropicFormat(config, messages, { model, maxTokens, temperature });
        break;
      default:
        result = await callOpenAIFormat(config, messages, { model, maxTokens, temperature });
    }

    // Registar uso
    if (result.success) {
      const tokens = result.tokens?.total_tokens || result.tokens?.input_tokens + result.tokens?.output_tokens || 0;
      trackUsage(userId, tokens);
    }

    return result;

  } catch (error) {
    console.error(`❌ Custom Provider (${config.providerName}) falhou:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Chamada formato OpenAI-compatible (OpenAI, Mistral, DeepSeek, xAI, Cohere, OpenRouter, custom)
 */
async function callOpenAIFormat(config, messages, opts) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.apiKey}`
  };

  // OpenRouter precisa de headers extra
  if (config.providerId === 'openrouter') {
    headers['HTTP-Referer'] = 'https://myassistbot.app';
    headers['X-Title'] = 'MyAssistBOT';
  }

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: opts.model,
      messages,
      max_tokens: opts.maxTokens,
      temperature: opts.temperature,
      top_p: 0.9
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`${config.providerName} ${response.status}: ${errText.substring(0, 300)}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error(`${config.providerName}: resposta vazia`);

  return {
    success: true,
    text,
    provider: config.providerName,
    model: opts.model,
    tokens: data.usage || {},
    custom: true
  };
}

/**
 * Chamada formato Anthropic (Claude)
 */
async function callAnthropicFormat(config, messages, opts) {
  // Separar system message
  const systemMsg = messages.find(m => m.role === 'system')?.content || '';
  const chatMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role, content: m.content }));

  const response = await fetch(`${config.baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens,
      temperature: opts.temperature,
      system: systemMsg,
      messages: chatMessages
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic ${response.status}: ${errText.substring(0, 300)}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text;
  if (!text) throw new Error('Anthropic: resposta vazia');

  return {
    success: true,
    text,
    provider: 'Anthropic Claude',
    model: opts.model,
    tokens: data.usage || {},
    custom: true
  };
}

/**
 * Stream do provider personalizado
 */
async function streamCustomProvider(userId, messages, onToken, onDone, options = {}) {
  const config = getUserProvider(userId);
  if (!config) {
    onToken('⚠️ Sem provider personalizado configurado.');
    onDone('⚠️ Sem provider personalizado configurado.', {});
    return;
  }

  const maxTokens = options.maxTokens || config.maxTokens || 4096;
  const temperature = options.temperature ?? 0.7;
  const model = options.model || config.model;

  try {
    if (config.format === 'anthropic') {
      return await streamAnthropicFormat(config, messages, onToken, onDone, { model, maxTokens, temperature });
    }
    // Default: OpenAI-compatible stream
    return await streamOpenAIFormat(config, messages, onToken, onDone, { model, maxTokens, temperature });
  } catch (error) {
    console.error(`❌ Custom stream (${config.providerName}) falhou:`, error.message);
    // Fallback síncrono
    const result = await callCustomProvider(userId, messages, options);
    onToken(result.text || result.error);
    onDone(result.text || result.error, { provider: config.providerName });
  }
}

async function streamOpenAIFormat(config, messages, onToken, onDone, opts) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.apiKey}`
  };
  if (config.providerId === 'openrouter') {
    headers['HTTP-Referer'] = 'https://myassistbot.app';
    headers['X-Title'] = 'MyAssistBOT';
  }

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: opts.model,
      messages,
      max_tokens: opts.maxTokens,
      temperature: opts.temperature,
      stream: true
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`${config.providerName} stream ${response.status}: ${errText.substring(0, 200)}`);
  }

  let fullText = '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const payload = trimmed.slice(6);
      if (payload === '[DONE]') continue;

      try {
        const json = JSON.parse(payload);
        const token = json.choices?.[0]?.delta?.content;
        if (token) {
          fullText += token;
          onToken(token);
        }
      } catch {}
    }
  }

  trackUsage(config.userId || 'default', 0);
  onDone(fullText, { provider: config.providerName, model: opts.model, custom: true });
}

async function streamAnthropicFormat(config, messages, onToken, onDone, opts) {
  const systemMsg = messages.find(m => m.role === 'system')?.content || '';
  const chatMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role, content: m.content }));

  const response = await fetch(`${config.baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens,
      temperature: opts.temperature,
      system: systemMsg,
      messages: chatMessages,
      stream: true
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic stream ${response.status}: ${errText.substring(0, 200)}`);
  }

  let fullText = '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;

      try {
        const json = JSON.parse(trimmed.slice(6));
        if (json.type === 'content_block_delta' && json.delta?.text) {
          fullText += json.delta.text;
          onToken(json.delta.text);
        }
      } catch {}
    }
  }

  trackUsage(config.userId || 'default', 0);
  onDone(fullText, { provider: 'Anthropic Claude', model: opts.model, custom: true });
}

// ═══════════════════════════════════════════════════════════
// VALIDAÇÃO DE API KEY
// ═══════════════════════════════════════════════════════════

/**
 * Testa se uma API key é válida fazendo uma chamada mínima
 */
async function validateApiKey(providerId, apiKey, baseUrl) {
  const catalog = PROVIDER_CATALOG[providerId];
  if (!catalog) return { valid: false, error: 'Provider desconhecido.' };

  const testUrl = baseUrl || catalog.baseUrl;
  const model = catalog.defaultModel;

  try {
    const testMessages = [
      { role: 'user', content: 'Say OK' }
    ];

    let response;

    if (catalog.format === 'anthropic') {
      response = await fetch(`${testUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model,
          max_tokens: 10,
          messages: testMessages
        })
      });
    } else {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      };
      if (providerId === 'openrouter') {
        headers['HTTP-Referer'] = 'https://myassistbot.app';
      }

      response = await fetch(`${testUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages: testMessages,
          max_tokens: 10
        })
      });
    }

    if (response.ok) {
      return { valid: true, model };
    }

    const errText = await response.text();
    if (response.status === 401 || response.status === 403) {
      return { valid: false, error: 'API key inválida ou sem permissões.' };
    }
    if (response.status === 429) {
      // Rate limit mas key é válida
      return { valid: true, model, warning: 'Key válida mas rate limit atingido.' };
    }
    return { valid: false, error: `Erro ${response.status}: ${errText.substring(0, 150)}` };

  } catch (error) {
    return { valid: false, error: `Ligação falhou: ${error.message}` };
  }
}

// ═══════════════════════════════════════════════════════════
// INFORMAÇÕES E LISTAGENS
// ═══════════════════════════════════════════════════════════

/**
 * Lista todos os providers disponíveis no catálogo
 */
function listAvailableProviders() {
  return Object.entries(PROVIDER_CATALOG)
    .filter(([id]) => id !== 'custom')
    .map(([id, p]) => ({
      id,
      name: p.name,
      description: p.description,
      models: p.models,
      defaultModel: p.defaultModel,
      pricing: p.pricing,
      website: p.website,
      streaming: p.supportsStreaming,
      vision: p.supportsVision
    }));
}

/**
 * Obtém info do provider de um utilizador
 */
function getProviderInfo(userId) {
  const config = userProviders[userId];
  if (!config) return null;

  return {
    providerId: config.providerId,
    providerName: config.providerName,
    model: config.model,
    maskedKey: config.maskedKey,
    enabled: config.enabled,
    configuredAt: config.configuredAt,
    lastUsed: config.lastUsed,
    totalCalls: config.totalCalls || 0,
    totalTokens: config.totalTokens || 0,
    streaming: config.supportsStreaming,
    vision: config.supportsVision
  };
}

/**
 * Obtém o catálogo de um provider específico
 */
function getProviderCatalog(providerId) {
  return PROVIDER_CATALOG[providerId] || null;
}

/**
 * Verifica se um utilizador tem um provider personalizado ativo
 */
function hasCustomProvider(userId) {
  const config = userProviders[userId];
  return !!(config && config.enabled);
}

/**
 * Mensagem de boas-vindas/sugestão para configurar provider
 */
function getOnboardingMessage() {
  return `🔑 **Integra a tua IA Premium no MyAssistBOT!**

Tens uma subscrição de uma IA paga? Integra-a aqui para usares diretamente no bot!

📋 **Providers suportados:**
• **OpenAI** — GPT-4o, o1, o3
• **Anthropic** — Claude Sonnet 4, Opus
• **Mistral AI** — Mistral Large, Codestral
• **DeepSeek** — V3, R1 (ultra económico)
• **xAI** — Grok-3
• **Cohere** — Command R+
• **OpenRouter** — 100+ modelos com 1 key

💡 **Como configurar:**
   "configurar openai com sk-abc123..."
   "usar claude com a minha key sk-ant-..."
   "integrar deepseek key: sk-..."

🔄 O teu provider pago terá **prioridade** sobre o Groq gratuito.
   Se falhar, o Groq entra como backup automático!

📊 Para ver os providers: "listar providers"`;
}

// ═══════════════════════════════════════════════════════════
// PARSE DE TEXTO PARA CONFIGURAÇÃO
// ═══════════════════════════════════════════════════════════

/**
 * Extrai providerId e apiKey de uma mensagem do utilizador
 * Ex: "configurar openai com sk-abc123def456"
 *     "usar claude key sk-ant-abc123"
 *     "integrar deepseek sk-abc123"
 */
function parseSetupFromText(text) {
  // Normalizar
  const t = text.toLowerCase();

  // Identificar provider
  let providerId = null;
  const providerMap = {
    'openai': 'openai', 'gpt': 'openai', 'gpt-4': 'openai', 'gpt4': 'openai', 'chatgpt': 'openai',
    'anthropic': 'anthropic', 'claude': 'anthropic',
    'mistral': 'mistral', 'codestral': 'mistral',
    'deepseek': 'deepseek',
    'xai': 'xai', 'grok': 'xai',
    'cohere': 'cohere', 'command': 'cohere',
    'openrouter': 'openrouter'
  };

  for (const [keyword, id] of Object.entries(providerMap)) {
    if (t.includes(keyword)) {
      providerId = id;
      break;
    }
  }

  // Extrair API key (padrões comuns de keys)
  const keyPatterns = [
    /\b(sk-[a-zA-Z0-9_-]{20,})\b/,                          // OpenAI, DeepSeek
    /\b(sk-ant-[a-zA-Z0-9_-]{20,})\b/,                      // Anthropic
    /\b(sk-or-v1-[a-zA-Z0-9_-]{20,})\b/,                    // OpenRouter
    /\b(gsk_[a-zA-Z0-9_-]{20,})\b/,                         // Groq
    /\b(xai-[a-zA-Z0-9_-]{20,})\b/,                         // xAI
    /\b([a-zA-Z0-9]{32,})\b/,                               // Generic long key
    /(?:key|chave|api.?key)\s*[:\s=]+\s*["']?([^\s"']+)/i   // "key: xxx" pattern
  ];

  let apiKey = null;
  for (const pattern of keyPatterns) {
    const match = text.match(pattern);
    if (match) {
      apiKey = match[1];
      break;
    }
  }

  // Auto-detectar provider pela key se não identificado
  if (apiKey && !providerId) {
    if (apiKey.startsWith('sk-ant-')) providerId = 'anthropic';
    else if (apiKey.startsWith('sk-or-')) providerId = 'openrouter';
    else if (apiKey.startsWith('xai-')) providerId = 'xai';
    else if (apiKey.startsWith('sk-')) providerId = 'openai'; // Default sk- = OpenAI
  }

  // Extrair modelo (opcional)
  let model = null;
  const modelMatch = text.match(/modelo?\s+([^\s,]+)/i) ||
                     text.match(/model\s+([^\s,]+)/i);
  if (modelMatch) model = modelMatch[1];

  // Extrair baseUrl (para custom)
  let baseUrl = null;
  const urlMatch = text.match(/(https?:\/\/[^\s]+)/i);
  if (urlMatch && providerId === 'custom') baseUrl = urlMatch[1];

  return { providerId, apiKey, model, baseUrl };
}

// ═══════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════

module.exports = {
  init,
  setupProvider,
  removeProvider,
  getUserProvider,
  toggleProvider,
  setModel,
  callCustomProvider,
  streamCustomProvider,
  validateApiKey,
  listAvailableProviders,
  getProviderInfo,
  getProviderCatalog,
  hasCustomProvider,
  getOnboardingMessage,
  parseSetupFromText,
  trackUsage,
  PROVIDER_CATALOG
};
