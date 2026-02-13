/**
 * ⏰ Automation Agent — Motor de Tarefas Agendadas
 * 
 * Permite ao utilizador agendar tarefas recorrentes que o bot executa automaticamente.
 * Exemplos:
 *   "todos os dias às 8h diz-me o tempo"
 *   "às sextas às 18h resume as minhas notas da semana"
 *   "a cada 2 horas verifica o servidor SSH"
 * 
 * Funcionalidades:
 *   - Cron scheduling com syntax natural (PT/EN)
 *   - CRUD de tarefas agendadas
 *   - Histórico de execuções
 *   - Integração com todos os agentes do bot
 *   - Notificações via web/telegram/discord
 */

const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════
//  CONSTANTES
// ═══════════════════════════════════════════════════════════

const DATA_DIR = path.join(__dirname, '..', 'user_data');
const TASKS_FILE = path.join(DATA_DIR, 'scheduled_tasks.json');
const HISTORY_FILE = path.join(DATA_DIR, 'automation_history.json');
const MAX_HISTORY = 500;
const CHECK_INTERVAL_MS = 30 * 1000; // Verificar a cada 30 segundos

// ═══════════════════════════════════════════════════════════
//  ESTADO
// ═══════════════════════════════════════════════════════════

let tasks = [];
let history = [];
let checkTimer = null;
let orchestratorRef = null; // Referência ao orchestrator para executar tarefas

// ═══════════════════════════════════════════════════════════
//  INICIALIZAÇÃO
// ═══════════════════════════════════════════════════════════

function init(orchestrator) {
  orchestratorRef = orchestrator;
  loadTasks();
  loadHistory();
  startScheduler();
  console.log(`[AutomationAgent] ⏰ Iniciado com ${tasks.length} tarefas agendadas`);
}

function loadTasks() {
  try {
    if (fs.existsSync(TASKS_FILE)) {
      tasks = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('[AutomationAgent] Erro ao carregar tarefas:', e.message);
    tasks = [];
  }
}

function saveTasks() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2), 'utf8');
  } catch (e) {
    console.error('[AutomationAgent] Erro ao guardar tarefas:', e.message);
  }
}

function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    }
  } catch (e) {
    history = [];
  }
}

function saveHistory() {
  try {
    // Manter apenas os últimos N registos
    if (history.length > MAX_HISTORY) {
      history = history.slice(-MAX_HISTORY);
    }
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf8');
  } catch (e) {
    console.error('[AutomationAgent] Erro ao guardar histórico:', e.message);
  }
}

// ═══════════════════════════════════════════════════════════
//  PARSING DE HORÁRIO NATURAL → SCHEDULE
// ═══════════════════════════════════════════════════════════

/**
 * Converte expressão natural para schedule interno
 * Suporta PT e EN:
 *   "todos os dias às 8h" → { type: 'daily', hour: 8, minute: 0 }
 *   "às segundas e quartas às 10:30" → { type: 'weekly', days: [1,3], hour: 10, minute: 30 }
 *   "a cada 2 horas" → { type: 'interval', intervalMs: 7200000 }
 *   "dia 15 de cada mês às 9h" → { type: 'monthly', day: 15, hour: 9, minute: 0 }
 *   "uma vez em 30 minutos" → { type: 'once', runAt: timestamp }
 */
function parseSchedule(text) {
  const lower = text.toLowerCase().trim();

  // ── Intervalo: "a cada X minutos/horas" ──
  const intervalMatch = lower.match(/(?:a\s+)?cada\s+(\d+)\s*(minuto|hora|segundo|min|seg|hr|h)\w*/i)
    || lower.match(/every\s+(\d+)\s*(minute|hour|second|min|sec|hr)s?/i);

  if (intervalMatch) {
    const n = parseInt(intervalMatch[1]);
    const unit = intervalMatch[2];
    let ms = n * 1000;
    if (/^(minuto|minute|min)/.test(unit)) ms = n * 60 * 1000;
    else if (/^(hora|hour|hr|h$)/.test(unit)) ms = n * 60 * 60 * 1000;
    return { type: 'interval', intervalMs: ms, description: `A cada ${n} ${unit}(s)` };
  }

  // ── Extrair hora ──
  let hour = 0, minute = 0;
  const timeMatch = lower.match(/(?:às|as|at|@)\s*(\d{1,2})[h:.](\d{2})?/i)
    || lower.match(/(\d{1,2})[h:](\d{2})?\s*(am|pm)?/i);

  if (timeMatch) {
    hour = parseInt(timeMatch[1]);
    minute = parseInt(timeMatch[2] || '0');
    if (timeMatch[3] === 'pm' && hour < 12) hour += 12;
  }

  // ── Uma vez: "daqui a X minutos", "em 1 hora" ──
  const onceMatch = lower.match(/(?:daqui\s+a|em|in)\s+(\d+)\s*(minuto|hora|min|hr|h)\w*/i);
  if (onceMatch) {
    const n = parseInt(onceMatch[1]);
    const unit = onceMatch[2];
    let ms = n * 60 * 1000;
    if (/^(hora|hour|hr|h$)/.test(unit)) ms = n * 60 * 60 * 1000;
    return { type: 'once', runAt: Date.now() + ms, description: `Uma vez em ${n} ${unit}(s)` };
  }

  // ── Diário: "todos os dias", "diariamente" ──
  if (/todos\s+os\s+dias|diariamente|every\s*day|daily/i.test(lower)) {
    return { type: 'daily', hour, minute, description: `Todos os dias às ${hour}:${String(minute).padStart(2, '0')}` };
  }

  // ── Semanal: dias específicos ──
  const dayMap = {
    'segunda': 1, 'terça': 2, 'terca': 2, 'quarta': 3, 'quinta': 4,
    'sexta': 5, 'sábado': 6, 'sabado': 6, 'domingo': 0,
    'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4,
    'friday': 5, 'saturday': 6, 'sunday': 0,
    'seg': 1, 'ter': 2, 'qua': 3, 'qui': 4, 'sex': 5, 'sáb': 6, 'sab': 6, 'dom': 0,
    'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6, 'sun': 0
  };

  const days = [];
  for (const [name, num] of Object.entries(dayMap)) {
    if (lower.includes(name)) days.push(num);
  }

  // Atalhos
  if (/dias\s+úteis|dias\s+uteis|weekdays/i.test(lower)) days.push(1, 2, 3, 4, 5);
  if (/fins?\s+de\s+semana|weekends?/i.test(lower)) days.push(0, 6);

  if (days.length > 0) {
    const uniqueDays = [...new Set(days)].sort();
    const dayNames = uniqueDays.map(d => ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][d]);
    return {
      type: 'weekly',
      days: uniqueDays,
      hour, minute,
      description: `${dayNames.join(', ')} às ${hour}:${String(minute).padStart(2, '0')}`
    };
  }

  // ── Mensal: "dia X de cada mês" ──
  const monthlyMatch = lower.match(/dia\s+(\d{1,2})\s+(?:de\s+cada|do)\s+m[êe]s/i);
  if (monthlyMatch) {
    return {
      type: 'monthly',
      day: parseInt(monthlyMatch[1]),
      hour, minute,
      description: `Dia ${monthlyMatch[1]} de cada mês às ${hour}:${String(minute).padStart(2, '0')}`
    };
  }

  // ── Fallback: se tem hora mas sem padrão → diário ──
  if (timeMatch) {
    return { type: 'daily', hour, minute, description: `Todos os dias às ${hour}:${String(minute).padStart(2, '0')}` };
  }

  return null;
}

/**
 * Separa o schedule da ação no texto do utilizador
 * "todos os dias às 8h diz-me o tempo" → { scheduleText: "todos os dias às 8h", action: "diz-me o tempo" }
 */
function parseTaskFromText(text) {
  // Padrões que delimitam schedule vs ação
  const separators = [
    /^(.+?)\b(?:faz|fazer|executa|executar|diz|dizer|envia|enviar|verifica|verificar|resume|resumir|mostra|mostrar|pesquisa|pesquisar|cria|criar|gera|gerar|analisa|analisar|corre|correr|run|do|send|check|show|tell)\b\s*(.+)/is,
    /^(.+?),\s*(.+)/s
  ];

  for (const sep of separators) {
    const match = text.match(sep);
    if (match) {
      const schedule = parseSchedule(match[1]);
      if (schedule) {
        return { schedule, action: match[2].trim() };
      }
    }
  }

  // Tentar inverso: ação primeiro, schedule depois
  const reverseMatch = text.match(/^(.+?)\b(?:todos os dias|diariamente|a cada|cada|às|every|daily|weekly)\b(.+)/is);
  if (reverseMatch) {
    const schedule = parseSchedule(reverseMatch[2]);
    if (schedule) {
      return { schedule, action: reverseMatch[1].trim() };
    }
  }

  return null;
}

// ═══════════════════════════════════════════════════════════
//  CRUD DE TAREFAS
// ═══════════════════════════════════════════════════════════

/**
 * Cria nova tarefa agendada
 */
function createTask(text, userId = 'default') {
  const parsed = parseTaskFromText(text);

  if (!parsed || !parsed.schedule) {
    return {
      success: false,
      error: '❌ Não consegui interpretar o agendamento. Exemplos:\n' +
        '- "todos os dias às 8h diz-me o tempo"\n' +
        '- "às sextas às 18h resume as minhas notas"\n' +
        '- "a cada 2 horas verifica o servidor"\n' +
        '- "daqui a 30 minutos lembra-me de ligar ao cliente"'
    };
  }

  const task = {
    id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    action: parsed.action,
    schedule: parsed.schedule,
    userId,
    enabled: true,
    createdAt: Date.now(),
    lastRun: null,
    nextRun: calculateNextRun(parsed.schedule),
    runCount: 0
  };

  tasks.push(task);
  saveTasks();

  return {
    success: true,
    task,
    message: `⏰ **Tarefa agendada com sucesso!**\n\n` +
      `📋 **Ação:** ${task.action}\n` +
      `🕐 **Quando:** ${task.schedule.description}\n` +
      `🆔 **ID:** \`${task.id}\`\n` +
      `📅 **Próxima execução:** ${formatDate(task.nextRun)}`
  };
}

/**
 * Lista todas as tarefas
 */
function listTasks(userId = null) {
  const filtered = userId ? tasks.filter(t => t.userId === userId) : tasks;

  if (filtered.length === 0) {
    return '📭 **Nenhuma tarefa agendada.**\n\nUsa: "agenda [quando] [o quê]"\nExemplo: "todos os dias às 9h diz-me o tempo"';
  }

  let msg = `⏰ **Tarefas Agendadas (${filtered.length}):**\n\n`;
  filtered.forEach((t, i) => {
    const status = t.enabled ? '🟢' : '🔴';
    const nextRun = t.nextRun ? formatDate(t.nextRun) : 'N/A';
    msg += `${status} **${i + 1}.** ${t.action}\n`;
    msg += `   🕐 ${t.schedule.description} | Execuções: ${t.runCount} | Próxima: ${nextRun}\n`;
    msg += `   🆔 \`${t.id}\`\n\n`;
  });

  return msg;
}

/**
 * Remove uma tarefa
 */
function deleteTask(identifier) {
  const idx = tasks.findIndex(t =>
    t.id === identifier ||
    t.action.toLowerCase().includes(identifier.toLowerCase())
  );

  if (idx === -1) {
    // Tentar por índice numérico
    const num = parseInt(identifier);
    if (num >= 1 && num <= tasks.length) {
      const removed = tasks.splice(num - 1, 1)[0];
      saveTasks();
      return { success: true, message: `✅ Tarefa removida: "${removed.action}"` };
    }
    return { success: false, error: '❌ Tarefa não encontrada. Usa "listar tarefas" para ver os IDs.' };
  }

  const removed = tasks.splice(idx, 1)[0];
  saveTasks();
  return { success: true, message: `✅ Tarefa removida: "${removed.action}"` };
}

/**
 * Ativa/desativa uma tarefa
 */
function toggleTask(identifier) {
  const task = tasks.find(t =>
    t.id === identifier ||
    t.action.toLowerCase().includes(identifier.toLowerCase())
  );

  if (!task) {
    return { success: false, error: '❌ Tarefa não encontrada.' };
  }

  task.enabled = !task.enabled;
  if (task.enabled) task.nextRun = calculateNextRun(task.schedule);
  saveTasks();

  return {
    success: true,
    message: `${task.enabled ? '🟢' : '🔴'} Tarefa "${task.action}" ${task.enabled ? 'ativada' : 'desativada'}.`
  };
}

// ═══════════════════════════════════════════════════════════
//  SCHEDULER
// ═══════════════════════════════════════════════════════════

function startScheduler() {
  if (checkTimer) clearInterval(checkTimer);

  checkTimer = setInterval(() => {
    checkAndRunTasks();
  }, CHECK_INTERVAL_MS);
}

function stopScheduler() {
  if (checkTimer) {
    clearInterval(checkTimer);
    checkTimer = null;
  }
}

async function checkAndRunTasks() {
  const now = Date.now();

  for (const task of tasks) {
    if (!task.enabled) continue;
    if (!task.nextRun || task.nextRun > now) continue;

    // Hora de executar
    try {
      await executeTask(task);
    } catch (err) {
      console.error(`[AutomationAgent] Erro na tarefa ${task.id}:`, err.message);
      addHistory(task, false, err.message);
    }

    // Calcular próxima execução
    if (task.schedule.type === 'once') {
      task.enabled = false; // Tarefa única, desativar
    } else {
      task.nextRun = calculateNextRun(task.schedule);
    }

    task.lastRun = now;
    task.runCount++;
    saveTasks();
  }
}

async function executeTask(task) {
  console.log(`[AutomationAgent] ⏰ A executar: "${task.action}"`);

  let result = '';

  if (orchestratorRef && typeof orchestratorRef.handlePrompt === 'function') {
    try {
      result = await orchestratorRef.handlePrompt(task.action, {
        source: 'automation',
        userId: task.userId,
        automated: true,
        confirmed: true // Tarefas agendadas não pedem confirmação
      });
    } catch (err) {
      result = `Erro: ${err.message}`;
    }
  } else {
    result = '[AutomationAgent] Orchestrator não disponível — tarefa registada mas não executada.';
  }

  addHistory(task, true, result);

  // Notificar (se possível)
  notifyTaskResult(task, result);

  return result;
}

function notifyTaskResult(task, result) {
  // Log sempre
  console.log(`[AutomationAgent] ✅ Tarefa "${task.action}" completada`);

  // A notificação real via Telegram/Discord/WebSocket é delegada
  // ao sistema de notificações (quando implementado)
  // Por agora, guardamos no histórico
}

function addHistory(task, success, result) {
  history.push({
    taskId: task.id,
    action: task.action,
    success,
    result: typeof result === 'string' ? result.substring(0, 500) : String(result).substring(0, 500),
    timestamp: Date.now()
  });
  saveHistory();
}

// ═══════════════════════════════════════════════════════════
//  CÁLCULO DE PRÓXIMA EXECUÇÃO
// ═══════════════════════════════════════════════════════════

function calculateNextRun(schedule) {
  const now = new Date();

  switch (schedule.type) {
    case 'once':
      return schedule.runAt;

    case 'interval':
      return Date.now() + schedule.intervalMs;

    case 'daily': {
      const next = new Date(now);
      next.setHours(schedule.hour, schedule.minute, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      return next.getTime();
    }

    case 'weekly': {
      const next = new Date(now);
      let daysUntil = Infinity;

      for (const day of schedule.days) {
        let diff = day - now.getDay();
        if (diff < 0) diff += 7;
        if (diff === 0) {
          // Hoje é o dia — verificar se a hora já passou
          const todayTarget = new Date(now);
          todayTarget.setHours(schedule.hour, schedule.minute, 0, 0);
          if (todayTarget > now) { daysUntil = 0; break; }
          diff = 7;
        }
        if (diff < daysUntil) daysUntil = diff;
      }

      next.setDate(now.getDate() + daysUntil);
      next.setHours(schedule.hour, schedule.minute, 0, 0);
      return next.getTime();
    }

    case 'monthly': {
      const next = new Date(now);
      next.setDate(schedule.day);
      next.setHours(schedule.hour, schedule.minute, 0, 0);
      if (next <= now) next.setMonth(next.getMonth() + 1);
      return next.getTime();
    }

    default:
      return Date.now() + 60 * 60 * 1000; // 1h fallback
  }
}

// ═══════════════════════════════════════════════════════════
//  HISTÓRICO
// ═══════════════════════════════════════════════════════════

function getHistory(limit = 20) {
  const recent = history.slice(-limit).reverse();

  if (recent.length === 0) {
    return '📭 Nenhuma execução registada ainda.';
  }

  let msg = `📜 **Histórico de Automações (últimas ${recent.length}):**\n\n`;
  recent.forEach(h => {
    const icon = h.success ? '✅' : '❌';
    const date = formatDate(h.timestamp);
    msg += `${icon} **${h.action}** — ${date}\n`;
    if (h.result) msg += `   📝 ${h.result.substring(0, 100)}${h.result.length > 100 ? '...' : ''}\n`;
    msg += '\n';
  });

  return msg;
}

// ═══════════════════════════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════════════════════════

function formatDate(ts) {
  if (!ts) return 'N/A';
  const d = new Date(ts);
  return d.toLocaleString('pt-PT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function getStats() {
  return {
    total: tasks.length,
    active: tasks.filter(t => t.enabled).length,
    inactive: tasks.filter(t => !t.enabled).length,
    totalRuns: history.length,
    successRate: history.length > 0
      ? Math.round(history.filter(h => h.success).length / history.length * 100)
      : 100
  };
}

// ═══════════════════════════════════════════════════════════
//  EXPORTS
// ═══════════════════════════════════════════════════════════

module.exports = {
  init,
  createTask,
  listTasks,
  deleteTask,
  toggleTask,
  getHistory,
  getStats,
  parseSchedule,
  parseTaskFromText,
  startScheduler,
  stopScheduler
};
