/**
 * 📋 Workflow Agent — Templates de Workflows Prontos
 * 
 * Workflows pré-feitos que o utilizador instala e personaliza.
 * Como "receitas" para automatizar fluxos de trabalho comuns.
 * 
 * Workflows Built-in:
 *   - Rotina Matinal (tempo + notícias + tarefas do dia)
 *   - Code Review (lint + tests + resumo de mudanças)
 *   - Deploy (git pull + tests + restart)
 *   - Meeting Prep (agenda + notas + participantes)
 *   - Report Semanal (stats + resumo + export)
 * 
 * Funcionalidades:
 *   - Executar workflows com um comando
 *   - Criar workflows personalizados
 *   - Variáveis e parâmetros personalizáveis
 *   - Histórico de execuções
 */

const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════
//  CONSTANTES
// ═══════════════════════════════════════════════════════════

const DATA_DIR = path.join(__dirname, '..', 'user_data');
const WORKFLOWS_FILE = path.join(DATA_DIR, 'workflows.json');

// ═══════════════════════════════════════════════════════════
//  WORKFLOWS BUILT-IN (Templates)
// ═══════════════════════════════════════════════════════════

const BUILTIN_WORKFLOWS = [
  {
    id: 'morning-routine',
    name: '🌅 Rotina Matinal',
    description: 'Começa o dia com previsão do tempo, notícias e tarefas pendentes',
    category: 'produtividade',
    steps: [
      { order: 1, command: 'que tempo faz hoje?', type: 'web_search', label: 'Previsão do tempo' },
      { order: 2, command: 'resume as últimas notícias de tecnologia', type: 'web_search', label: 'Notícias tech' },
      { order: 3, command: 'lista as minhas tarefas agendadas', type: 'automation', label: 'Tarefas do dia' },
      { order: 4, command: 'o que sabes sobre mim?', type: 'memory', label: 'Resumo pessoal' }
    ],
    tags: ['rotina', 'manhã', 'produtividade']
  },
  {
    id: 'code-review',
    name: '🔍 Code Review',
    description: 'Analisa o código atual: lint, erros, sugestões de melhoria',
    category: 'desenvolvimento',
    steps: [
      { order: 1, command: 'lista os ficheiros alterados recentemente na pasta atual', type: 'file', label: 'Ficheiros alterados' },
      { order: 2, command: 'analisa o código e identifica possíveis bugs ou melhorias', type: 'ai_chat', label: 'Análise de qualidade' },
      { order: 3, command: 'gera um resumo das alterações feitas', type: 'ai_chat', label: 'Resumo de mudanças' }
    ],
    tags: ['código', 'review', 'qualidade']
  },
  {
    id: 'deploy-check',
    name: '🚀 Deploy Check',
    description: 'Verifica se o sistema está pronto para deploy',
    category: 'operações',
    steps: [
      { order: 1, command: 'sistema status', type: 'system', label: 'Estado do sistema' },
      { order: 2, command: 'verifica o espaço em disco', type: 'system', label: 'Espaço em disco' },
      { order: 3, command: 'mostra os processos ativos', type: 'system', label: 'Processos' },
      { order: 4, command: 'verifica a memória disponível', type: 'system', label: 'Memória' }
    ],
    tags: ['deploy', 'infraestrutura', 'ops']
  },
  {
    id: 'weekly-report',
    name: '📊 Relatório Semanal',
    description: 'Gera um relatório semanal de atividade e produtividade',
    category: 'produtividade',
    steps: [
      { order: 1, command: 'mostra o histórico de automações desta semana', type: 'automation', label: 'Automações executadas' },
      { order: 2, command: 'quais skills usei esta semana?', type: 'skill', label: 'Skills usadas' },
      { order: 3, command: 'resume as minhas notas desta semana', type: 'file', label: 'Notas da semana' },
      { order: 4, command: 'gera um relatório semanal de produtividade baseado nestas informações', type: 'ai_chat', label: 'Relatório compilado' }
    ],
    tags: ['relatório', 'semanal', 'produtividade']
  },
  {
    id: 'server-health',
    name: '🏥 Server Health',
    description: 'Health check completo do servidor',
    category: 'operações',
    steps: [
      { order: 1, command: 'sistema info', type: 'system', label: 'Info do sistema' },
      { order: 2, command: 'uso de CPU', type: 'system', label: 'CPU' },
      { order: 3, command: 'uso de memória', type: 'system', label: 'RAM' },
      { order: 4, command: 'espaço em disco', type: 'system', label: 'Disco' },
      { order: 5, command: 'mostra os alertas recentes', type: 'alert', label: 'Alertas' }
    ],
    tags: ['servidor', 'health', 'monitorização']
  },
  {
    id: 'research',
    name: '🔬 Pesquisa Rápida',
    description: 'Pesquisa completa sobre um tópico com múltiplas fontes',
    category: 'pesquisa',
    steps: [
      { order: 1, command: 'pesquisa na web: {{input}}', type: 'web_search', label: 'Pesquisa web' },
      { order: 2, command: 'resume o que encontraste sobre {{input}}', type: 'ai_chat', label: 'Resumo' },
      { order: 3, command: 'cria uma nota com o resumo da pesquisa sobre {{input}}', type: 'file', label: 'Guardar nota' }
    ],
    tags: ['pesquisa', 'research', 'aprendizagem'],
    requiresInput: true,
    inputPrompt: 'Sobre que tópico queres pesquisar?'
  }
];

// ═══════════════════════════════════════════════════════════
//  ESTADO
// ═══════════════════════════════════════════════════════════

let customWorkflows = [];

// ═══════════════════════════════════════════════════════════
//  INICIALIZAÇÃO
// ═══════════════════════════════════════════════════════════

function init() {
  loadCustom();
  console.log(`[WorkflowAgent] 📋 ${BUILTIN_WORKFLOWS.length} built-in + ${customWorkflows.length} custom workflows`);
}

function loadCustom() {
  try {
    if (fs.existsSync(WORKFLOWS_FILE)) {
      customWorkflows = JSON.parse(fs.readFileSync(WORKFLOWS_FILE, 'utf8'));
    }
  } catch (e) {
    customWorkflows = [];
  }
}

function saveCustom() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(WORKFLOWS_FILE, JSON.stringify(customWorkflows, null, 2), 'utf8');
  } catch (e) {
    console.error('[WorkflowAgent] Erro ao guardar:', e.message);
  }
}

// ═══════════════════════════════════════════════════════════
//  LISTAR WORKFLOWS
// ═══════════════════════════════════════════════════════════

function listWorkflows(category = null) {
  const all = [...BUILTIN_WORKFLOWS, ...customWorkflows];
  const filtered = category
    ? all.filter(w => w.category === category)
    : all;

  if (filtered.length === 0) {
    return '📭 Nenhum workflow encontrado.';
  }

  let msg = `📋 **Workflows Disponíveis (${filtered.length}):**\n\n`;

  // Agrupar por categoria
  const grouped = {};
  filtered.forEach(w => {
    const cat = w.category || 'geral';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(w);
  });

  for (const [cat, workflows] of Object.entries(grouped)) {
    msg += `**${capitalize(cat)}:**\n`;
    workflows.forEach(w => {
      const custom = w.userId ? ' *(custom)*' : '';
      msg += `  • **${w.name}**${custom} — ${w.description}\n`;
      msg += `    💬 Diz: "executa workflow ${w.id}" ou "workflow ${w.name.replace(/[^\w\s]/g, '').trim()}"\n`;
    });
    msg += '\n';
  }

  return msg;
}

// ═══════════════════════════════════════════════════════════
//  ENCONTRAR WORKFLOW
// ═══════════════════════════════════════════════════════════

/**
 * Encontra workflow por nome, ID ou keywords
 */
function findWorkflow(query) {
  const lower = query.toLowerCase().trim();
  const all = [...BUILTIN_WORKFLOWS, ...customWorkflows];

  // Match por ID exato
  let found = all.find(w => w.id === lower);
  if (found) return found;

  // Match por nome
  found = all.find(w => w.name.toLowerCase().includes(lower));
  if (found) return found;

  // Match por tags
  found = all.find(w => w.tags?.some(t => lower.includes(t)));
  if (found) return found;

  // Match fuzzy por descrição
  found = all.find(w => w.description.toLowerCase().includes(lower));
  if (found) return found;

  // Atalhos comuns
  const shortcuts = {
    'bom dia': 'morning-routine',
    'manhã': 'morning-routine',
    'morning': 'morning-routine',
    'review': 'code-review',
    'deploy': 'deploy-check',
    'relatório': 'weekly-report',
    'report': 'weekly-report',
    'health': 'server-health',
    'servidor': 'server-health',
    'pesquisa': 'research',
    'research': 'research'
  };

  for (const [shortcut, id] of Object.entries(shortcuts)) {
    if (lower.includes(shortcut)) {
      return all.find(w => w.id === id);
    }
  }

  return null;
}

// ═══════════════════════════════════════════════════════════
//  EXECUTAR WORKFLOW
// ═══════════════════════════════════════════════════════════

/**
 * Prepara workflow para execução
 * @returns {Object} Lista de passos a enviar ao orchestrator
 */
function prepareExecution(workflow, userInput = '') {
  if (workflow.requiresInput && !userInput) {
    return {
      success: false,
      needsInput: true,
      prompt: workflow.inputPrompt || 'Este workflow precisa de um input. O que queres processar?'
    };
  }

  // Resolver variáveis nos passos
  const resolvedSteps = workflow.steps.map(step => ({
    ...step,
    command: step.command.replace(/\{\{input\}\}/gi, userInput)
  }));

  return {
    success: true,
    workflowId: workflow.id,
    workflowName: workflow.name,
    steps: resolvedSteps,
    totalSteps: resolvedSteps.length,
    message: `📋 **A executar workflow: ${workflow.name}**\n\n` +
      resolvedSteps.map(s => `${s.order}. ${s.label || s.command}`).join('\n') +
      `\n\n⏳ Total: ${resolvedSteps.length} passos...`
  };
}

/**
 * Formata resultado de execução do workflow
 */
function formatResult(workflowName, results) {
  let msg = `📋 **Workflow Concluído: ${workflowName}**\n\n`;

  results.forEach((r, i) => {
    const icon = r.success ? '✅' : '❌';
    msg += `${icon} **Passo ${i + 1}: ${r.label || 'Ação'}**\n`;
    if (r.result) {
      const truncated = r.result.length > 300 ? r.result.substring(0, 300) + '...' : r.result;
      msg += `${truncated}\n`;
    }
    msg += '\n';
  });

  const successCount = results.filter(r => r.success).length;
  msg += `\n📊 **Resultado:** ${successCount}/${results.length} passos concluídos`;

  return msg;
}

// ═══════════════════════════════════════════════════════════
//  CRIAR WORKFLOW CUSTOM
// ═══════════════════════════════════════════════════════════

/**
 * Cria workflow personalizado a partir de texto natural
 */
function createWorkflow(text, userId = 'default') {
  // Padrões: "cria workflow 'nome': passo1 + passo2 + passo3"
  const match = text.match(/cri(?:a|ar)\s+workflow\s+['"](.+?)['"]:?\s+(.+)/is)
    || text.match(/novo\s+workflow\s+['"](.+?)['"]:?\s+(.+)/is);

  if (!match) {
    return {
      success: false,
      error: '❌ Formato: "cria workflow \'nome\': passo1 + passo2 + passo3"\n\n' +
        'Exemplo: "cria workflow \'Deploy\': git pull + npm install + pm2 restart"'
    };
  }

  const name = match[1].trim();
  const stepsText = match[2].trim();

  // Separar passos por + ou "e depois"
  const stepParts = stepsText.split(/\s*(?:\+|e\s+depois|depois|then)\s*/i)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  if (stepParts.length === 0) {
    return { success: false, error: '❌ Workflow precisa de pelo menos 1 passo.' };
  }

  const id = name.toLowerCase().replace(/[^\w]+/g, '-').substring(0, 30);

  // Verificar se já existe
  const existing = customWorkflows.find(w => w.id === id && w.userId === userId);
  if (existing) {
    existing.steps = stepParts.map((cmd, i) => ({
      order: i + 1,
      command: cmd,
      type: 'ai_chat',
      label: cmd.substring(0, 40)
    }));
    existing.updatedAt = Date.now();
    saveCustom();
    return { success: true, message: `✅ Workflow "${name}" atualizado com ${stepParts.length} passos.` };
  }

  const workflow = {
    id,
    name: `📋 ${name}`,
    description: `Workflow personalizado: ${stepParts.length} passos`,
    category: 'personalizado',
    userId,
    steps: stepParts.map((cmd, i) => ({
      order: i + 1,
      command: cmd,
      type: 'ai_chat',
      label: cmd.substring(0, 40)
    })),
    tags: [name.toLowerCase()],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    useCount: 0
  };

  customWorkflows.push(workflow);
  saveCustom();

  return {
    success: true,
    message: `📋 **Workflow criado: "${name}"**\n\n` +
      workflow.steps.map(s => `${s.order}. ${s.command}`).join('\n') +
      `\n\n💡 Executa com: "workflow ${name}"`
  };
}

/**
 * Remove workflow personalizado
 */
function deleteWorkflow(identifier, userId = 'default') {
  const idx = customWorkflows.findIndex(w =>
    (w.id === identifier || w.name.includes(identifier)) && w.userId === userId
  );

  if (idx === -1) {
    return { success: false, error: '❌ Workflow não encontrado (só podes remover workflows personalizados).' };
  }

  const removed = customWorkflows.splice(idx, 1)[0];
  saveCustom();
  return { success: true, message: `✅ Workflow "${removed.name}" removido.` };
}

// ═══════════════════════════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════════════════════════

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getStats() {
  return {
    builtIn: BUILTIN_WORKFLOWS.length,
    custom: customWorkflows.length,
    categories: [...new Set([...BUILTIN_WORKFLOWS, ...customWorkflows].map(w => w.category))],
    totalUses: customWorkflows.reduce((sum, w) => sum + (w.useCount || 0), 0)
  };
}

// ═══════════════════════════════════════════════════════════
//  EXPORTS
// ═══════════════════════════════════════════════════════════

module.exports = {
  init,
  listWorkflows,
  findWorkflow,
  prepareExecution,
  formatResult,
  createWorkflow,
  deleteWorkflow,
  getStats,
  BUILTIN_WORKFLOWS
};
