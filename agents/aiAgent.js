/**
 * 🧠 AI Agent - Integração Multi-Provider via LLM Router
 * 
 * Usa o llmRouter para suportar Groq, Gemini, Cerebras, HuggingFace e Ollama
 * com fallback automático e streaming de respostas.
 */

require('dotenv').config();
const llmRouter = require('../orchestrator/llmRouter');

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const FALLBACK_MODEL = 'mixtral-8x7b-32768';

const DEFAULT_SYSTEM = `És o MyAssistBOT, um assistente IA pessoal inteligente e proativo.

PERSONALIDADE:
- Profissional mas amigável
- Proativo (antecipa necessidades)
- Respostas claras e concisas
- Português europeu nativo

CAPACIDADES:
- Responder perguntas
- Gerar código
- Criar documentos
- Executar tarefas
- Ajudar com problemas técnicos`;

/**
 * Verifica se pelo menos um provider de IA está disponível
 */
function isAvailable() {
  return llmRouter.isAvailable();
}

/**
 * Faz pergunta à IA (síncrono — retorna resposta completa)
 * @param {string} prompt - Mensagem do utilizador
 * @param {Array} history - Histórico de mensagens [{role, content}]
 * @param {Object} options - Opções adicionais
 */
async function askAI(prompt, history = [], options = {}) {
  if (!isAvailable()) {
    return '⚠️ IA não configurada. Adiciona pelo menos GROQ_API_KEY ao .env';
  }

  const maxTokens = options.maxTokens || 2048;
  const temperature = options.temperature || 0.7;
  const systemPrompt = options.system || DEFAULT_SYSTEM;

  // Construir mensagens
  const messages = [{ role: 'system', content: systemPrompt }];
  
  if (Array.isArray(history) && history.length > 0) {
    messages.push(...history.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    })));
  }
  
  messages.push({ role: 'user', content: prompt });

  try {
    const result = await llmRouter.chat(messages, {
      maxTokens,
      temperature,
      provider: options.provider,
      userId: options.userId
    });

    if (result.provider) {
      console.log(`  🧠 Resposta via ${result.provider} (${result.model || ''})`);
    }

    return result.text;
  } catch (err) {
    console.error('❌ Erro AI:', err.message);
    return `⚠️ Erro ao processar: ${err.message}`;
  }
}

/**
 * Faz pergunta à IA com streaming de tokens
 * @param {string} prompt - Mensagem do utilizador
 * @param {Array} history - Histórico [{role, content}]
 * @param {Function} onToken - Callback para cada token: (token) => void
 * @param {Object} options - Opções adicionais
 * @returns {Promise<string>} Texto completo da resposta
 */
async function askAIStream(prompt, history = [], onToken, options = {}) {
  if (!isAvailable()) {
    const msg = '⚠️ IA não configurada. Adiciona pelo menos GROQ_API_KEY ao .env';
    onToken(msg);
    return msg;
  }

  const maxTokens = options.maxTokens || 2048;
  const temperature = options.temperature || 0.7;
  const systemPrompt = options.system || DEFAULT_SYSTEM;

  const messages = [{ role: 'system', content: systemPrompt }];
  
  if (Array.isArray(history) && history.length > 0) {
    messages.push(...history.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    })));
  }
  
  messages.push({ role: 'user', content: prompt });

  return new Promise((resolve, reject) => {
    llmRouter.chatStream(
      messages,
      onToken,
      (fullText, metadata) => {
        if (metadata?.provider) {
          console.log(`  🧠 Stream via ${metadata.provider} (${metadata.model || ''})`);
        }
        resolve(fullText);
      },
      { maxTokens, temperature, provider: options.provider, userId: options.userId }
    ).catch(reject);
  });
}

/**
 * Gera conteúdo específico (para PDFs, documentos, etc.)
 */
async function generateContent(topic, type = 'documento') {
  const systemPrompt = `És um escritor profissional. Gera conteúdo de alta qualidade em português.
Formato: Texto estruturado com parágrafos claros.
Tipo de conteúdo: ${type}`;

  const prompt = `Cria um ${type} completo e detalhado sobre: ${topic}

Inclui:
- Introdução
- Desenvolvimento com múltiplas secções
- Conclusão

Escreve de forma profissional e informativa.`;

  return askAI(prompt, [], { 
    system: systemPrompt, 
    maxTokens: 4096,
    temperature: 0.8
  });
}

/**
 * Analisa intenção de uma mensagem
 */
async function analyzeIntent(message) {
  const prompt = `Analisa esta mensagem e identifica a intenção principal.

Mensagem: "${message}"

Responde APENAS com uma destas categorias:
- chat: Conversa geral ou pergunta
- create_pdf: Criar documento PDF
- create_note: Criar nota de texto
- run_code: Executar código JavaScript
- list_files: Listar ficheiros
- system_info: Informação do sistema
- help: Pedido de ajuda

Categoria:`;

  const response = await askAI(prompt, { maxTokens: 50, temperature: 0.1 });
  return response.trim().toLowerCase().replace(':', '');
}

module.exports = {
  askAI,
  askAIStream,
  generateContent,
  analyzeIntent,
  isAvailable,
  GROQ_MODEL,
  FALLBACK_MODEL
};
