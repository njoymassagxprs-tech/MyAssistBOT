/**
 * ⚡ Code Runner - Execução segura de código JavaScript
 * 
 * - Sandbox isolada (vm)
 * - Timeout de 5 segundos
 * - Rate limiting por utilizador
 * - Sem acesso a fs, require, process
 */

const vm = require('vm');

const EXEC_TIMEOUT_MS = 5000;
const MAX_EXEC_PER_MIN = parseInt(process.env.MAX_EXEC_PER_MIN) || 5;

// Rate limiting por utilizador
const execCount = new Map();

/**
 * Verifica rate limit
 */
function checkRateLimit(userId) {
  const now = Date.now();
  const minute = Math.floor(now / 60000);
  const key = `${userId}:${minute}`;
  
  const count = execCount.get(key) || 0;
  
  // Limpar entradas antigas
  for (const [k] of execCount) {
    const kMinute = parseInt(k.split(':')[1]);
    if (kMinute < minute - 1) {
      execCount.delete(k);
    }
  }
  
  if (count >= MAX_EXEC_PER_MIN) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: 60 - (Math.floor(now / 1000) % 60)
    };
  }
  
  execCount.set(key, count + 1);
  return {
    allowed: true,
    remaining: MAX_EXEC_PER_MIN - count - 1,
    resetIn: 60 - (Math.floor(now / 1000) % 60)
  };
}

/**
 * Execuções restantes para utilizador
 */
function getRemainingExecutions(userId) {
  const now = Date.now();
  const minute = Math.floor(now / 60000);
  const key = `${userId}:${minute}`;
  const count = execCount.get(key) || 0;
  return MAX_EXEC_PER_MIN - count;
}

/**
 * Extrai código de uma mensagem
 */
function extractCode(input) {
  // Tenta extrair de bloco de código markdown
  const codeBlockMatch = input.match(/```(?:javascript|js)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  
  // Tenta extrair após "executar:/executa:" ou "run:"
  const execMatch = input.match(/(?:executa(?:r)?|run|exec|código|code)[:\s]+(.+)/i);
  if (execMatch) {
    return execMatch[1].trim();
  }
  
  // Se começa com código válido, usa diretamente
  if (input.match(/^(const|let|var|function|class|console|Math|Array|Object|String|Number)/)) {
    return input;
  }
  
  return null;
}

/**
 * Executa código em sandbox segura
 */
function runCode(code, userId = 'anonymous') {
  // Rate limit
  const rateCheck = checkRateLimit(userId);
  if (!rateCheck.allowed) {
    return {
      success: false,
      error: `⏳ Rate limit atingido. Tenta novamente em ${rateCheck.resetIn}s`,
      remaining: 0
    };
  }
  
  // Validação básica
  if (!code || typeof code !== 'string') {
    return {
      success: false,
      error: '❌ Código inválido',
      remaining: rateCheck.remaining
    };
  }
  
  // Bloquear padrões perigosos
  const dangerousPatterns = [
    /require\s*\(/,
    /import\s+/,
    /process\./,
    /global\./,
    /globalThis\./,
    /eval\s*\(/,
    /Function\s*\(/,
    /__dirname/,
    /__filename/,
    /child_process/,
    /fs\./,
    /path\./
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(code)) {
      return {
        success: false,
        error: '🔒 Código bloqueado: Contém padrões não permitidos',
        remaining: rateCheck.remaining
      };
    }
  }
  
  // Capturar output do console
  const logs = [];
  const mockConsole = {
    log: (...args) => logs.push(args.map(String).join(' ')),
    warn: (...args) => logs.push('⚠️ ' + args.map(String).join(' ')),
    error: (...args) => logs.push('❌ ' + args.map(String).join(' ')),
    info: (...args) => logs.push('ℹ️ ' + args.map(String).join(' '))
  };
  
  // Sandbox com APIs seguras
  const sandbox = {
    console: mockConsole,
    Math,
    Date,
    JSON,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Map,
    Set,
    Promise,
    setTimeout: undefined,  // Bloqueado
    setInterval: undefined, // Bloqueado
    fetch: undefined,       // Bloqueado
    require: undefined,     // Bloqueado
    result: undefined
  };
  
  try {
    const context = vm.createContext(sandbox);
    
    // Wrapper para capturar resultado
    const wrappedCode = `
      try {
        result = (function() {
          ${code}
        })();
      } catch (e) {
        result = { __error: e.message };
      }
    `;
    
    const script = new vm.Script(wrappedCode);
    script.runInContext(context, { timeout: EXEC_TIMEOUT_MS });
    
    // Processar resultado
    let output = '';
    
    if (logs.length > 0) {
      output = logs.join('\n');
    }
    
    if (sandbox.result !== undefined) {
      if (sandbox.result?.__error) {
        return {
          success: false,
          error: `❌ Erro: ${sandbox.result.__error}`,
          remaining: rateCheck.remaining
        };
      }
      
      if (output) {
        output += '\n';
      }
      output += `✅ Resultado: ${JSON.stringify(sandbox.result)}`;
    }
    
    return {
      success: true,
      output: output || '✅ Executado (sem output)',
      remaining: rateCheck.remaining
    };
    
  } catch (err) {
    let errorMsg = err.message;
    
    if (err.message.includes('timeout')) {
      errorMsg = `Timeout: Código demorou mais de ${EXEC_TIMEOUT_MS/1000}s`;
    }
    
    return {
      success: false,
      error: `❌ Erro: ${errorMsg}`,
      remaining: rateCheck.remaining
    };
  }
}

module.exports = {
  runCode,
  extractCode,
  checkRateLimit,
  getRemainingExecutions,
  MAX_EXEC_PER_MIN
};
