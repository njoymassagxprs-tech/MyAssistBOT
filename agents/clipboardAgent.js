/**
 * 📋 Smart Clipboard — Gestor de Clipboard Inteligente
 * 
 * Funcionalidades:
 *   - Histórico de clipboard (últimos N itens copiados)
 *   - Resumo automático de texto copiado longo
 *   - Deteção de dados sensíveis (passwords, tokens, cartões)
 *   - Pesquisa no histórico
 *   - Clipboard pinning (favoritos)
 * 
 * Exemplos:
 *   "mostra o meu clipboard" / "histórico do clipboard"
 *   "pesquisa no clipboard: email"
 *   "cola o último link que copiei"
 *   "limpa o clipboard"
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ═══════════════════════════════════════════════════════════
//  CONSTANTES
// ═══════════════════════════════════════════════════════════

const DATA_DIR = path.join(__dirname, '..', 'user_data');
const CLIPBOARD_FILE = path.join(DATA_DIR, 'clipboard_history.json');
const MAX_HISTORY = 100;
const POLL_INTERVAL_MS = 3000; // Verificar clipboard a cada 3 segundos
const SENSITIVE_PATTERNS = [
  { name: 'API Key', regex: /(?:api[_-]?key|apikey|token)[=:]\s*['"]?([A-Za-z0-9_\-]{20,})['"]?/i },
  { name: 'Password', regex: /(?:password|senha|pass|pwd)[=:]\s*['"]?(.{6,50})['"]?/i },
  { name: 'Email', regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
  { name: 'Cartão de Crédito', regex: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/ },
  { name: 'IBAN', regex: /\b[A-Z]{2}\d{2}\s?[\dA-Z]{4}(\s?\d{4}){2,7}\s?\d{1,4}\b/i },
  { name: 'JWT Token', regex: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/ },
  { name: 'Private Key', regex: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/ },
  { name: 'Bearer Token', regex: /Bearer\s+[A-Za-z0-9_\-\.]{20,}/ },
  { name: 'Telefone PT', regex: /(?:\+351|00351)?\s?(?:9[1-9]\d|2\d{2})\s?\d{3}\s?\d{3}/ },
  { name: 'NIF', regex: /\b[12356789]\d{8}\b/ }
];

// ═══════════════════════════════════════════════════════════
//  ESTADO
// ═══════════════════════════════════════════════════════════

let clipHistory = [];
let lastContent = '';
let pollTimer = null;
let monitorEnabled = false;

// ═══════════════════════════════════════════════════════════
//  INICIALIZAÇÃO
// ═══════════════════════════════════════════════════════════

function init(autoMonitor = false) {
  loadHistory();
  if (autoMonitor) startMonitoring();
  console.log(`[ClipboardAgent] 📋 Carregados ${clipHistory.length} itens do histórico`);
}

function loadHistory() {
  try {
    if (fs.existsSync(CLIPBOARD_FILE)) {
      clipHistory = JSON.parse(fs.readFileSync(CLIPBOARD_FILE, 'utf8'));
    }
  } catch (e) {
    clipHistory = [];
  }
}

function saveHistory() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (clipHistory.length > MAX_HISTORY) clipHistory = clipHistory.slice(-MAX_HISTORY);
    fs.writeFileSync(CLIPBOARD_FILE, JSON.stringify(clipHistory, null, 2), 'utf8');
  } catch (e) {
    console.error('[ClipboardAgent] Erro ao guardar:', e.message);
  }
}

// ═══════════════════════════════════════════════════════════
//  CLIPBOARD ACCESS
// ═══════════════════════════════════════════════════════════

/**
 * Lê o conteúdo atual do clipboard
 */
function readClipboard() {
  try {
    if (process.platform === 'win32') {
      const content = execSync('powershell -NoProfile -Command "Get-Clipboard"', {
        encoding: 'utf8', timeout: 5000, windowsHide: true
      }).trim();
      return { success: true, content };
    } else if (process.platform === 'linux') {
      const content = execSync('xclip -selection clipboard -o 2>/dev/null || xsel --clipboard --output 2>/dev/null', {
        encoding: 'utf8', timeout: 5000
      }).trim();
      return { success: true, content };
    } else if (process.platform === 'darwin') {
      const content = execSync('pbpaste', { encoding: 'utf8', timeout: 5000 }).trim();
      return { success: true, content };
    }
    return { success: false, error: `SO não suportado: ${process.platform}` };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Escreve no clipboard
 */
function writeClipboard(text) {
  try {
    if (process.platform === 'win32') {
      execSync(`powershell -NoProfile -Command "Set-Clipboard -Value '${text.replace(/'/g, "''")}'\"`, {
        timeout: 5000, windowsHide: true
      });
    } else if (process.platform === 'linux') {
      execSync(`echo -n "${text}" | xclip -selection clipboard`, { timeout: 5000 });
    } else if (process.platform === 'darwin') {
      execSync(`echo -n "${text}" | pbcopy`, { timeout: 5000 });
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ═══════════════════════════════════════════════════════════
//  MONITORIZAÇÃO DE CLIPBOARD
// ═══════════════════════════════════════════════════════════

function startMonitoring() {
  if (pollTimer) return;
  monitorEnabled = true;

  // Ler conteúdo atual para não registar o que já lá está
  const current = readClipboard();
  if (current.success) lastContent = current.content;

  pollTimer = setInterval(checkClipboard, POLL_INTERVAL_MS);
  console.log('[ClipboardAgent] 👁️ Monitorização de clipboard iniciada');
}

function stopMonitoring() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  monitorEnabled = false;
}

function checkClipboard() {
  const result = readClipboard();
  if (!result.success || !result.content) return;

  // Ignorar se conteúdo não mudou
  if (result.content === lastContent) return;
  lastContent = result.content;

  // Analisar e guardar
  const entry = analyzeContent(result.content);
  clipHistory.push(entry);
  saveHistory();

  // Alerta se dados sensíveis detetados
  if (entry.sensitive.length > 0) {
    console.log(`[ClipboardAgent] ⚠️ Dados sensíveis detetados no clipboard: ${entry.sensitive.map(s => s.type).join(', ')}`);
  }
}

// ═══════════════════════════════════════════════════════════
//  ANÁLISE DE CONTEÚDO
// ═══════════════════════════════════════════════════════════

/**
 * Analisa conteúdo copiado
 */
function analyzeContent(content) {
  const entry = {
    id: `clip_${Date.now()}`,
    content: content.substring(0, 5000), // Limitar tamanho
    length: content.length,
    type: detectContentType(content),
    sensitive: detectSensitiveData(content),
    pinned: false,
    timestamp: Date.now()
  };

  // Preview para itens longos
  if (content.length > 200) {
    entry.preview = content.substring(0, 200) + '...';
  }

  return entry;
}

/**
 * Deteta o tipo de conteúdo
 */
function detectContentType(content) {
  if (/^https?:\/\//i.test(content.trim())) return 'url';
  if (/^\S+@\S+\.\S+$/.test(content.trim())) return 'email';
  if (/^[\d\s+()-]{8,}$/.test(content.trim())) return 'phone';
  if (/^```|^function |^const |^import |^class |^def |^public /m.test(content)) return 'code';
  if (/^\{[\s\S]*\}$|^\[[\s\S]*\]$/s.test(content.trim())) return 'json';
  if (/<\w+[^>]*>/.test(content)) return 'html';
  if (/^[\w/\\]+\.\w+$/.test(content.trim())) return 'filepath';
  if (content.length > 500) return 'text-long';
  return 'text';
}

/**
 * Deteta dados sensíveis no conteúdo
 */
function detectSensitiveData(content) {
  const found = [];

  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.regex.test(content)) {
      found.push({
        type: pattern.name,
        warning: `⚠️ Possível ${pattern.name} detetado no clipboard`
      });
    }
    // Reset regex lastIndex para global patterns
    pattern.regex.lastIndex = 0;
  }

  return found;
}

// ═══════════════════════════════════════════════════════════
//  HISTÓRICO
// ═══════════════════════════════════════════════════════════

/**
 * Obtém histórico do clipboard formatado
 */
function getHistory(limit = 20) {
  const recent = clipHistory.slice(-limit).reverse();

  if (recent.length === 0) {
    return '📋 **Histórico do clipboard vazio.**\n\n' +
      'Ativa a monitorização com: "monitoriza o clipboard"';
  }

  let msg = `📋 **Histórico do Clipboard (${recent.length}/${clipHistory.length}):**\n\n`;

  recent.forEach((entry, i) => {
    const icon = getTypeIcon(entry.type);
    const sensitive = entry.sensitive.length > 0 ? ' ⚠️' : '';
    const pinned = entry.pinned ? ' 📌' : '';
    const time = new Date(entry.timestamp).toLocaleString('pt-PT', {
      hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit'
    });

    const preview = entry.preview || entry.content.substring(0, 80);

    msg += `**${i + 1}.** ${icon}${pinned}${sensitive} \`${time}\`\n`;
    msg += `   ${preview}${entry.content.length > 80 && !entry.preview ? '...' : ''}\n\n`;
  });

  return msg;
}

/**
 * Pesquisa no histórico do clipboard
 */
function searchHistory(query) {
  const lower = query.toLowerCase();
  const results = clipHistory.filter(entry =>
    entry.content.toLowerCase().includes(lower)
  ).reverse().slice(0, 10);

  if (results.length === 0) {
    return `📋 Nenhum resultado para "${query}" no histórico do clipboard.`;
  }

  let msg = `📋 **Resultados no clipboard para "${query}" (${results.length}):**\n\n`;

  results.forEach((entry, i) => {
    const icon = getTypeIcon(entry.type);
    const time = new Date(entry.timestamp).toLocaleString('pt-PT', {
      hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit'
    });

    // Highlight do match
    const preview = entry.content.substring(0, 150);

    msg += `**${i + 1}.** ${icon} \`${time}\`\n   ${preview}${entry.content.length > 150 ? '...' : ''}\n\n`;
  });

  return msg;
}

/**
 * Obtém último item copiado de um tipo específico
 */
function getLastOfType(type) {
  const item = clipHistory.reverse().find(e => e.type === type);
  if (!item) return null;
  return item.content;
}

/**
 * Pin/unpin item
 */
function togglePin(index) {
  const recent = clipHistory.slice(-MAX_HISTORY);
  if (index < 1 || index > recent.length) {
    return { success: false, error: '❌ Índice inválido.' };
  }

  const entry = recent[recent.length - index];
  entry.pinned = !entry.pinned;
  saveHistory();

  return {
    success: true,
    message: `${entry.pinned ? '📌 Item fixado' : '📋 Item desfixado'}`
  };
}

/**
 * Limpa histórico (mantém pinned)
 */
function clearHistory(keepPinned = true) {
  const pinned = keepPinned ? clipHistory.filter(e => e.pinned) : [];
  const count = clipHistory.length - pinned.length;
  clipHistory = pinned;
  saveHistory();

  return {
    success: true,
    message: `🗑️ Histórico limpo: ${count} itens removidos${pinned.length > 0 ? `, ${pinned.length} pinned mantidos` : ''}`
  };
}

/**
 * Obtém clipboard atual com análise
 */
function getCurrentClipboard() {
  const result = readClipboard();
  if (!result.success) {
    return `❌ Não foi possível ler o clipboard: ${result.error}`;
  }

  if (!result.content) {
    return '📋 Clipboard vazio.';
  }

  const analysis = analyzeContent(result.content);
  const icon = getTypeIcon(analysis.type);

  let msg = `📋 **Clipboard Atual:**\n\n`;
  msg += `${icon} **Tipo:** ${analysis.type}\n`;
  msg += `📏 **Tamanho:** ${analysis.length} caracteres\n`;

  if (analysis.sensitive.length > 0) {
    msg += `\n⚠️ **Dados sensíveis detetados:**\n`;
    analysis.sensitive.forEach(s => {
      msg += `  • ${s.warning}\n`;
    });
  }

  msg += `\n**Conteúdo:**\n\`\`\`\n${result.content.substring(0, 1000)}\n\`\`\``;

  if (result.content.length > 1000) {
    msg += `\n*(truncado — ${result.content.length} caracteres total)*`;
  }

  return msg;
}

// ═══════════════════════════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════════════════════════

function getTypeIcon(type) {
  const icons = {
    url: '🔗',
    email: '📧',
    phone: '📞',
    code: '💻',
    json: '📦',
    html: '🌐',
    filepath: '📁',
    'text-long': '📄',
    text: '📝'
  };
  return icons[type] || '📋';
}

function getStats() {
  return {
    totalItems: clipHistory.length,
    pinnedItems: clipHistory.filter(e => e.pinned).length,
    sensitiveItems: clipHistory.filter(e => e.sensitive.length > 0).length,
    monitoring: monitorEnabled,
    types: Object.fromEntries(
      ['url', 'code', 'text', 'email', 'json'].map(t => [
        t, clipHistory.filter(e => e.type === t).length
      ])
    )
  };
}

// ═══════════════════════════════════════════════════════════
//  EXPORTS
// ═══════════════════════════════════════════════════════════

module.exports = {
  init,
  readClipboard,
  writeClipboard,
  getCurrentClipboard,
  getHistory,
  searchHistory,
  getLastOfType,
  togglePin,
  clearHistory,
  startMonitoring,
  stopMonitoring,
  detectSensitiveData,
  getStats
};
