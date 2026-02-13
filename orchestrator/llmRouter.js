/**
 * 🔀 LLM Router — Multi-Provider com Fallback Automático e Streaming
 * 
 * Abstrai múltiplos providers de IA (Groq, Gemini, Cerebras, HuggingFace, Ollama)
 * com fallback automático em cadeia. Se um provider falha → tenta o seguinte.
 * 
 * Suporta streaming (SSE/callback) e chamada síncrona.
 * 
 * Cadeia de prioridade:
 *   1. Groq     (LLaMA 3.3 70B)      — rápido, grátis, 30 req/min
 *   2. Cerebras (LLaMA 3.3 70B)      — ultra-rápido, grátis
 *   3. Gemini   (Gemini 2.0 Flash)   — grátis, suporta visão
 *   4. HuggingFace (Mistral/Zephyr)  — grátis, rate limitado
 *   5. Ollama   (local)              — offline, sem limites
 */

require('dotenv').config();
const customProvider = require('../agents/customProvider');

// ═══════════════════════════════════════════════════════════
// CONFIGURAÇÃO DOS PROVIDERS
// ═══════════════════════════════════════════════════════════

const PROVIDERS = {
  groq: {
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    keyEnv: 'GROQ_API_KEY',
    model: 'llama-3.3-70b-versatile',
    fallbackModel: 'mixtral-8x7b-32768',
    maxTokens: 4096,
    supportsStreaming: true,
    supportsVision: false,
    format: 'openai' // OpenAI-compatible API
  },
  cerebras: {
    name: 'Cerebras',
    baseUrl: 'https://api.cerebras.ai/v1',
    keyEnv: 'CEREBRAS_API_KEY',
    model: 'llama-3.3-70b',
    fallbackModel: 'llama-3.1-8b',
    maxTokens: 4096,
    supportsStreaming: true,
    supportsVision: false,
    format: 'openai'
  },
  gemini: {
    name: 'Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    keyEnv: 'GEMINI_API_KEY',
    model: 'gemini-2.0-flash',
    fallbackModel: 'gemini-1.5-flash',
    maxTokens: 4096,
    supportsStreaming: true,
    supportsVision: true,
    format: 'gemini'
  },
  huggingface: {
    name: 'HuggingFace',
    baseUrl: 'https://api-inference.huggingface.co/models',
    keyEnv: 'HF_API_KEY',
    model: 'mistralai/Mistral-7B-Instruct-v0.3',
    fallbackModel: 'HuggingFaceH4/zephyr-7b-beta',
    maxTokens: 2048,
    supportsStreaming: false,
    supportsVision: false,
    format: 'huggingface'
  },
  ollama: {
    name: 'Ollama',
    baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
    keyEnv: null, // local, sem key
    model: process.env.OLLAMA_MODEL || 'llama3.1',
    fallbackModel: 'mistral',
    maxTokens: 4096,
    supportsStreaming: true,
    supportsVision: false,
    format: 'ollama'
  }
};

// Keep-alive para performance
let dispatcher;
try {
  const { Agent } = require('undici');
  dispatcher = new Agent({
    keepAliveTimeout: 30000,
    keepAliveMaxTimeout: 60000,
    connections: 10
  });
} catch (e) {
  dispatcher = undefined;
}

// ═══════════════════════════════════════════════════════════
// ESTADO DO ROUTER
// ═══════════════════════════════════════════════════════════

// Providers que falharam recentemente (cooldown de 60s)
const providerCooldowns = new Map();
const COOLDOWN_MS = 60000;

/**
 * Retorna a lista ordenada de providers disponíveis (com API key configurada)
 */
function getAvailableProviders() {
  const order = (process.env.LLM_PROVIDER_ORDER || 'groq,cerebras,gemini,huggingface,ollama').split(',').map(s => s.trim());
  
  return order.filter(name => {
    const provider = PROVIDERS[name];
    if (!provider) return false;
    
    // Ollama não precisa de key
    if (name === 'ollama') return true;
    
    // Verificar se tem key configurada
    return !!process.env[provider.keyEnv];
  }).map(name => ({ id: name, ...PROVIDERS[name] }));
}

/**
 * Verifica se um provider está em cooldown
 */
function isInCooldown(providerId) {
  const cooldownEnd = providerCooldowns.get(providerId);
  if (!cooldownEnd) return false;
  if (Date.now() > cooldownEnd) {
    providerCooldowns.delete(providerId);
    return false;
  }
  return true;
}

/**
 * Marca um provider como em cooldown
 */
function setCooldown(providerId) {
  providerCooldowns.set(providerId, Date.now() + COOLDOWN_MS);
}

// ═══════════════════════════════════════════════════════════
// CHAMADA PRINCIPAL (SEM STREAMING)
// ═══════════════════════════════════════════════════════════

/**
 * Envia mensagem para LLM com fallback automático entre providers
 * @param {Array} messages - [{role: 'system'|'user'|'assistant', content: string}]
 * @param {Object} options - {maxTokens, temperature, model, provider, userId}
 * @returns {Object} {text, provider, model, tokens}
 */
async function chat(messages, options = {}) {
  // ══ PRIORIDADE 0: Provider personalizado do utilizador (IA paga) ══
  if (options.userId && customProvider.hasCustomProvider(options.userId)) {
    try {
      const customResult = await customProvider.callCustomProvider(options.userId, messages, options);
      if (customResult.success) {
        console.log(`  🔑 Resposta via provider personalizado: ${customResult.provider} (${customResult.model})`);
        return customResult;
      }
      console.warn(`  ⚠️ Provider personalizado falhou, a usar fallback Groq...`);
    } catch (e) {
      console.warn(`  ⚠️ Provider personalizado erro: ${e.message}, fallback Groq...`);
    }
  }

  const providers = getAvailableProviders();
  
  if (providers.length === 0) {
    return { text: '⚠️ Nenhum provider de IA configurado. Adiciona pelo menos GROQ_API_KEY ao .env', provider: null };
  }

  // Se forçou provider específico
  if (options.provider && PROVIDERS[options.provider]) {
    const result = await callProvider(options.provider, messages, options);
    if (result.success) return result;
    // Se falhou, continua para fallback
  }

  // Tentar cada provider na ordem (Groq → Cerebras → Gemini → ...)
  for (const provider of providers) {
    if (isInCooldown(provider.id)) {
      console.log(`  ⏳ ${provider.name} em cooldown, a saltar...`);
      continue;
    }

    try {
      const result = await callProvider(provider.id, messages, options);
      if (result.success) return result;
    } catch (error) {
      console.error(`  ❌ ${provider.name} falhou: ${error.message}`);
      setCooldown(provider.id);
    }
  }

  return { text: '⚠️ Todos os providers de IA falharam. Tenta novamente em 1 minuto.', provider: null, success: false };
}

/**
 * Chama um provider específico
 */
async function callProvider(providerId, messages, options = {}) {
  const provider = PROVIDERS[providerId];
  if (!provider) throw new Error(`Provider desconhecido: ${providerId}`);

  const apiKey = provider.keyEnv ? process.env[provider.keyEnv] : null;
  if (provider.keyEnv && !apiKey) throw new Error(`${provider.name}: API key não configurada`);

  const model = options.model || provider.model;
  const maxTokens = options.maxTokens || provider.maxTokens;
  const temperature = options.temperature ?? 0.7;

  switch (provider.format) {
    case 'openai':
      return await callOpenAICompatible(provider, apiKey, messages, { model, maxTokens, temperature });
    case 'gemini':
      return await callGemini(provider, apiKey, messages, { model, maxTokens, temperature });
    case 'huggingface':
      return await callHuggingFace(provider, apiKey, messages, { model, maxTokens, temperature });
    case 'ollama':
      return await callOllama(provider, messages, { model, maxTokens, temperature });
    default:
      throw new Error(`Formato desconhecido: ${provider.format}`);
  }
}

// ═══════════════════════════════════════════════════════════
// STREAMING
// ═══════════════════════════════════════════════════════════

/**
 * Envia mensagem com streaming de tokens
 * @param {Array} messages - [{role, content}]
 * @param {Function} onToken - Callback chamado para cada token: (token: string) => void
 * @param {Function} onDone - Callback quando termina: (fullText: string, metadata: Object) => void
 * @param {Object} options - {maxTokens, temperature, provider, userId}
 */
async function chatStream(messages, onToken, onDone, options = {}) {
  // ══ PRIORIDADE 0: Stream via provider personalizado (IA paga) ══
  if (options.userId && customProvider.hasCustomProvider(options.userId)) {
    try {
      const config = customProvider.getUserProvider(options.userId);
      if (config && config.supportsStreaming) {
        console.log(`  🔑 Streaming via provider personalizado: ${config.providerName}`);
        return await customProvider.streamCustomProvider(options.userId, messages, onToken, onDone, options);
      }
    } catch (e) {
      console.warn(`  ⚠️ Custom stream falhou: ${e.message}, fallback...`);
    }
  }

  const providers = getAvailableProviders().filter(p => p.supportsStreaming);
  
  if (providers.length === 0) {
    const fallback = await chat(messages, options);
    onToken(fallback.text);
    onDone(fallback.text, fallback);
    return;
  }

  // Se forçou provider
  if (options.provider && PROVIDERS[options.provider]?.supportsStreaming) {
    try {
      return await streamFromProvider(options.provider, messages, onToken, onDone, options);
    } catch (e) {
      console.error(`  ❌ Stream ${options.provider} falhou: ${e.message}`);
    }
  }

  // Tentar cada provider
  for (const provider of providers) {
    if (isInCooldown(provider.id)) continue;
    
    try {
      return await streamFromProvider(provider.id, messages, onToken, onDone, options);
    } catch (error) {
      console.error(`  ❌ Stream ${provider.name} falhou: ${error.message}`);
      setCooldown(provider.id);
    }
  }

  // Nenhum streaming disponível — fallback síncrono
  const fallback = await chat(messages, options);
  onToken(fallback.text);
  onDone(fallback.text, fallback);
}

/**
 * Stream de um provider específico
 */
async function streamFromProvider(providerId, messages, onToken, onDone, options = {}) {
  const provider = PROVIDERS[providerId];
  const apiKey = provider.keyEnv ? process.env[provider.keyEnv] : null;
  const model = options.model || provider.model;
  const maxTokens = options.maxTokens || provider.maxTokens;
  const temperature = options.temperature ?? 0.7;

  switch (provider.format) {
    case 'openai':
      return await streamOpenAICompatible(provider, providerId, apiKey, messages, onToken, onDone, { model, maxTokens, temperature });
    case 'gemini':
      return await streamGemini(provider, providerId, apiKey, messages, onToken, onDone, { model, maxTokens, temperature });
    case 'ollama':
      return await streamOllama(provider, providerId, messages, onToken, onDone, { model, maxTokens, temperature });
    default:
      throw new Error(`Streaming não suportado: ${provider.format}`);
  }
}

// ═══════════════════════════════════════════════════════════
// IMPLEMENTAÇÃO POR FORMATO — SYNC
// ═══════════════════════════════════════════════════════════

async function callOpenAICompatible(provider, apiKey, messages, opts) {
  const fetchOpts = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Connection': 'keep-alive'
    },
    body: JSON.stringify({
      model: opts.model,
      messages,
      max_tokens: opts.maxTokens,
      temperature: opts.temperature,
      top_p: 0.9
    })
  };
  if (dispatcher) fetchOpts.dispatcher = dispatcher;

  const response = await fetch(`${provider.baseUrl}/chat/completions`, fetchOpts);
  
  if (!response.ok) {
    const errText = await response.text();
    if (response.status === 429) {
      // Rate limit — tentar fallback model
      if (opts.model !== provider.fallbackModel) {
        console.warn(`  ⚠️ ${provider.name} rate limit, tentando ${provider.fallbackModel}...`);
        return callOpenAICompatible(provider, apiKey, messages, { ...opts, model: provider.fallbackModel });
      }
      setCooldown(provider.id);
    }
    throw new Error(`${provider.name} ${response.status}: ${errText.substring(0, 200)}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error(`${provider.name}: resposta vazia`);
  
  return {
    success: true,
    text,
    provider: provider.name,
    model: opts.model,
    tokens: data.usage || {}
  };
}

async function callGemini(provider, apiKey, messages, opts) {
  // Converter formato OpenAI → Gemini
  const systemInstruction = messages.find(m => m.role === 'system')?.content;
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

  const body = {
    contents,
    generationConfig: {
      maxOutputTokens: opts.maxTokens,
      temperature: opts.temperature,
      topP: 0.9
    }
  };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const url = `${provider.baseUrl}/models/${opts.model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text();
    if (response.status === 429 && opts.model !== provider.fallbackModel) {
      return callGemini(provider, apiKey, messages, { ...opts, model: provider.fallbackModel });
    }
    throw new Error(`Gemini ${response.status}: ${errText.substring(0, 200)}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini: resposta vazia');

  return {
    success: true,
    text,
    provider: 'Gemini',
    model: opts.model,
    tokens: data.usageMetadata || {}
  };
}

async function callHuggingFace(provider, apiKey, messages, opts) {
  // Converter para formato text-generation
  const prompt = messages.map(m => {
    if (m.role === 'system') return `<|system|>\n${m.content}</s>`;
    if (m.role === 'user') return `<|user|>\n${m.content}</s>`;
    return `<|assistant|>\n${m.content}</s>`;
  }).join('\n') + '\n<|assistant|>\n';

  const url = `${provider.baseUrl}/${opts.model}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        max_new_tokens: opts.maxTokens,
        temperature: opts.temperature,
        return_full_text: false
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    if (response.status === 429 && opts.model !== provider.fallbackModel) {
      return callHuggingFace(provider, apiKey, messages, { ...opts, model: provider.fallbackModel });
    }
    throw new Error(`HuggingFace ${response.status}: ${errText.substring(0, 200)}`);
  }

  const data = await response.json();
  const text = Array.isArray(data) ? data[0]?.generated_text : data?.generated_text;
  if (!text) throw new Error('HuggingFace: resposta vazia');

  return { success: true, text: text.trim(), provider: 'HuggingFace', model: opts.model, tokens: {} };
}

async function callOllama(provider, messages, opts) {
  const url = `${provider.baseUrl}/api/chat`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: opts.model,
      messages,
      stream: false,
      options: {
        num_predict: opts.maxTokens,
        temperature: opts.temperature
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    if (opts.model !== provider.fallbackModel) {
      return callOllama(provider, messages, { ...opts, model: provider.fallbackModel });
    }
    throw new Error(`Ollama ${response.status}: ${errText.substring(0, 200)}`);
  }

  const data = await response.json();
  const text = data.message?.content;
  if (!text) throw new Error('Ollama: resposta vazia');

  return { success: true, text, provider: 'Ollama', model: opts.model, tokens: {} };
}

// ═══════════════════════════════════════════════════════════
// IMPLEMENTAÇÃO POR FORMATO — STREAMING
// ═══════════════════════════════════════════════════════════

async function streamOpenAICompatible(provider, providerId, apiKey, messages, onToken, onDone, opts) {
  const fetchOpts = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Connection': 'keep-alive'
    },
    body: JSON.stringify({
      model: opts.model,
      messages,
      max_tokens: opts.maxTokens,
      temperature: opts.temperature,
      stream: true
    })
  };
  if (dispatcher) fetchOpts.dispatcher = dispatcher;

  const response = await fetch(`${provider.baseUrl}/chat/completions`, fetchOpts);
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`${provider.name} stream ${response.status}: ${errText.substring(0, 200)}`);
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

  onDone(fullText, { provider: provider.name, model: opts.model });
}

async function streamGemini(provider, providerId, apiKey, messages, onToken, onDone, opts) {
  const systemInstruction = messages.find(m => m.role === 'system')?.content;
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

  const body = {
    contents,
    generationConfig: {
      maxOutputTokens: opts.maxTokens,
      temperature: opts.temperature
    }
  };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const url = `${provider.baseUrl}/models/${opts.model}:streamGenerateContent?alt=sse&key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini stream ${response.status}: ${errText.substring(0, 200)}`);
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
        const token = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (token) {
          fullText += token;
          onToken(token);
        }
      } catch {}
    }
  }

  onDone(fullText, { provider: 'Gemini', model: opts.model });
}

async function streamOllama(provider, providerId, messages, onToken, onDone, opts) {
  const url = `${provider.baseUrl}/api/chat`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: opts.model,
      messages,
      stream: true,
      options: {
        num_predict: opts.maxTokens,
        temperature: opts.temperature
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Ollama stream ${response.status}: ${errText.substring(0, 200)}`);
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
      if (!line.trim()) continue;
      try {
        const json = JSON.parse(line);
        const token = json.message?.content;
        if (token) {
          fullText += token;
          onToken(token);
        }
      } catch {}
    }
  }

  onDone(fullText, { provider: 'Ollama', model: opts.model });
}

// ═══════════════════════════════════════════════════════════
// UTILITÁRIOS
// ═══════════════════════════════════════════════════════════

/**
 * Lista o estado de todos os providers
 */
function getProvidersStatus() {
  return Object.entries(PROVIDERS).map(([id, p]) => {
    const hasKey = p.keyEnv ? !!process.env[p.keyEnv] : true;
    const inCooldown = isInCooldown(id);
    return {
      id,
      name: p.name,
      configured: hasKey,
      available: hasKey && !inCooldown,
      inCooldown,
      model: p.model,
      streaming: p.supportsStreaming,
      vision: p.supportsVision
    };
  });
}

/**
 * Provider principal ativo
 */
function getActiveProvider() {
  const available = getAvailableProviders();
  return available.find(p => !isInCooldown(p.id)) || available[0] || null;
}

/**
 * Verifica se pelo menos um provider está disponível
 */
function isAvailable() {
  return getAvailableProviders().length > 0;
}

module.exports = {
  chat,
  chatStream,
  getProvidersStatus,
  getActiveProvider,
  getAvailableProviders,
  isAvailable,
  PROVIDERS
};
