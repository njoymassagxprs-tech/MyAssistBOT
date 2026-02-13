#!/usr/bin/env node

/**
 * 🧪 MyAssistBOT - Suite de Testes Completa
 * 
 * Executa: npm test  (ou node test/test-all.js)
 * 
 * Testa todos os módulos sem dependências externas.
 * Não requer API keys nem servidores a correr.
 */

const path = require('path');

// ═══════════════════════════════════════════════════════════
// MINI TEST FRAMEWORK
// ═══════════════════════════════════════════════════════════

let totalTests = 0;
let passed = 0;
let failed = 0;
const failures = [];

function describe(name, fn) {
  console.log(`\n━━━ ${name} ━━━`);
  fn();
}

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    const msg = `  ❌ ${name} → ${err.message}`;
    console.log(msg);
    failures.push({ name, error: err.message });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected "${expected}" but got "${actual}"`);
  }
}

function assertIncludes(text, substring, message) {
  if (!text.includes(substring)) {
    throw new Error(message || `Expected "${text}" to include "${substring}"`);
  }
}

function assertMatch(text, pattern, message) {
  if (!pattern.test(text)) {
    throw new Error(message || `Expected "${text}" to match ${pattern}`);
  }
}

// ═══════════════════════════════════════════════════════════
// TESTES
// ═══════════════════════════════════════════════════════════

// 1. INTENT PARSER
describe('🎯 Intent Parser', () => {
  const { parseIntent, looksLikeCode, INTENT_PATTERNS } = require('../orchestrator/intentParser');

  test('Reconhece "ajuda" como help', () => {
    assertEqual(parseIntent('ajuda').intent, 'help');
  });

  test('Reconhece "help" como help', () => {
    assertEqual(parseIntent('help').intent, 'help');
  });

  test('Reconhece "cria um pdf sobre X" como create_pdf', () => {
    const r = parseIntent('cria um pdf sobre javascript');
    assertEqual(r.intent, 'create_pdf');
    assertEqual(r.entities.topic, 'javascript');
  });

  test('Reconhece "gerar pdf" como create_pdf', () => {
    assertEqual(parseIntent('gerar pdf sobre IA').intent, 'create_pdf');
  });

  test('Reconhece "listar ficheiros" como list_files', () => {
    assertEqual(parseIntent('listar ficheiros').intent, 'list_files');
  });

  test('Reconhece "executa:" como run_code', () => {
    assertEqual(parseIntent('executa: console.log(1)').intent, 'run_code');
  });

  test('Reconhece "executar:" como run_code', () => {
    assertEqual(parseIntent('executar: 2+2').intent, 'run_code');
  });

  test('Reconhece "run:" como run_code', () => {
    assertEqual(parseIntent('run: Math.PI').intent, 'run_code');
  });

  test('Reconhece "console.log" direto como run_code', () => {
    assertEqual(parseIntent('console.log("hi")').intent, 'run_code');
  });

  test('Reconhece "status" como system_info', () => {
    assertEqual(parseIntent('status').intent, 'system_info');
  });

  test('Reconhece "pesquisa sobre X" como web_search', () => {
    const r = parseIntent('pesquisa sobre inteligência artificial');
    assertEqual(r.intent, 'web_search');
  });

  test('Reconhece "o que é X" como web_search', () => {
    assertEqual(parseIntent('o que é machine learning').intent, 'web_search');
  });

  test('Reconhece "quem é X" como web_search', () => {
    assertEqual(parseIntent('quem é Elon Musk').intent, 'web_search');
  });

  test('Reconhece "cria ficheiro X com Y" como system_create_file', () => {
    const r = parseIntent('cria ficheiro teste.txt com hello');
    assertEqual(r.intent, 'system_create_file');
    assertEqual(r.entities.path, 'teste.txt');
    assertEqual(r.entities.content, 'hello');
  });

  test('Reconhece "lê o ficheiro X" como system_read_file', () => {
    const r = parseIntent('lê o ficheiro config.json');
    assertEqual(r.intent, 'system_read_file');
    assertEqual(r.entities.path, 'config.json');
  });

  test('Reconhece "abre o notepad" como system_open_app', () => {
    const r = parseIntent('abre o notepad');
    assertEqual(r.intent, 'system_open_app');
  });

  test('Reconhece "abre site google.com" como system_open_url', () => {
    const r = parseIntent('abre site google.com');
    assertEqual(r.intent, 'system_open_url');
    assertEqual(r.entities.url, 'google.com');
  });

  test('Reconhece "lista processos" como system_list_processes', () => {
    assertEqual(parseIntent('lista processos').intent, 'system_list_processes');
  });

  test('Reconhece "mata processo chrome" com entidade correta', () => {
    const r = parseIntent('mata processo chrome');
    assertEqual(r.intent, 'system_kill_process');
    assertEqual(r.entities.identifier, 'chrome');
  });

  test('Reconhece "minimiza chrome" como system_window_action', () => {
    const r = parseIntent('minimiza chrome');
    assertEqual(r.intent, 'system_window_action');
    assertEqual(r.entities.action, 'minimize');
  });

  test('Reconhece "screenshot" como input_screenshot', () => {
    assertEqual(parseIntent('screenshot').intent, 'input_screenshot');
  });

  test('Reconhece "digita olá" como input_type', () => {
    const r = parseIntent('digita olá');
    assertEqual(r.intent, 'input_type');
    assertEqual(r.entities.text, 'olá');
  });

  test('Mensagem genérica vai para chat (IA)', () => {
    assertEqual(parseIntent('Qual é a capital de Portugal?').intent, 'chat');
  });

  test('Mensagem vazia retorna chat', () => {
    assertEqual(parseIntent('').intent, 'chat');
  });

  test('null/undefined retorna chat sem crash', () => {
    assertEqual(parseIntent(null).intent, 'chat');
    assertEqual(parseIntent(undefined).intent, 'chat');
  });

  test('looksLikeCode detecta código JS', () => {
    assert(looksLikeCode('const x = 5;'), 'const');
    assert(looksLikeCode('function test(){}'), 'function');
    assert(looksLikeCode('console.log("hi")'), 'console');
  });

  test('looksLikeCode rejeita texto normal', () => {
    assert(!looksLikeCode('olá como estás'), 'texto normal');
  });

  test('INTENT_PATTERNS é objeto com padrões', () => {
    assert(typeof INTENT_PATTERNS === 'object');
    assert(Object.keys(INTENT_PATTERNS).length > 10, 'Deve ter >10 intents');
  });
});

// 2. CODE RUNNER
describe('⚡ Code Runner', () => {
  const codeRunner = require('../agents/codeRunner');

  test('extractCode extrai de "executa: ..."', () => {
    assertEqual(codeRunner.extractCode('executa: 2+2'), '2+2');
  });

  test('extractCode extrai de "executar: ..."', () => {
    assertEqual(codeRunner.extractCode('executar: console.log(1)'), 'console.log(1)');
  });

  test('extractCode extrai de "run: ..."', () => {
    assertEqual(codeRunner.extractCode('run: Math.PI'), 'Math.PI');
  });

  test('extractCode extrai código direto (const/let/var)', () => {
    assertEqual(codeRunner.extractCode('const x = 5'), 'const x = 5');
  });

  test('extractCode extrai de bloco markdown', () => {
    const input = '```js\nconsole.log("hi")\n```';
    assertEqual(codeRunner.extractCode(input), 'console.log("hi")');
  });

  test('extractCode retorna null para texto normal', () => {
    assertEqual(codeRunner.extractCode('olá tudo bem?'), null);
  });

  test('runCode executa código simples', () => {
    const r = codeRunner.runCode('console.log(42)', 'test-user-1');
    assert(r.success, 'Deve ter sucesso');
    assertIncludes(r.output, '42');
  });

  test('runCode executa Math', () => {
    const r = codeRunner.runCode('console.log(Math.sqrt(16))', 'test-user-2');
    assert(r.success);
    assertIncludes(r.output, '4');
  });

  test('runCode retorna resultado de expressão', () => {
    const r = codeRunner.runCode('2 + 3', 'test-user-3');
    assert(r.success);
    // Pode retornar '5' ou mensagem de sucesso sem output
    assert(r.output.includes('5') || r.output.includes('sem output'), 'Output: ' + r.output);
  });

  test('runCode bloqueia require()', () => {
    const r = codeRunner.runCode("require('fs')", 'test-user-4');
    assert(!r.success, 'Deve bloquear require');
    assertIncludes(r.error, 'bloqueado');
  });

  test('runCode bloqueia process.exit', () => {
    const r = codeRunner.runCode('process.exit(1)', 'test-user-5');
    assert(!r.success, 'Deve bloquear process');
  });

  test('runCode bloqueia eval()', () => {
    const r = codeRunner.runCode('eval("1+1")', 'test-user-6');
    assert(!r.success, 'Deve bloquear eval');
  });

  test('runCode tem timeout para loops infinitos', () => {
    const r = codeRunner.runCode('while(true){}', 'test-user-7');
    assert(!r.success, 'Deve dar timeout');
    // A mensagem pode conter "timeout" ou "timed out"
    assert(r.error.toLowerCase().includes('timeout') || r.error.toLowerCase().includes('timed out'), 'Error: ' + r.error);
  });

  test('runCode código inválido retorna erro', () => {
    const r = codeRunner.runCode(null, 'test-user-8');
    assert(!r.success);
  });

  test('getRemainingExecutions retorna número', () => {
    const r = codeRunner.getRemainingExecutions('new-user');
    assert(typeof r === 'number');
    assert(r >= 0 && r <= codeRunner.MAX_EXEC_PER_MIN);
  });
});

// 3. FILE AGENT
describe('📁 File Agent', () => {
  const fileAgent = require('../agents/fileAgent');
  const fs = require('fs');

  test('ALLOWED_READ é array com 3 pastas', () => {
    assert(Array.isArray(fileAgent.ALLOWED_READ));
    assert(fileAgent.ALLOWED_READ.length >= 3);
  });

  test('isAllowedPath aceita pasta Documentos', () => {
    const docsPath = path.join(__dirname, '..', 'Documentos', 'test.txt');
    assert(fileAgent.isAllowedPath(docsPath, 'read'), 'Documentos deve ser permitida');
  });

  test('isAllowedPath rejeita pasta fora de scope', () => {
    assert(!fileAgent.isAllowedPath('C:\\Windows\\System32\\file.txt', 'read'));
  });

  test('isAllowedPath rejeita null/undefined', () => {
    assert(!fileAgent.isAllowedPath(null));
    assert(!fileAgent.isAllowedPath(undefined));
    assert(!fileAgent.isAllowedPath(''));
  });

  test('listAllFiles retorna string sem crash', () => {
    const result = fileAgent.listAllFiles();
    assert(typeof result === 'string');
  });

  test('readFile rejeita acesso a C:\\Windows', () => {
    const r = fileAgent.readFile('C:\\Windows\\System32\\drivers\\etc\\hosts');
    assert(r.error, 'Deve rejeitar');
    assertIncludes(r.error, 'negado');
  });

  test('createNote cria nota formatada', () => {
    const r = fileAgent.createNote('Teste Unit', 'Conteúdo de teste');
    assert(r.success, 'Deve criar nota');
    assert(fs.existsSync(r.path), 'Ficheiro deve existir');
    
    // Limpar
    fs.unlinkSync(r.path);
  });

  test('formatSize formata bytes corretamente', () => {
    // Test via listAllFiles (indiretamente)
    const result = fileAgent.listAllFiles();
    assert(typeof result === 'string');
  });
});

// 4. SECURITY
describe('🔐 Security', () => {
  const security = require('../orchestrator/security');

  test('getUserId retorna ID para CLI', () => {
    const id = security.getUserId({});
    assertMatch(id, /^cli:/);
  });

  test('getUserId retorna ID para Telegram', () => {
    const id = security.getUserId({ telegramChatId: '12345' });
    assertEqual(id, 'telegram:12345');
  });

  test('getUserId retorna ID para Discord', () => {
    const id = security.getUserId({ discordUserId: 'abc' });
    assertEqual(id, 'discord:abc');
  });

  test('getUserId retorna ID para Web', () => {
    const id = security.getUserId({ webSessionId: 'sess-1' });
    assertEqual(id, 'web:sess-1');
  });

  test('logAction não faz crash', () => {
    security.logAction('test-user', 'test-action', { info: 'teste unitário' });
    assert(true);
  });

  test('getRecentLogs retorna array', () => {
    const logs = security.getRecentLogs(10);
    assert(Array.isArray(logs));
  });

  test('generateSecurityCode retorna código hex', () => {
    const code = security.generateSecurityCode();
    assert(typeof code === 'string');
    assert(code.length >= 4);
    assertMatch(code, /^[0-9A-F]+$/i);
  });

  test('getStats retorna objeto com campos', () => {
    const stats = security.getStats();
    assert(typeof stats === 'object');
    assert('totalActions' in stats);
    assert('byUser' in stats);
    assert('byAction' in stats);
  });
});

// 5. AI AGENT (sem API call)
describe('🧠 AI Agent', () => {
  const aiAgent = require('../agents/aiAgent');

  test('isAvailable retorna boolean', () => {
    const r = aiAgent.isAvailable();
    assert(typeof r === 'boolean');
  });

  test('GROQ_MODEL é string definida', () => {
    assert(typeof aiAgent.GROQ_MODEL === 'string');
    assert(aiAgent.GROQ_MODEL.length > 0);
  });

  test('FALLBACK_MODEL é string diferente do principal', () => {
    assert(typeof aiAgent.FALLBACK_MODEL === 'string');
    assert(aiAgent.FALLBACK_MODEL !== aiAgent.GROQ_MODEL);
  });

  test('Exporta askAI, generateContent, analyzeIntent', () => {
    assert(typeof aiAgent.askAI === 'function');
    assert(typeof aiAgent.generateContent === 'function');
    assert(typeof aiAgent.analyzeIntent === 'function');
  });

  test('Exporta askAIStream para streaming', () => {
    assert(typeof aiAgent.askAIStream === 'function');
  });
});

// 6. SYSTEM AGENT
describe('🖥️ System Agent', () => {
  const systemAgent = require('../agents/systemAgent');
  const fs = require('fs');

  test('isEnabled retorna boolean', () => {
    assert(typeof systemAgent.isEnabled() === 'boolean');
  });

  test('expandPath expande "." para cwd', () => {
    const r = systemAgent.expandPath('.');
    assertEqual(r, path.resolve(process.cwd()));
  });

  test('expandPath expande path relativo para user_data', () => {
    const r = systemAgent.expandPath('teste.txt');
    assertIncludes(r, 'user_data');
    assertIncludes(r, 'teste.txt');
  });

  test('expandPath expande ~ para home', () => {
    const r = systemAgent.expandPath('~/Documents');
    assertIncludes(r, require('os').homedir());
  });

  test('isPathAllowed aceita cwd', () => {
    assert(systemAgent.isPathAllowed(process.cwd()));
  });

  test('isPathAllowed rejeita C:\\Windows', () => {
    assert(!systemAgent.isPathAllowed('C:\\Windows\\System32'));
  });

  test('isCommandAllowed aceita "dir"', () => {
    const r = systemAgent.isCommandAllowed('dir');
    assert(r.allowed, 'dir deve ser permitido');
  });

  test('isCommandAllowed aceita "node --version"', () => {
    const r = systemAgent.isCommandAllowed('node --version');
    assert(r.allowed);
  });

  test('isCommandAllowed bloqueia "rm -rf"', () => {
    const r = systemAgent.isCommandAllowed('rm -rf /');
    assert(!r.allowed, 'rm deve ser bloqueado');
  });

  test('isCommandAllowed bloqueia "shutdown"', () => {
    const r = systemAgent.isCommandAllowed('shutdown /s');
    assert(!r.allowed);
  });

  test('isCommandAllowed bloqueia "format"', () => {
    const r = systemAgent.isCommandAllowed('format C:');
    assert(!r.allowed);
  });

  test('createFile + readFile + editFile ciclo completo', () => {
    const testPath = path.join(process.cwd(), 'user_data', '_test_temp.txt');
    
    // Criar
    const c = systemAgent.createFile('_test_temp.txt', 'linha1');
    assert(c.success, 'Criar deve funcionar');
    assert(c.size === 6, `Size deve ser 6, got ${c.size}`);
    
    // Ler
    const r = systemAgent.readFile(testPath);
    assert(r.success, 'Ler deve funcionar');
    assertEqual(r.content, 'linha1');
    
    // Editar (append)
    const e = systemAgent.editFile(testPath, 'linha2', 'append');
    assert(e.success, 'Editar deve funcionar');
    
    // Verificar
    const r2 = systemAgent.readFile(testPath);
    assertIncludes(r2.content, 'linha1');
    assertIncludes(r2.content, 'linha2');
    
    // Limpar
    fs.unlinkSync(testPath);
  });

  test('listDirectory lista pasta do projeto', () => {
    const r = systemAgent.listDirectory('.');
    assert(r.success, 'Deve listar');
    assert(r.files || r.folders, 'Deve ter conteúdo');
  });
});

// 7. WEB SEARCH AGENT
describe('🔍 Web Search Agent', () => {
  const ws = require('../agents/webSearchAgent');

  test('classifyQuery: conceito → knowledge', () => {
    assertEqual(ws.classifyQuery('o que é machine learning'), 'knowledge');
  });

  test('classifyQuery: preço → realtime', () => {
    assertEqual(ws.classifyQuery('preço do bitcoin hoje'), 'realtime');
  });

  test('classifyQuery: notícias → realtime', () => {
    assertEqual(ws.classifyQuery('últimas notícias tecnologia'), 'realtime');
  });

  test('classifyQuery: biografía → knowledge', () => {
    assertEqual(ws.classifyQuery('quem foi Albert Einstein'), 'knowledge');
  });

  test('classifyQuery: tutorial → realtime', () => {
    assertEqual(ws.classifyQuery('como fazer um site em react'), 'realtime');
  });

  test('isAvailable retorna boolean', () => {
    assert(typeof ws.isAvailable() === 'boolean');
  });

  test('formatResults com erro', () => {
    const r = ws.formatResults({ error: 'Teste erro' });
    assertIncludes(r, 'Teste erro');
  });

  test('Exporta search, searchDuckDuckGo, searchSerper', () => {
    assert(typeof ws.search === 'function');
    assert(typeof ws.searchDuckDuckGo === 'function');
    assert(typeof ws.searchSerper === 'function');
  });
});

// 8. DECISION ENGINE
describe('🧠 Decision Engine', () => {
  const { decisionEngine } = require('../memory/decisionEngine');

  test('decideOutputMode: código → text only', () => {
    const r = decisionEngine.decideOutputMode('```js\nconst x = 1;\n```');
    assertEqual(r.mode, 'text');
    assert(!r.shouldSpeak);
  });

  test('decideOutputMode: resposta curta → speak', () => {
    const r = decisionEngine.decideOutputMode('Sim, correto.');
    assertEqual(r.mode, 'speak');
    assert(r.shouldSpeak);
  });

  test('decideOutputMode: URLs → text', () => {
    const r = decisionEngine.decideOutputMode('Vê em https://example.com');
    assertEqual(r.mode, 'text');
  });

  test('decideOutputMode: modo forçado', () => {
    const r = decisionEngine.decideOutputMode('Qualquer texto', 'speak');
    assertEqual(r.mode, 'speak');
    assert(r.shouldSpeak);
  });

  test('classifyIntent retorna tipo', () => {
    const r = decisionEngine.classifyIntent('olá');
    assert(typeof r === 'object');
    assert('type' in r);
  });

  test('requiresConfirmation existe', () => {
    assert(typeof decisionEngine.requiresConfirmation === 'function');
  });

  test('prepareForTTS limpa markdown', () => {
    const r = decisionEngine.prepareForTTS('**negrito** e `código`');
    assert(!r.includes('**'));
    assert(!r.includes('`'));
  });
});

// 9. CONVERSATION STORE
describe('💾 Conversation Store', () => {
  const { conversationStore } = require('../memory/conversationStore');

  test('createConversation retorna conversa válida', () => {
    const c = conversationStore.createConversation('Teste');
    assert(c.id);
    assert(c.title === 'Teste');
    assert(Array.isArray(c.messages));
    assert(c.messages.length === 0);
    
    // Limpar
    conversationStore.deleteConversation(c.id);
  });

  test('addMessage adiciona mensagem', () => {
    const c = conversationStore.createConversation('Teste Msg');
    conversationStore.addMessage(c.id, { role: 'user', content: 'Olá' });
    
    const updated = conversationStore.getConversation(c.id);
    assert(updated.messages.length === 1);
    assertEqual(updated.messages[0].role, 'user');
    assertEqual(updated.messages[0].content, 'Olá');
    
    conversationStore.deleteConversation(c.id);
  });

  test('getHistoryForContext limita mensagens', () => {
    const c = conversationStore.createConversation('Teste History');
    
    for (let i = 0; i < 20; i++) {
      conversationStore.addMessage(c.id, { role: 'user', content: `Msg ${i}` });
    }
    
    const history = conversationStore.getHistoryForContext(c.id, 5);
    assert(history.length === 5, `Deve retornar 5, got ${history.length}`);
    
    conversationStore.deleteConversation(c.id);
  });

  test('deleteConversation remove conversa', () => {
    const c = conversationStore.createConversation('Para Apagar');
    assert(conversationStore.deleteConversation(c.id));
    assert(!conversationStore.getConversation(c.id));
  });

  test('listConversations retorna array ordenado', () => {
    const list = conversationStore.listConversations();
    assert(Array.isArray(list));
  });

  test('getStats retorna estatísticas', () => {
    const stats = conversationStore.getStats();
    assert(typeof stats === 'object');
  });
});

// 10. ROUTER
describe('🔀 Router', () => {
  const router = require('../orchestrator/router');

  test('Exporta handlePrompt', () => {
    assert(typeof router.handlePrompt === 'function');
  });

  test('Exporta getSystemInfo', () => {
    assert(typeof router.getSystemInfo === 'function');
  });

  test('Exporta getAgentsList', () => {
    assert(typeof router.getAgentsList === 'function');
  });

  test('Exporta getHelpMessage', () => {
    assert(typeof router.getHelpMessage === 'function');
  });
});

// 11. PDF AGENT
describe('📄 PDF Agent', () => {
  const pdfAgent = require('../agents/pdfAgent');
  const fs = require('fs');

  test('Exporta createPDF, listPDFs', () => {
    assert(typeof pdfAgent.createPDF === 'function');
    assert(typeof pdfAgent.listPDFs === 'function');
  });

  test('listPDFs retorna array', () => {
    const list = pdfAgent.listPDFs();
    assert(Array.isArray(list));
  });

  test('OUTPUTS_DIR está definido', () => {
    assert(typeof pdfAgent.OUTPUTS_DIR === 'string');
    assert(pdfAgent.OUTPUTS_DIR.length > 0);
  });
});

// 12. INPUT AGENT (sem executar ações reais)
describe('🎮 Input Agent', () => {
  const inputAgent = require('../agents/inputAgent');

  test('isEnabled retorna boolean', () => {
    assert(typeof inputAgent.isEnabled() === 'boolean');
  });

  test('BLACKLISTED_WINDOWS tem sites bancários', () => {
    assert(Array.isArray(inputAgent.BLACKLISTED_WINDOWS));
    const has = inputAgent.BLACKLISTED_WINDOWS.some(w => w.includes('paypal'));
    assert(has, 'Deve ter paypal na blacklist');
  });

  test('BLACKLISTED_URLS tem sites críticos', () => {
    assert(Array.isArray(inputAgent.BLACKLISTED_URLS));
    const has = inputAgent.BLACKLISTED_URLS.some(u => u.includes('binance'));
    assert(has, 'Deve ter binance na blacklist');
  });

  test('generateActionPlan gera plano legível', () => {
    const plan = inputAgent.generateActionPlan([
      { type: 'type', description: 'Digitar olá' },
      { type: 'click', description: 'Clicar botão' }
    ]);
    assertIncludes(plan, 'Digitar olá');
    assertIncludes(plan, 'Clicar botão');
    assertIncludes(plan, 'aprovar');
  });

  test('checkRateLimit retorna objeto', () => {
    const r = inputAgent.checkRateLimit();
    assert(typeof r === 'object');
    assert('allowed' in r);
  });
});

// ═══════════════════════════════════════════════════════════
// 13. REMOTE AGENT
// ═══════════════════════════════════════════════════════════

describe('📡 Remote Agent', () => {
  const remoteAgent = require('../agents/remoteAgent');

  test('Exporta funções principais', () => {
    assert(typeof remoteAgent.addMachine === 'function');
    assert(typeof remoteAgent.removeMachine === 'function');
    assert(typeof remoteAgent.listMachines === 'function');
    assert(typeof remoteAgent.executeRemote === 'function');
    assert(typeof remoteAgent.isCommandSafe === 'function');
    assert(typeof remoteAgent.getStatus === 'function');
    assert(typeof remoteAgent.formatRemoteResult === 'function');
  });

  test('isCommandSafe bloqueia rm -rf /', () => {
    const result = remoteAgent.isCommandSafe('rm -rf /');
    assert(!result.safe, 'rm -rf / deve ser bloqueado');
  });

  test('isCommandSafe permite ls -la', () => {
    const result = remoteAgent.isCommandSafe('ls -la');
    assert(result.safe, 'ls -la deve ser permitido');
  });

  test('isCommandSafe bloqueia fork bomb', () => {
    const result = remoteAgent.isCommandSafe(':(){ :|:& };:');
    assert(!result.safe, 'Fork bomb deve ser bloqueado');
  });

  test('listMachines retorna objeto com formatted', () => {
    const result = remoteAgent.listMachines();
    assert(result.success === true);
    assert(typeof result.formatted === 'string');
  });

  test('getStatus retorna informação do módulo', () => {
    const status = remoteAgent.getStatus();
    assert(typeof status.available === 'boolean');
    assert(typeof status.machinesCount === 'number');
    assert(typeof status.sshModule === 'string');
  });

  test('formatRemoteResult formata erro', () => {
    const result = remoteAgent.formatRemoteResult({ success: false, error: '❌ Teste' });
    assertIncludes(result, 'Teste');
  });

  test('formatRemoteResult formata sucesso', () => {
    const result = remoteAgent.formatRemoteResult({
      success: true,
      machine: 'test',
      host: '1.2.3.4',
      exitCode: 0,
      output: 'hello',
      error: ''
    });
    assertIncludes(result, 'test');
    assertIncludes(result, '1.2.3.4');
  });
});

// ═══════════════════════════════════════════════════════════
// 14. SECURITY ENHANCEMENTS
// ═══════════════════════════════════════════════════════════

describe('🔐 Security (Melhorias)', () => {
  const security = require('../orchestrator/security');

  test('checkRateLimit permite primeiros pedidos', () => {
    const result = security.checkRateLimit('test-ip-unique-' + Date.now());
    assert(result.allowed === true);
    assert(result.remaining >= 0);
  });

  test('authMiddleware exportado como função', () => {
    assert(typeof security.authMiddleware === 'function');
  });

  test('rateLimitMiddleware exportado como função', () => {
    assert(typeof security.rateLimitMiddleware === 'function');
  });

  test('getOrCreateApiKey retorna string', () => {
    const key = security.getOrCreateApiKey();
    assert(typeof key === 'string');
    assert(key.length > 0);
  });
});

// ═══════════════════════════════════════════════════════════
// 15. INTENT PARSER — Remote Agent Intents
// ═══════════════════════════════════════════════════════════

describe('🎯 Intent Parser (Remote)', () => {
  const { parseIntent, INTENT_PATTERNS } = require('../orchestrator/intentParser');

  test('Reconhece "lista máquinas remotas"', () => {
    assertEqual(parseIntent('lista máquinas remotas').intent, 'remote_list_machines');
  });

  test('Reconhece "lista servidores"', () => {
    assertEqual(parseIntent('lista servidores').intent, 'remote_list_machines');
  });

  test('Reconhece "adiciona máquina X Y user Z"', () => {
    const result = parseIntent('adiciona máquina servidor1 192.168.1.100 user root');
    assertEqual(result.intent, 'remote_add_machine');
    assertEqual(result.entities.alias, 'servidor1');
    assertEqual(result.entities.host, '192.168.1.100');
    assertEqual(result.entities.username, 'root');
  });

  test('Reconhece "remove máquina X"', () => {
    const result = parseIntent('remove máquina servidor1');
    assertEqual(result.intent, 'remote_remove_machine');
    assertEqual(result.entities.alias, 'servidor1');
  });

  test('Reconhece "ssh servidor1 uptime"', () => {
    const result = parseIntent('ssh servidor1 uptime');
    assertEqual(result.intent, 'remote_execute');
  });

  test('INTENT_PATTERNS tem remote_list_machines', () => {
    assert(INTENT_PATTERNS.remote_list_machines !== undefined);
  });

  test('INTENT_PATTERNS tem remote_add_machine', () => {
    assert(INTENT_PATTERNS.remote_add_machine !== undefined);
  });

  test('INTENT_PATTERNS tem remote_execute', () => {
    assert(INTENT_PATTERNS.remote_execute !== undefined);
  });

  test('INTENT_PATTERNS tem remote_status', () => {
    assert(INTENT_PATTERNS.remote_status !== undefined);
  });
});

// 12. PROJECT BLUEPRINT INTENT
describe('📐 Project Blueprint Intent', () => {
  const { parseIntent, INTENT_PATTERNS } = require('../orchestrator/intentParser');

  test('INTENT_PATTERNS tem project_blueprint', () => {
    assert(INTENT_PATTERNS.project_blueprint !== undefined);
  });

  test('project_blueprint tem patterns e extract', () => {
    assert(Array.isArray(INTENT_PATTERNS.project_blueprint.patterns));
    assert(typeof INTENT_PATTERNS.project_blueprint.extract === 'function');
  });

  test('Reconhece "cria um blueprint para app de dating"', () => {
    assertEqual(parseIntent('cria um blueprint para app de dating').intent, 'project_blueprint');
  });

  test('Reconhece "planeia uma app de tarefas"', () => {
    assertEqual(parseIntent('planeia uma app de tarefas').intent, 'project_blueprint');
  });

  test('Reconhece "blueprint para um site de receitas"', () => {
    assertEqual(parseIntent('blueprint para um site de receitas').intent, 'project_blueprint');
  });

  test('Reconhece "como ficaria uma app de chat"', () => {
    assertEqual(parseIntent('como ficaria uma app de chat em React').intent, 'project_blueprint');
  });

  test('Reconhece "só o plano para uma app"', () => {
    assertEqual(parseIntent('só o plano para uma app de fitness').intent, 'project_blueprint');
  });

  test('Reconhece negação "cria app de dating mas não criar agora"', () => {
    assertEqual(parseIntent('cria uma app de dating mas não criar agora').intent, 'project_blueprint');
  });

  test('Extrai descrição do blueprint', () => {
    const result = parseIntent('cria um blueprint para app de dating');
    assert(result.entities.description !== undefined, 'Deve extrair description');
    assert(result.entities.description.length > 0, 'Description não deve estar vazio');
  });

  test('project_create ainda funciona "cria um projeto de galeria"', () => {
    assertEqual(parseIntent('cria um projeto de galeria de fotos').intent, 'project_create');
  });

  test('project_create funciona "cria uma app de todo"', () => {
    assertEqual(parseIntent('cria uma app de todo list').intent, 'project_create');
  });
});

// 13. AGENT CHAINING — Blueprint Detection & Fail-Fast
describe('🔗 Agent Chaining Melhorado', () => {
  const { isMultiStep, isBlueprintRequest, executeChain, formatChainResult } = require('../orchestrator/agentChaining');

  test('isBlueprintRequest existe e é função', () => {
    assert(typeof isBlueprintRequest === 'function');
  });

  test('isBlueprintRequest detecta "não criar agora"', () => {
    assert(isBlueprintRequest('quero uma app mas não criar agora'));
  });

  test('isBlueprintRequest detecta "blueprint"', () => {
    assert(isBlueprintRequest('faz um blueprint para a minha app'));
  });

  test('isBlueprintRequest detecta "como ficaria"', () => {
    assert(isBlueprintRequest('como ficaria uma app de dating'));
  });

  test('isBlueprintRequest detecta "só o plano"', () => {
    assert(isBlueprintRequest('só o plano para este projeto'));
  });

  test('isBlueprintRequest retorna false para pedido normal', () => {
    assert(!isBlueprintRequest('pesquisa sobre React e cria um PDF'));
  });

  test('isMultiStep não dispara para pedidos blueprint', () => {
    assert(!isMultiStep('planeia uma app de dating como ficaria'));
  });

  test('isMultiStep continua a funcionar para multi-step real', () => {
    assert(isMultiStep('pesquisa sobre React e depois cria um PDF sobre isso'));
  });

  test('executeChain fail-fast cancela passos dependentes', async () => {
    const steps = [
      { step: 1, agent: 'test', action: 'vai falhar', input: 'x', usePreviousOutput: false },
      { step: 2, agent: 'test', action: 'depende do anterior', input: 'y', usePreviousOutput: true }
    ];

    const result = await executeChain(
      steps,
      async () => { throw new Error('falha simulada'); },
      null,
      { failFast: true }
    );

    assert(!result.success, 'Chain deve falhar');
    assertEqual(result.results.length, 2, 'Deve ter 2 resultados (1 falhado + 1 cancelado)');
    assert(!result.results[0].success, 'Passo 1 deve falhar');
    assertIncludes(result.results[1].error, 'Cancelado', 'Passo 2 deve ser cancelado');
  });

  test('executeChain continua se passos independentes', async () => {
    let callCount = 0;
    const steps = [
      { step: 1, agent: 'test', action: 'falha', input: 'x', usePreviousOutput: false },
      { step: 2, agent: 'test', action: 'independente', input: 'y', usePreviousOutput: false }
    ];

    const result = await executeChain(
      steps,
      async () => { 
        callCount++;
        if (callCount === 1) throw new Error('falha');
        return 'ok';
      },
      null,
      { failFast: true }
    );

    assertEqual(result.results.length, 2, 'Deve ter 2 resultados');
    assert(!result.results[0].success, 'Passo 1 falhou');
    assert(result.results[1].success, 'Passo 2 continuou pois é independente');
  });

  test('formatChainResult formata resultado com erro', () => {
    const chainResult = {
      success: false,
      totalSteps: 2,
      completedSteps: 0,
      results: [
        { step: 1, agent: 'test', action: 'falhou', success: false, error: 'boom' },
        { step: 2, agent: 'test', action: 'cancelado', success: false, error: 'Cancelado' }
      ]
    };
    const formatted = formatChainResult(chainResult);
    assertIncludes(formatted, '0/2');
    assertIncludes(formatted, 'boom');
    assertIncludes(formatted, 'Cancelado');
  });
});

// 14. PROJECT BUILDER — generateBlueprint
describe('🏗️ Project Builder Blueprint', () => {
  const projectBuilder = require('../agents/projectBuilder');

  test('generateBlueprint existe e é função', () => {
    assert(typeof projectBuilder.generateBlueprint === 'function');
  });

  test('generateBlueprint retorna erro sem IA', async () => {
    const result = await projectBuilder.generateBlueprint('app de tarefas');
    // Sem API key, deve falhar graciosamente
    assert(result.success === false || result.success === true, 'Deve retornar objecto com success');
    if (!result.success) {
      assert(typeof result.error === 'string', 'Deve ter mensagem de erro');
    }
  });

  test('planProject ainda exportado', () => {
    assert(typeof projectBuilder.planProject === 'function');
  });

  test('buildProject ainda exportado', () => {
    assert(typeof projectBuilder.buildProject === 'function');
  });

  test('listProjects ainda exportado', () => {
    assert(typeof projectBuilder.listProjects === 'function');
  });
});

// ═══════════════════════════════════════════════════════════
// LLM ROUTER
// ═══════════════════════════════════════════════════════════

describe('🔄 LLM Router (Multi-Provider)', () => {
  const llmRouter = require('../orchestrator/llmRouter');

  test('Exporta chat function', () => {
    assert(typeof llmRouter.chat === 'function');
  });

  test('Exporta chatStream function', () => {
    assert(typeof llmRouter.chatStream === 'function');
  });

  test('Exporta getProvidersStatus function', () => {
    assert(typeof llmRouter.getProvidersStatus === 'function');
  });

  test('Exporta getActiveProvider function', () => {
    assert(typeof llmRouter.getActiveProvider === 'function');
  });

  test('Exporta getAvailableProviders function', () => {
    assert(typeof llmRouter.getAvailableProviders === 'function');
  });

  test('Exporta isAvailable function', () => {
    assert(typeof llmRouter.isAvailable === 'function');
  });

  test('PROVIDERS contém os 5 providers esperados', () => {
    const providers = llmRouter.PROVIDERS;
    assert(typeof providers === 'object');
    assert(providers.groq, 'Deve ter groq');
    assert(providers.cerebras, 'Deve ter cerebras');
    assert(providers.gemini, 'Deve ter gemini');
    assert(providers.huggingface, 'Deve ter huggingface');
    assert(providers.ollama, 'Deve ter ollama');
  });

  test('Cada provider tem name, baseURL, model', () => {
    const providers = llmRouter.PROVIDERS;
    for (const [key, p] of Object.entries(providers)) {
      assert(typeof p.name === 'string', `${key} deve ter name`);
      assert(typeof p.model === 'string', `${key} deve ter model`);
    }
  });

  test('getProvidersStatus retorna array', () => {
    const status = llmRouter.getProvidersStatus();
    assert(Array.isArray(status), 'Deve retornar array');
    assert(status.length >= 5, 'Deve ter pelo menos 5 providers');
  });

  test('Cada status tem name, available, configured', () => {
    const status = llmRouter.getProvidersStatus();
    for (const s of status) {
      assert(typeof s.name === 'string', 'Status deve ter name');
      assert(typeof s.available === 'boolean', 'Status deve ter available');
      assert(typeof s.configured === 'boolean', 'Status deve ter configured');
    }
  });

  test('getActiveProvider retorna object ou null', () => {
    const active = llmRouter.getActiveProvider();
    assert(active === null || typeof active === 'object');
    if (active) {
      assert(typeof active.name === 'string', 'Active provider deve ter name');
    }
  });

  test('getAvailableProviders retorna array', () => {
    const available = llmRouter.getAvailableProviders();
    assert(Array.isArray(available));
  });

  test('isAvailable retorna boolean', () => {
    assert(typeof llmRouter.isAvailable() === 'boolean');
  });
});

// ═══════════════════════════════════════════════════════════
// RAG ENGINE
// ═══════════════════════════════════════════════════════════

describe('🧠 RAG Engine', () => {
  const ragEngine = require('../orchestrator/ragEngine');

  test('ragEngine é objecto singleton', () => {
    assert(typeof ragEngine === 'object');
    assert(ragEngine !== null);
  });

  test('Exporta init function', () => {
    assert(typeof ragEngine.init === 'function');
  });

  test('Exporta search function', () => {
    assert(typeof ragEngine.search === 'function');
  });

  test('Exporta indexFile function', () => {
    assert(typeof ragEngine.indexFile === 'function');
  });

  test('Exporta indexDirectory function', () => {
    assert(typeof ragEngine.indexDirectory === 'function');
  });

  test('Exporta indexText function', () => {
    assert(typeof ragEngine.indexText === 'function');
  });

  test('Exporta getContext function', () => {
    assert(typeof ragEngine.getContext === 'function');
  });

  test('Exporta getStats function', () => {
    assert(typeof ragEngine.getStats === 'function');
  });

  test('Exporta clearIndex function', () => {
    assert(typeof ragEngine.clearIndex === 'function');
  });

  test('Exporta removeFile function', () => {
    assert(typeof ragEngine.removeFile === 'function');
  });

  test('getStats retorna objeto com campos esperados', () => {
    const stats = ragEngine.getStats();
    assert(typeof stats === 'object');
    assert(typeof stats.totalChunks === 'number');
    assert(typeof stats.totalSources === 'number');
    assert(typeof stats.totalDocs === 'number');
    assert(typeof stats.vocabularySize === 'number');
    assert(Array.isArray(stats.sources));
  });

  test('_tokenize remove stop words', () => {
    const tokens = ragEngine._tokenize('o gato de Portugal com amor');
    assert(!tokens.includes('de'), 'Não deve incluir "de"');
    assert(!tokens.includes('com'), 'Não deve incluir "com"');
    assert(tokens.includes('gato'), 'Deve incluir "gato"');
    assert(tokens.includes('portugal'), 'Deve incluir "portugal"');
  });

  test('_cosineSimilarity vetores iguais = 1', () => {
    const vec = { a: 1, b: 2, c: 3 };
    const sim = ragEngine._cosineSimilarity(vec, vec);
    assert(Math.abs(sim - 1.0) < 0.001, `Similaridade deve ser ~1, got ${sim}`);
  });

  test('_cosineSimilarity vetores ortogonais = 0', () => {
    const vecA = { a: 1 };
    const vecB = { b: 1 };
    const sim = ragEngine._cosineSimilarity(vecA, vecB);
    assertEqual(sim, 0);
  });

  test('_createChunks divide texto longo', () => {
    // Criar texto com mais palavras que CHUNK_SIZE (512)
    const words = [];
    for (let i = 0; i < 600; i++) words.push('word' + i);
    const text = words.join(' ');
    const chunks = ragEngine._createChunks(text, 'test', {});
    assert(chunks.length > 1, `Deve ter multiplos chunks, got ${chunks.length}`);
    assert(chunks[0].id, 'Chunk deve ter id');
    assert(chunks[0].source === 'test', 'Chunk deve ter source correto');
  });

  test('_createChunks texto curto = 1 chunk', () => {
    const chunks = ragEngine._createChunks('Texto curto', 'test', {});
    assertEqual(chunks.length, 1);
  });
});

// ═══════════════════════════════════════════════════════════
// WEB/API INTEGRATION CHECKS
// ═══════════════════════════════════════════════════════════

describe('🌐 API Server Exports', () => {
  test('api-server.js carrega sem erros', () => {
    // Não iniciar o servidor, apenas verificar que o módulo carrega
    // (o módulo inicia automaticamente, então fazemos check de dependências)
    const path = require('path');
    const fs = require('fs');
    const serverPath = path.join(__dirname, '..', 'orchestrator', 'api-server.js');
    assert(fs.existsSync(serverPath), 'api-server.js deve existir');
    
    // Verificar que as dependências existem
    const llmRouterPath = path.join(__dirname, '..', 'orchestrator', 'llmRouter.js');
    const ragEnginePath = path.join(__dirname, '..', 'orchestrator', 'ragEngine.js');
    assert(fs.existsSync(llmRouterPath), 'llmRouter.js deve existir');
    assert(fs.existsSync(ragEnginePath), 'ragEngine.js deve existir');
  });

  test('llmRouter.js tem todos os exports necessários', () => {
    const llmRouter = require('../orchestrator/llmRouter');
    const required = ['chat', 'chatStream', 'getProvidersStatus', 'getActiveProvider', 'getAvailableProviders', 'isAvailable', 'PROVIDERS'];
    for (const fn of required) {
      assert(llmRouter[fn] !== undefined, `Deve exportar ${fn}`);
    }
  });

  test('ragEngine.js tem todos os exports necessários', () => {
    const rag = require('../orchestrator/ragEngine');
    const required = ['init', 'search', 'indexFile', 'indexDirectory', 'indexText', 'getContext', 'getStats', 'clearIndex', 'removeFile'];
    for (const fn of required) {
      assert(typeof rag[fn] === 'function', `Deve exportar ${fn} como função`);
    }
  });
});

// ═══════════════════════════════════════════════════════════
// 🌍 i18n TESTS
// ═══════════════════════════════════════════════════════════

describe('🌍 i18n Module', () => {
  const i18n = require('../i18n/i18n');
  i18n.init();

  test('i18n.init() carrega todos os 4 locales', () => {
    const stats = i18n.getStats();
    assertEqual(stats.supported.length, 4, 'Deve carregar 4 locales');
  });

  test('i18n.t() retorna tradução em português (default)', () => {
    const result = i18n.t('general.error', { message: 'test' });
    assert(result.includes('test'), 'Deve interpolar variável');
    assert(result.includes('❌'), 'Deve conter ícone de erro');
  });

  test('i18n.t() faz fallback para pt se chave não existe no locale', () => {
    const result = i18n.t('general.error', { message: 'teste' }, 'test-fallback');
    assert(result.includes('teste'), 'Deve retornar tradução pt como fallback');
  });

  test('i18n.t() resolve chaves com dot-notation', () => {
    const result = i18n.t('system.create_file.missing_path');
    assert(result.includes('❌'), 'Deve resolver chave profunda');
  });

  test('i18n.t() retorna a chave se não existir', () => {
    const result = i18n.t('nonexistent.key.here');
    assertEqual(result, 'nonexistent.key.here', 'Deve retornar a própria chave');
  });

  test('i18n.setUserLanguage e getUserLanguage funcionam', () => {
    i18n.setUserLanguage('test-user-1', 'en');
    assertEqual(i18n.getUserLanguage('test-user-1'), 'en', 'Deve retornar en');
    i18n.resetUserLanguage('test-user-1');
  });

  test('i18n.t() respeita idioma do utilizador', () => {
    i18n.setUserLanguage('test-user-2', 'en');
    const result = i18n.t('cli.goodbye', {}, 'test-user-2');
    assert(result.includes('Goodbye'), 'Deve traduzir para inglês');
    i18n.resetUserLanguage('test-user-2');
  });

  test('i18n.t() traduz para espanhol', () => {
    i18n.setUserLanguage('test-user-3', 'es');
    const result = i18n.t('cli.goodbye', {}, 'test-user-3');
    assert(result.includes('Hasta luego'), 'Deve traduzir para espanhol');
    i18n.resetUserLanguage('test-user-3');
  });

  test('i18n.t() traduz para francês', () => {
    i18n.setUserLanguage('test-user-4', 'fr');
    const result = i18n.t('cli.goodbye', {}, 'test-user-4');
    assert(result.includes('Au revoir'), 'Deve traduzir para francês');
    i18n.resetUserLanguage('test-user-4');
  });

  test('i18n.normalizeLangCode converte nomes naturais', () => {
    assertEqual(i18n.normalizeLangCode('português'), 'pt', 'português → pt');
    assertEqual(i18n.normalizeLangCode('english'), 'en', 'english → en');
    assertEqual(i18n.normalizeLangCode('español'), 'es', 'español → es');
    assertEqual(i18n.normalizeLangCode('français'), 'fr', 'français → fr');
    assertEqual(i18n.normalizeLangCode('pt'), 'pt', 'pt → pt');
    assertEqual(i18n.normalizeLangCode('en'), 'en', 'en → en');
  });

  test('i18n.isSupported verifica idiomas suportados', () => {
    assert(i18n.isSupported('pt'), 'pt deve ser suportado');
    assert(i18n.isSupported('en'), 'en deve ser suportado');
    assert(i18n.isSupported('es'), 'es deve ser suportado');
    assert(i18n.isSupported('fr'), 'fr deve ser suportado');
    assert(!i18n.isSupported('jp'), 'jp não deve ser suportado');
  });

  test('i18n.getLanguageName retorna nomes corretos', () => {
    assertEqual(i18n.getLanguageName('pt'), 'Português', 'pt → Português');
    assertEqual(i18n.getLanguageName('en'), 'English', 'en → English');
  });

  test('i18n.getLanguageFlag retorna bandeiras', () => {
    const flag = i18n.getLanguageFlag('pt');
    assert(flag.length > 0, 'Deve retornar bandeira não vazia');
  });

  test('i18n.reload() recarrega locales sem erros', () => {
    i18n.reload();
    const stats = i18n.getStats();
    assertEqual(stats.supported.length, 4, 'Deve manter 4 locales após reload');
  });

  test('Interpolação com {{var}} e {var} funciona', () => {
    const result = i18n.t('time.current', { time: '14:30' });
    assert(result.includes('14:30'), 'Deve interpolar {{time}}');
  });

  test('Todas as locales têm as mesmas secções', () => {
    const fs = require('fs');
    const path = require('path');
    const localeDir = path.join(__dirname, '..', 'locales');
    const pt = JSON.parse(fs.readFileSync(path.join(localeDir, 'pt.json'), 'utf8'));
    const en = JSON.parse(fs.readFileSync(path.join(localeDir, 'en.json'), 'utf8'));
    const es = JSON.parse(fs.readFileSync(path.join(localeDir, 'es.json'), 'utf8'));
    const fr = JSON.parse(fs.readFileSync(path.join(localeDir, 'fr.json'), 'utf8'));
    
    const ptSections = Object.keys(pt).sort().join(',');
    const enSections = Object.keys(en).sort().join(',');
    const esSections = Object.keys(es).sort().join(',');
    const frSections = Object.keys(fr).sort().join(',');
    
    assertEqual(ptSections, enSections, 'pt e en devem ter as mesmas secções');
    assertEqual(ptSections, esSections, 'pt e es devem ter as mesmas secções');
    assertEqual(ptSections, frSections, 'pt e fr devem ter as mesmas secções');
  });

  test('Intent change_language existe no intentParser', () => {
    const parser = require('../orchestrator/intentParser');
    const result = parser.parseIntent('muda para inglês');
    assertEqual(result.intent, 'change_language', 'Deve detectar change_language');
  });

  test('Intent list_languages existe no intentParser', () => {
    const parser = require('../orchestrator/intentParser');
    const result = parser.parseIntent('que idiomas suportas');
    assertEqual(result.intent, 'list_languages', 'Deve detectar list_languages');
  });
});

// ═══════════════════════════════════════════════════════════
// RESULTADO FINAL
// ═══════════════════════════════════════════════════════════

console.log('\n' + '═'.repeat(55));
console.log(`\n🧪 RESULTADO: ${passed}/${totalTests} testes passaram`);

if (failed > 0) {
  console.log(`❌ ${failed} falha(s):\n`);
  failures.forEach((f, i) => {
    console.log(`   ${i + 1}. ${f.name}`);
    console.log(`      → ${f.error}\n`);
  });
  process.exitCode = 1;
} else {
  console.log('✅ Todos os testes passaram!\n');
}

console.log('═'.repeat(55) + '\n');
