/**
 * 🧠 Smart Memory — Grafo de Conhecimento Pessoal
 * 
 * Sistema de memória inteligente que aprende sobre o utilizador:
 *   - Factos pessoais: "chamo-me Pedro", "trabalho em IT"
 *   - Preferências: "prefiro TypeScript", "gosto de café"
 *   - Contexto aprendido: extrai informação automaticamente das conversas
 *   - Pesquisa semântica: "o que sabes sobre mim?"
 * 
 * Diferencia-se de ChatGPT/Claude por ser persistente e pessoal.
 */

const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════
//  CONSTANTES
// ═══════════════════════════════════════════════════════════

const DATA_DIR = path.join(__dirname, '..', 'memory');
const MEMORY_FILE = path.join(DATA_DIR, 'smart_memory.json');

const CATEGORIES = {
  PERSONAL: 'personal',     // Nome, idade, localização
  PREFERENCE: 'preference', // Gostos, preferências
  SKILL: 'skill',           // Competências, conhecimentos
  WORK: 'work',             // Emprego, projetos
  CONTACT: 'contact',       // Contactos, pessoas
  HABIT: 'habit',           // Rotinas, hábitos
  NOTE: 'note',             // Notas e factos gerais
  CONTEXT: 'context'        // Contexto extraído automaticamente
};

// Padrões para extração automática de factos
const EXTRACTION_PATTERNS = [
  // Identificação pessoal
  { regex: /(?:chamo[- ]me|meu nome (?:é|e)|sou o|sou a|i'?m|my name is)\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)?)/i, category: 'personal', key: 'nome', extract: 1 },
  { regex: /(?:tenho|i(?:'m| am))\s+(\d{1,3})\s+anos/i, category: 'personal', key: 'idade', extract: 1 },
  { regex: /(?:moro|vivo|estou|sou de|live in|from)\s+(?:em|no|na|in)\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[a-zà-ú]+)*)/i, category: 'personal', key: 'localização', extract: 1 },

  // Trabalho
  { regex: /(?:trabalho|work)\s+(?:em|na|no|como|at|as|in)\s+(.{3,40})/i, category: 'work', key: 'trabalho', extract: 1 },
  { regex: /(?:sou|i(?:'m| am)(?: an?)?)\s+((?:programador|developer|designer|engenheiro|gestor|professor|médic|enfermeiro|advogad)\w*)/i, category: 'work', key: 'profissão', extract: 1 },

  // Preferências
  { regex: /(?:prefiro|prefer|gosto de|i like|i love|adoro)\s+(.{3,50})/i, category: 'preference', key: 'auto', extract: 1 },
  { regex: /(?:não gosto de|odeio|detesto|hate|don't like)\s+(.{3,50})/i, category: 'preference', key: 'auto', extract: 1, prefix: 'NÃO gosta de: ' },

  // Comandos explícitos de memória
  { regex: /(?:lembra[- ]te|remember|memoriza|guarda|anota)\s+(?:que|that|de que)\s+(.{5,200})/i, category: 'note', key: 'auto', extract: 1 },
  { regex: /(?:lembra[- ]te|remember|memoriza|guarda)\s+(?:d?o|d?a|d?os|d?as)?\s*(.{5,200})/i, category: 'note', key: 'auto', extract: 1 },
];

// ═══════════════════════════════════════════════════════════
//  ESTADO
// ═══════════════════════════════════════════════════════════

let memories = {
  facts: [],        // Lista de factos { id, category, key, value, source, confidence, createdAt, updatedAt }
  userProfile: {},  // Perfil compilado { nome, idade, localização, ... }
  metadata: {
    totalRecalls: 0,
    lastUpdated: null,
    version: 1
  }
};

// ═══════════════════════════════════════════════════════════
//  INICIALIZAÇÃO
// ═══════════════════════════════════════════════════════════

function init() {
  load();
  console.log(`[SmartMemory] 🧠 Carregados ${memories.facts.length} factos em memória`);
}

function load() {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      memories = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('[SmartMemory] Erro ao carregar:', e.message);
  }
}

function save() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    memories.metadata.lastUpdated = Date.now();
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(memories, null, 2), 'utf8');
  } catch (e) {
    console.error('[SmartMemory] Erro ao guardar:', e.message);
  }
}

// ═══════════════════════════════════════════════════════════
//  ADICIONAR FACTOS
// ═══════════════════════════════════════════════════════════

/**
 * Guarda um facto manualmente (comando explícito do utilizador)
 */
function remember(text, userId = 'default', source = 'explicit') {
  // Tentar extrair facto estruturado
  for (const pattern of EXTRACTION_PATTERNS) {
    const match = text.match(pattern.regex);
    if (match) {
      const value = (pattern.prefix || '') + match[pattern.extract].trim();
      const key = pattern.key === 'auto' ? generateKey(value) : pattern.key;

      return addFact(pattern.category, key, value, userId, source, 1.0);
    }
  }

  // Sem padrão reconhecido — guardar como nota genérica
  return addFact('note', generateKey(text), text, userId, source, 0.8);
}

/**
 * Adiciona facto ao grafo de conhecimento
 */
function addFact(category, key, value, userId = 'default', source = 'explicit', confidence = 0.8) {
  // Verificar se já existe facto com a mesma key
  const existing = memories.facts.find(f =>
    f.key === key && f.userId === userId && f.category === category
  );

  if (existing) {
    // Atualizar valor existente
    existing.value = value;
    existing.confidence = Math.max(existing.confidence, confidence);
    existing.updatedAt = Date.now();
    existing.updateCount = (existing.updateCount || 0) + 1;
  } else {
    memories.facts.push({
      id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      category,
      key,
      value,
      userId,
      source,
      confidence,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      updateCount: 0,
      recallCount: 0
    });
  }

  // Atualizar perfil compilado
  updateProfile(userId);
  save();

  return {
    success: true,
    message: `🧠 **Memorizado!**\n\n📝 ${value}\n📁 Categoria: ${getCategoryLabel(category)}\n🔑 Chave: ${key}`
  };
}

/**
 * Extrai factos automaticamente de uma mensagem do utilizador
 * Chamado silenciosamente durante conversas normais
 */
function extractFromConversation(text, userId = 'default') {
  const extracted = [];

  for (const pattern of EXTRACTION_PATTERNS) {
    const match = text.match(pattern.regex);
    if (match) {
      const value = (pattern.prefix || '') + match[pattern.extract].trim();
      const key = pattern.key === 'auto' ? generateKey(value) : pattern.key;

      // Verificar se o facto já existe com o mesmo valor
      const exists = memories.facts.find(f =>
        f.key === key && f.userId === userId && f.value === value
      );

      if (!exists) {
        addFact(pattern.category, key, value, userId, 'auto-extract', 0.6);
        extracted.push({ category: pattern.category, key, value });
      }
    }
  }

  return extracted;
}

// ═══════════════════════════════════════════════════════════
//  RECORDAR / PESQUISAR
// ═══════════════════════════════════════════════════════════

/**
 * Pesquisa na memória por factos relevantes
 */
function recall(query, userId = 'default') {
  const lower = query.toLowerCase();
  memories.metadata.totalRecalls++;

  // Pesquisa: "o que sabes sobre mim?" / "o que memorizaste?"
  if (/(?:o que sabes|what do you know|o que lembras|memorizaste|minha memória|my memory)/i.test(query)) {
    return getFullProfile(userId);
  }

  // Pesquisa por categoria
  for (const [catKey, catValue] of Object.entries(CATEGORIES)) {
    if (lower.includes(catValue) || lower.includes(catKey.toLowerCase())) {
      const facts = memories.facts.filter(f => f.category === catValue && f.userId === userId);
      if (facts.length > 0) {
        return formatFacts(facts, getCategoryLabel(catValue));
      }
    }
  }

  // Pesquisa por texto livre
  const results = memories.facts
    .filter(f => f.userId === userId)
    .map(f => ({
      ...f,
      score: calculateRelevance(f, lower)
    }))
    .filter(f => f.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  if (results.length === 0) {
    return null; // Sem resultados — o orchestrator usará resposta normal
  }

  // Atualizar recallCount
  results.forEach(r => {
    const fact = memories.facts.find(f => f.id === r.id);
    if (fact) fact.recallCount++;
  });
  save();

  return formatFacts(results, 'Resultados da memória');
}

/**
 * Obtém contexto de memória para enriquecer prompts
 * Usado pelo orchestrator para dar contexto pessoal às respostas da IA
 */
function getContextForPrompt(userId = 'default') {
  const userFacts = memories.facts.filter(f => f.userId === userId);

  if (userFacts.length === 0) return '';

  const profile = memories.userProfile[userId] || {};
  let context = 'Informação conhecida sobre o utilizador:\n';

  // Factos de alta confiança primeiro
  const relevant = userFacts
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 15);

  relevant.forEach(f => {
    context += `- [${getCategoryLabel(f.category)}] ${f.value}\n`;
  });

  return context;
}

/**
 * Calcula relevância de um facto para uma query
 */
function calculateRelevance(fact, query) {
  let score = 0;
  const factLower = (fact.value + ' ' + fact.key).toLowerCase();
  const queryWords = query.split(/\s+/).filter(w => w.length > 2);

  // Match exato
  if (factLower.includes(query)) score += 10;

  // Match por palavras
  for (const word of queryWords) {
    if (factLower.includes(word)) score += 3;
  }

  // Boost por confiança
  score *= fact.confidence;

  // Boost por recência
  const age = Date.now() - fact.updatedAt;
  if (age < 24 * 60 * 60 * 1000) score *= 1.5;       // Último dia
  else if (age < 7 * 24 * 60 * 60 * 1000) score *= 1.2; // Última semana

  return score;
}

// ═══════════════════════════════════════════════════════════
//  PERFIL DO UTILIZADOR
// ═══════════════════════════════════════════════════════════

/**
 * Compila perfil a partir dos factos
 */
function updateProfile(userId) {
  const userFacts = memories.facts.filter(f => f.userId === userId);
  const profile = {};

  userFacts.forEach(f => {
    if (f.category === 'personal' && f.key !== 'auto') {
      profile[f.key] = f.value;
    }
  });

  memories.userProfile[userId] = profile;
}

/**
 * Retorna perfil completo formatado
 */
function getFullProfile(userId = 'default') {
  const userFacts = memories.facts.filter(f => f.userId === userId);

  if (userFacts.length === 0) {
    return '🧠 **Ainda não sei nada sobre ti.**\n\n' +
      'Podes ensinar-me dizendo coisas como:\n' +
      '- "Chamo-me Pedro"\n' +
      '- "Trabalho como programador"\n' +
      '- "Lembra-te que prefiro código em TypeScript"\n' +
      '- "Memoriza: reunião com o cliente dia 20"';
  }

  let msg = '🧠 **O que sei sobre ti:**\n\n';

  // Agrupar por categoria
  const grouped = {};
  userFacts.forEach(f => {
    if (!grouped[f.category]) grouped[f.category] = [];
    grouped[f.category].push(f);
  });

  for (const [cat, facts] of Object.entries(grouped)) {
    const label = getCategoryLabel(cat);
    msg += `**${label}:**\n`;
    facts.forEach(f => {
      const confidence = f.confidence >= 0.8 ? '' : ' *(incerto)*';
      msg += `  • ${f.value}${confidence}\n`;
    });
    msg += '\n';
  }

  msg += `\n📊 **Estatísticas:** ${userFacts.length} factos | ${memories.metadata.totalRecalls} consultas`;

  return msg;
}

// ═══════════════════════════════════════════════════════════
//  GESTÃO DE MEMÓRIA
// ═══════════════════════════════════════════════════════════

/**
 * Esquece um facto específico
 */
function forget(query, userId = 'default') {
  const lower = query.toLowerCase();

  // Esquecer tudo
  if (/tudo|everything|all/i.test(query)) {
    const count = memories.facts.filter(f => f.userId === userId).length;
    memories.facts = memories.facts.filter(f => f.userId !== userId);
    delete memories.userProfile[userId];
    save();
    return { success: true, message: `🗑️ Esquecidos ${count} factos. Memória limpa.` };
  }

  // Esquecer facto específico
  const idx = memories.facts.findIndex(f =>
    f.userId === userId &&
    (f.value.toLowerCase().includes(lower) || f.key.toLowerCase().includes(lower))
  );

  if (idx === -1) {
    return { success: false, error: '❌ Não encontrei esse facto na memória.' };
  }

  const removed = memories.facts.splice(idx, 1)[0];
  updateProfile(userId);
  save();

  return { success: true, message: `🗑️ Esquecido: "${removed.value}"` };
}

/**
 * Exporta memória do utilizador
 */
function exportMemory(userId = 'default') {
  const userFacts = memories.facts.filter(f => f.userId === userId);
  return {
    profile: memories.userProfile[userId] || {},
    facts: userFacts,
    exportedAt: new Date().toISOString()
  };
}

// ═══════════════════════════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════════════════════════

function generateKey(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\sà-ú]/g, '')
    .split(/\s+/)
    .slice(0, 4)
    .join('_');
}

function getCategoryLabel(category) {
  const labels = {
    personal: '👤 Pessoal',
    preference: '💡 Preferência',
    skill: '🎯 Competência',
    work: '💼 Trabalho',
    contact: '📇 Contacto',
    habit: '🔄 Hábito',
    note: '📝 Nota',
    context: '🔍 Contexto'
  };
  return labels[category] || '📌 Outro';
}

function formatFacts(facts, title = 'Memória') {
  let msg = `🧠 **${title}:**\n\n`;
  facts.forEach(f => {
    const cat = getCategoryLabel(f.category);
    msg += `• ${cat} — ${f.value}\n`;
  });
  return msg;
}

function getStats() {
  return {
    totalFacts: memories.facts.length,
    categories: Object.fromEntries(
      Object.values(CATEGORIES).map(cat => [
        cat, memories.facts.filter(f => f.category === cat).length
      ])
    ),
    totalRecalls: memories.metadata.totalRecalls,
    users: [...new Set(memories.facts.map(f => f.userId))].length
  };
}

// ═══════════════════════════════════════════════════════════
//  EXPORTS
// ═══════════════════════════════════════════════════════════

module.exports = {
  init,
  remember,
  recall,
  forget,
  addFact,
  extractFromConversation,
  getContextForPrompt,
  getFullProfile,
  exportMemory,
  getStats,
  CATEGORIES
};
