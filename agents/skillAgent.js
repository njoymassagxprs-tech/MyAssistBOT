/**
 * 🎓 Skill Agent — Sistema de Comandos Personalizados
 * 
 * Permite ao utilizador ensinar novas skills ao bot:
 *   "quando eu disser 'deploy', faz git pull + npm install + pm2 restart"
 *   "cria um comando 'bom dia' que diz a previsão do tempo e as minhas tarefas"
 *   "ensina: 'status' → verifica o servidor e mostra as stats"
 * 
 * Funcionalidades:
 *   - Skills com um ou vários passos
 *   - Variáveis dinâmicas ({{input}}, {{hora}}, {{data}})
 *   - Skills partilháveis (export/import)
 *   - Categorias e tags
 */

const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════
//  CONSTANTES
// ═══════════════════════════════════════════════════════════

const DATA_DIR = path.join(__dirname, '..', 'user_data');
const SKILLS_FILE = path.join(DATA_DIR, 'custom_skills.json');

// Variáveis dinâmicas disponíveis nas skills
const VARIABLES = {
  '{{hora}}': () => new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
  '{{data}}': () => new Date().toLocaleDateString('pt-PT'),
  '{{dataHora}}': () => new Date().toLocaleString('pt-PT'),
  '{{dia}}': () => ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][new Date().getDay()],
  '{{mes}}': () => new Date().toLocaleDateString('pt-PT', { month: 'long' }),
  '{{user}}': () => process.env.USER || process.env.USERNAME || 'utilizador',
  '{{os}}': () => process.platform,
  '{{random}}': () => Math.floor(Math.random() * 100).toString(),
};

// ═══════════════════════════════════════════════════════════
//  ESTADO
// ═══════════════════════════════════════════════════════════

let skills = [];

// ═══════════════════════════════════════════════════════════
//  INICIALIZAÇÃO
// ═══════════════════════════════════════════════════════════

function init() {
  load();
  console.log(`[SkillAgent] 🎓 Carregadas ${skills.length} skills personalizadas`);
}

function load() {
  try {
    if (fs.existsSync(SKILLS_FILE)) {
      skills = JSON.parse(fs.readFileSync(SKILLS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('[SkillAgent] Erro ao carregar:', e.message);
    skills = [];
  }
}

function save() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(SKILLS_FILE, JSON.stringify(skills, null, 2), 'utf8');
  } catch (e) {
    console.error('[SkillAgent] Erro ao guardar:', e.message);
  }
}

// ═══════════════════════════════════════════════════════════
//  PARSING
// ═══════════════════════════════════════════════════════════

/**
 * Padrões para criar skills via linguagem natural
 */
function parseSkillCreation(text) {
  const patterns = [
    // "quando eu disser 'X', faz Y"
    /quando\s+(?:eu\s+)?diss?er\s+['"](.+?)['"]\s*[,.]?\s*(?:faz|executa|corre|mostra|diz)\s+(.+)/is,
    // "cria um comando 'X' que faz Y"
    /cri(?:a|ar)\s+(?:um\s+)?(?:comando|skill)\s+['"](.+?)['"]\s+que\s+(.+)/is,
    // "ensina: 'X' → Y"
    /ensin(?:a|ar):\s*['"](.+?)['"]\s*(?:→|->|=|que)\s*(.+)/is,
    // "adiciona skill 'X': Y"
    /adicion(?:a|ar)\s+skill\s+['"](.+?)['"]:?\s+(.+)/is,
    // "define 'X' como Y"
    /defin(?:e|ir)\s+['"](.+?)['"]\s+como\s+(.+)/is,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        trigger: match[1].trim().toLowerCase(),
        action: match[2].trim()
      };
    }
  }

  return null;
}

/**
 * Converte ação em passos executáveis
 * "pesquisa o tempo + resume as notas + diz bom dia" → [ {action}, {action}, {action} ]
 */
function parseSteps(actionText) {
  // Separar por +, "e depois", "depois", "e"
  const parts = actionText
    .split(/\s*(?:\+|e\s+depois|depois|then|and\s+then)\s*/i)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  return parts.map((part, i) => ({
    order: i + 1,
    command: part,
    type: detectStepType(part)
  }));
}

/**
 * Deteta o tipo de passo (qual agente irá executar)
 */
function detectStepType(command) {
  const lower = command.toLowerCase();

  if (/pesquisa|search|google|procura/i.test(lower)) return 'web_search';
  if (/diz|say|fala|responde|mensagem/i.test(lower)) return 'respond';
  if (/cria|gera|make|create|build/i.test(lower)) return 'create';
  if (/corre|run|executa|execute/i.test(lower)) return 'code';
  if (/ficheiro|file|nota|note|pdf/i.test(lower)) return 'file';
  if (/sistema|system|servidor|server|ssh/i.test(lower)) return 'system';
  if (/tempo|weather|previsão|clima/i.test(lower)) return 'web_search';

  return 'ai_chat'; // Fallback: pedir à IA
}

// ═══════════════════════════════════════════════════════════
//  CRUD DE SKILLS
// ═══════════════════════════════════════════════════════════

/**
 * Cria nova skill
 */
function createSkill(text, userId = 'default') {
  const parsed = parseSkillCreation(text);

  if (!parsed) {
    return {
      success: false,
      error: '❌ Não consegui interpretar a skill. Exemplos:\n' +
        '• "quando eu disser \'deploy\', faz git pull e depois npm install"\n' +
        '• "cria um comando \'bom dia\' que pesquisa o tempo e diz bom dia"\n' +
        '• "ensina: \'status\' → verifica o servidor e mostra as stats"'
    };
  }

  // Verificar se trigger já existe
  const existing = skills.find(s => s.trigger === parsed.trigger && s.userId === userId);
  if (existing) {
    // Atualizar skill existente
    existing.steps = parseSteps(parsed.action);
    existing.rawAction = parsed.action;
    existing.updatedAt = Date.now();
    save();

    return {
      success: true,
      message: `🎓 **Skill atualizada!**\n\n` +
        `🔑 **Trigger:** "${parsed.trigger}"\n` +
        `📋 **Passos:** ${existing.steps.length}\n` +
        formatSteps(existing.steps)
    };
  }

  const skill = {
    id: `skill_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    trigger: parsed.trigger,
    rawAction: parsed.action,
    steps: parseSteps(parsed.action),
    userId,
    enabled: true,
    category: 'custom',
    tags: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    useCount: 0
  };

  skills.push(skill);
  save();

  return {
    success: true,
    message: `🎓 **Nova skill criada!**\n\n` +
      `🔑 **Trigger:** "${skill.trigger}"\n` +
      `📋 **Passos:** ${skill.steps.length}\n` +
      formatSteps(skill.steps) +
      `\n\n💡 Agora basta escreveres **"${skill.trigger}"** para executar.`
  };
}

/**
 * Lista todas as skills
 */
function listSkills(userId = null) {
  const filtered = userId ? skills.filter(s => s.userId === userId) : skills;

  if (filtered.length === 0) {
    return '📭 **Nenhuma skill personalizada.**\n\n' +
      'Ensina-me dizendo:\n' +
      '• "quando eu disser \'deploy\', faz git pull + npm install"\n' +
      '• "cria um comando \'status\' que verifica o servidor"';
  }

  let msg = `🎓 **Skills Personalizadas (${filtered.length}):**\n\n`;
  filtered.forEach((s, i) => {
    const status = s.enabled ? '🟢' : '🔴';
    msg += `${status} **${i + 1}. "${s.trigger}"**\n`;
    msg += `   📋 ${s.rawAction}\n`;
    msg += `   📊 Usada ${s.useCount}x | 🆔 ${s.id}\n\n`;
  });

  return msg;
}

/**
 * Remove uma skill
 */
function deleteSkill(identifier, userId = 'default') {
  const idx = skills.findIndex(s =>
    (s.trigger === identifier.toLowerCase() || s.id === identifier) &&
    s.userId === userId
  );

  if (idx === -1) {
    const num = parseInt(identifier);
    const userSkills = skills.filter(s => s.userId === userId);
    if (num >= 1 && num <= userSkills.length) {
      const target = userSkills[num - 1];
      const mainIdx = skills.indexOf(target);
      if (mainIdx >= 0) {
        skills.splice(mainIdx, 1);
        save();
        return { success: true, message: `✅ Skill "${target.trigger}" removida.` };
      }
    }
    return { success: false, error: '❌ Skill não encontrada.' };
  }

  const removed = skills.splice(idx, 1)[0];
  save();
  return { success: true, message: `✅ Skill "${removed.trigger}" removida.` };
}

// ═══════════════════════════════════════════════════════════
//  EXECUÇÃO DE SKILLS
// ═══════════════════════════════════════════════════════════

/**
 * Verifica se uma mensagem corresponde a uma skill
 */
function matchSkill(message, userId = 'default') {
  const lower = message.toLowerCase().trim();

  return skills.find(s =>
    s.enabled &&
    s.userId === userId &&
    (lower === s.trigger || lower.startsWith(s.trigger + ' '))
  );
}

/**
 * Executa uma skill (retorna os comandos a serem processados pelo orchestrator)
 * @returns {Array} Lista de comandos a executar
 */
function executeSkill(skill, inputText = '') {
  skill.useCount++;
  save();

  // Extrair input extra (texto após o trigger)
  const extra = inputText.toLowerCase().replace(skill.trigger, '').trim();

  // Resolver variáveis nos passos
  const resolvedSteps = skill.steps.map(step => ({
    ...step,
    command: resolveVariables(step.command, extra)
  }));

  return {
    skillId: skill.id,
    trigger: skill.trigger,
    steps: resolvedSteps
  };
}

/**
 * Substitui variáveis dinâmicas no texto
 */
function resolveVariables(text, input = '') {
  let resolved = text;

  // Variáveis built-in
  for (const [varName, resolver] of Object.entries(VARIABLES)) {
    if (resolved.includes(varName)) {
      resolved = resolved.replace(new RegExp(varName.replace(/[{}]/g, '\\$&'), 'g'), resolver());
    }
  }

  // Variável de input do utilizador
  resolved = resolved.replace(/\{\{input\}\}/gi, input || '');

  return resolved;
}

// ═══════════════════════════════════════════════════════════
//  EXPORT/IMPORT
// ═══════════════════════════════════════════════════════════

/**
 * Exporta skills para partilhar
 */
function exportSkills(userId = 'default') {
  const userSkills = skills.filter(s => s.userId === userId);
  return {
    version: 1,
    count: userSkills.length,
    skills: userSkills.map(s => ({
      trigger: s.trigger,
      action: s.rawAction,
      category: s.category,
      tags: s.tags
    })),
    exportedAt: new Date().toISOString()
  };
}

/**
 * Importa skills
 */
function importSkills(data, userId = 'default') {
  if (!data || !data.skills || !Array.isArray(data.skills)) {
    return { success: false, error: '❌ Formato de importação inválido.' };
  }

  let imported = 0;
  for (const s of data.skills) {
    if (s.trigger && s.action) {
      const existing = skills.find(sk => sk.trigger === s.trigger && sk.userId === userId);
      if (!existing) {
        skills.push({
          id: `skill_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          trigger: s.trigger.toLowerCase(),
          rawAction: s.action,
          steps: parseSteps(s.action),
          userId,
          enabled: true,
          category: s.category || 'imported',
          tags: s.tags || [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          useCount: 0
        });
        imported++;
      }
    }
  }

  save();
  return { success: true, message: `✅ Importadas ${imported} skills (${data.skills.length - imported} já existiam).` };
}

// ═══════════════════════════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════════════════════════

function formatSteps(steps) {
  return steps.map(s =>
    `  ${s.order}. ${getStepIcon(s.type)} ${s.command}`
  ).join('\n');
}

function getStepIcon(type) {
  const icons = {
    web_search: '🔍',
    respond: '💬',
    create: '🏗️',
    code: '💻',
    file: '📄',
    system: '🖥️',
    ai_chat: '🧠'
  };
  return icons[type] || '▶️';
}

function getStats() {
  return {
    total: skills.length,
    active: skills.filter(s => s.enabled).length,
    totalUses: skills.reduce((sum, s) => sum + s.useCount, 0),
    mostUsed: skills.length > 0
      ? skills.sort((a, b) => b.useCount - a.useCount)[0]?.trigger
      : null
  };
}

// ═══════════════════════════════════════════════════════════
//  EXPORTS
// ═══════════════════════════════════════════════════════════

module.exports = {
  init,
  createSkill,
  listSkills,
  deleteSkill,
  matchSkill,
  executeSkill,
  exportSkills,
  importSkills,
  parseSkillCreation,
  getStats
};
