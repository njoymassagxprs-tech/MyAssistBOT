/**
 * 🌐 Remote Agent - Automação de Máquinas Remotas (Esqueleto)
 * 
 * Permite ao MyAssistBOT executar comandos em máquinas remotas via SSH.
 * Necessita: npm install ssh2
 * 
 * FUNCIONALIDADES PLANEADAS:
 * - Inventário de máquinas (IPs, credenciais, aliases)
 * - Execução remota de comandos (com confirmação obrigatória)
 * - Upload/download de ficheiros
 * - Estado e monitorização de máquinas
 * - IA planifica comandos, utilizador aprova, agent executa
 * 
 * SEGURANÇA:
 * - Todas as ações requerem confirmação explícita
 * - Blacklist de comandos perigosos (rm -rf /, format, etc.)
 * - Logs detalhados de cada operação
 * - Credenciais encriptadas no .env
 * 
 * ⚠️ ESTE MÓDULO É UM ESQUELETO — requer ssh2 e configuração
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════
// INVENTÁRIO DE MÁQUINAS
// ═══════════════════════════════════════════════════════════

const MACHINES_FILE = path.join(process.cwd(), 'user_data', 'machines.json');

// Comandos proibidos em máquinas remotas
const BLOCKED_COMMANDS = [
  /rm\s+-rf\s+\//,
  /mkfs\./,
  /dd\s+if=/,
  /format\s+[c-z]:/i,
  /del\s+\/[sf]\s+/i,
  /shutdown\s+-[sfr]/,
  /halt/,
  /init\s+0/,
  /:\(\)\s*\{.*\};\s*:/,  // fork bomb
  /wget.*\|.*sh/,
  /curl.*\|.*bash/
];

/**
 * Carrega inventário de máquinas
 */
function loadMachines() {
  try {
    if (fs.existsSync(MACHINES_FILE)) {
      return JSON.parse(fs.readFileSync(MACHINES_FILE, 'utf8'));
    }
  } catch (error) {
    console.error('❌ Erro ao carregar máquinas:', error.message);
  }
  return {};
}

/**
 * Guarda inventário de máquinas
 */
function saveMachines(machines) {
  const dir = path.dirname(MACHINES_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(MACHINES_FILE, JSON.stringify(machines, null, 2), 'utf8');
}

/**
 * Adiciona uma máquina ao inventário
 */
function addMachine(alias, config) {
  const machines = loadMachines();
  
  // Validação básica
  if (!config.host) return { success: false, error: '❌ IP/host é obrigatório.' };
  if (!config.username) return { success: false, error: '❌ Username é obrigatório.' };
  
  machines[alias] = {
    host: config.host,
    port: config.port || 22,
    username: config.username,
    // Nota: password/privateKey deveria ser encriptada
    authMethod: config.privateKey ? 'key' : 'password',
    os: config.os || 'linux',
    description: config.description || '',
    addedAt: new Date().toISOString(),
    lastConnected: null
  };
  
  saveMachines(machines);
  return { success: true, message: `✅ Máquina "${alias}" adicionada (${config.host}).` };
}

/**
 * Remove uma máquina do inventário
 */
function removeMachine(alias) {
  const machines = loadMachines();
  if (!machines[alias]) {
    return { success: false, error: `❌ Máquina "${alias}" não encontrada.` };
  }
  delete machines[alias];
  saveMachines(machines);
  return { success: true, message: `✅ Máquina "${alias}" removida.` };
}

/**
 * Lista máquinas registadas
 */
function listMachines() {
  const machines = loadMachines();
  const entries = Object.entries(machines);
  
  if (entries.length === 0) {
    return {
      success: true,
      machines: [],
      formatted: '📡 Nenhuma máquina registada.\n💡 Usa: "adiciona máquina servidor1 192.168.1.100 user root"'
    };
  }

  let formatted = `📡 **Máquinas Registadas (${entries.length}):**\n\n`;
  entries.forEach(([alias, m]) => {
    const status = '⚪'; // TODO: ping para verificar se está online
    formatted += `${status} **${alias}** — ${m.host}:${m.port}\n`;
    formatted += `   👤 ${m.username} | 💻 ${m.os} | ${m.description}\n\n`;
  });

  return { success: true, machines: entries, formatted };
}

/**
 * Verifica se um comando é seguro
 */
function isCommandSafe(command) {
  for (const blocked of BLOCKED_COMMANDS) {
    if (blocked.test(command)) {
      return { safe: false, reason: `Comando bloqueado (regex: ${blocked})` };
    }
  }
  return { safe: true };
}

/**
 * Executa comando numa máquina remota via SSH
 * REQUER: npm install ssh2
 */
async function executeRemote(alias, command) {
  // Verificar se ssh2 está disponível
  let Client;
  try {
    Client = require('ssh2').Client;
  } catch {
    return {
      success: false,
      error: '⚠️ Módulo ssh2 não instalado.\nExecuta: npm install ssh2'
    };
  }

  // Verificar segurança do comando
  const safety = isCommandSafe(command);
  if (!safety.safe) {
    return { success: false, error: `🚫 Comando bloqueado: ${safety.reason}` };
  }

  // Obter configuração da máquina
  const machines = loadMachines();
  const machine = machines[alias];
  if (!machine) {
    return { success: false, error: `❌ Máquina "${alias}" não registada.` };
  }

  return new Promise((resolve) => {
    const conn = new Client();
    let output = '';
    let errorOutput = '';

    const timeout = setTimeout(() => {
      conn.end();
      resolve({
        success: false,
        error: '⏱️ Timeout: comando demorou mais de 30s.'
      });
    }, 30000);

    conn.on('ready', () => {
      console.log(`📡 Conectado a ${alias} (${machine.host})`);
      
      conn.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timeout);
          conn.end();
          resolve({ success: false, error: `❌ Erro SSH: ${err.message}` });
          return;
        }

        stream.on('data', (data) => { output += data.toString(); });
        stream.stderr.on('data', (data) => { errorOutput += data.toString(); });
        
        stream.on('close', (code) => {
          clearTimeout(timeout);
          conn.end();
          
          // Atualizar last connected
          machine.lastConnected = new Date().toISOString();
          saveMachines(machines);

          resolve({
            success: code === 0,
            output: output.trim(),
            error: errorOutput.trim() || (code !== 0 ? `Código de saída: ${code}` : ''),
            exitCode: code,
            machine: alias,
            host: machine.host
          });
        });
      });
    });

    conn.on('error', (err) => {
      clearTimeout(timeout);
      resolve({
        success: false,
        error: `❌ Ligação SSH falhou: ${err.message}`
      });
    });

    // Conectar
    const connConfig = {
      host: machine.host,
      port: machine.port,
      username: machine.username
    };

    // TODO: credenciais devem vir de forma segura
    // Por agora, ler da .env por alias: REMOTE_<ALIAS>_PASSWORD
    const envKey = `REMOTE_${alias.toUpperCase()}_PASSWORD`;
    if (process.env[envKey]) {
      connConfig.password = process.env[envKey];
    }

    const keyPath = path.join(process.cwd(), 'user_data', `${alias}.key`);
    if (fs.existsSync(keyPath)) {
      connConfig.privateKey = fs.readFileSync(keyPath);
    }

    conn.connect(connConfig);
  });
}

/**
 * Formata resultado de execução remota
 */
function formatRemoteResult(result) {
  if (!result.success && result.error) {
    return result.error;
  }

  let output = `📡 **${result.machine}** (${result.host})\n`;
  output += `📋 Código de saída: ${result.exitCode}\n\n`;
  
  if (result.output) {
    output += `📤 **Saída:**\n\`\`\`\n${result.output.substring(0, 2000)}\n\`\`\`\n`;
  }
  if (result.error) {
    output += `⚠️ **Erros:**\n\`\`\`\n${result.error.substring(0, 1000)}\n\`\`\`\n`;
  }

  return output;
}

// ═══════════════════════════════════════════════════════════
// STATUS DO MÓDULO
// ═══════════════════════════════════════════════════════════

function getStatus() {
  let sshAvailable = false;
  try {
    require.resolve('ssh2');
    sshAvailable = true;
  } catch {}

  const machines = loadMachines();

  return {
    available: sshAvailable,
    sshModule: sshAvailable ? '✅ Instalado' : '❌ npm install ssh2',
    machinesCount: Object.keys(machines).length,
    machines: Object.entries(machines).map(([alias, m]) => ({
      alias,
      host: m.host,
      os: m.os
    }))
  };
}

module.exports = {
  addMachine,
  removeMachine,
  listMachines,
  executeRemote,
  formatRemoteResult,
  isCommandSafe,
  getStatus,
  loadMachines
};
