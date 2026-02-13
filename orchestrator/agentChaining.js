/**
 * 🔗 Agent Chaining — Execução Multi-Passo Autónoma
 * 
 * Permite que o utilizador peça tarefas compostas:
 *   "Pesquisa sobre React hooks, cria um PDF resumo e envia no Telegram"
 *   → webSearchAgent → pdfAgent → telegram
 * 
 * A IA decompõe o pedido em passos sequenciais.
 * Cada passo executa um agente, passando contexto para o seguinte.
 * 
 * FLUXO:
 * 1. Detectar se é multi-step (vírgulas, "e depois", "e", etc.)
 * 2. IA decompõe em passos com agentes específicos
 * 3. Executar sequencialmente, passando output anterior como contexto
 * 4. Agregar resultados finais
 */

const aiAgent = require('../agents/aiAgent');

// ═══════════════════════════════════════════════════════════
// DETECÇÃO DE BLUEPRINT / PLAN-ONLY
// ═══════════════════════════════════════════════════════════

/**
 * Detecta se o utilizador quer apenas um plano/blueprint sem executar nada
 */
function isBlueprintRequest(message) {
  if (!message) return false;
  const blueprintPatterns = [
    /(?:não|nao|sem)\s+(?:cri(?:a|ar|es)|fazer?|construir?|implementar?)\s+(?:agora|já|ja|ainda|nada)/i,
    /(?:só|apenas|somente)\s+(?:o\s+)?(?:plano|blueprint|estrutura|arquitetura)/i,
    /(?:como\s+(?:ficaria|seria|ficava))/i,
    /(?:planei?a|planear|planifica)\s+(?:uma?\s+)?(?:app|projeto|projecto|site|api)/i,
    /\bblueprint\b/i,
    /\broadmap\b/i,
    /(?:testa(?:r)?|simula(?:r)?)\s+como\s+(?:seria|ficaria)/i
  ];
  return blueprintPatterns.some(p => p.test(message));
}

// ═══════════════════════════════════════════════════════════
// DETECÇÃO
// ═══════════════════════════════════════════════════════════

/**
 * Detecta se a mensagem pede múltiplas ações
 */
function isMultiStep(message) {
  if (!message || message.length < 15) return false;
  
  // NÃO tratar como multi-step se é blueprint/planeamento
  if (isBlueprintRequest(message)) return false;
  
  const multiStepPatterns = [
    // Conectores explícitos
    /(?:e\s+depois|depois|em\s+seguida|a\s+seguir)\s+/i,
    /(?:then|and\s+then|after\s+that|next)\s+/i,
    // Duas ou mais ações separadas por vírgula/e
    /(?:cria|faz|gera|pesquisa|abre|executa|lista|digita|envia).+(?:,\s*e?\s*|;\s*|\s+e\s+)(?:cria|faz|gera|pesquisa|abre|executa|lista|digita|envia)/i,
    // Padrões numerados
    /(?:1\s*[\.\):]|primeiro).+(?:2\s*[\.\):]|segundo|depois)/i
  ];

  return multiStepPatterns.some(p => p.test(message));
}

// ═══════════════════════════════════════════════════════════
// DECOMPOSIÇÃO VIA IA
// ═══════════════════════════════════════════════════════════

const DECOMPOSE_PROMPT = `És o motor de planeamento de um assistente IA. O utilizador fez um pedido com MÚLTIPLAS ações.

Decompõe o pedido numa lista de passos sequenciais. Retorna APENAS um JSON array (sem markdown).

Agentes disponíveis:
- "ai_chat": perguntar algo à IA, gerar texto, explicar, resumir, responder questões
- "web_search": pesquisar na internet (dados reais, preços, notícias)
- "create_pdf": criar documento PDF
- "create_file": criar ficheiro (precisa de path e content)
- "run_code": executar código JavaScript
- "system_open_app": abrir programa
- "system_open_url": abrir website
- "system_execute": executar comando do sistema
- "screenshot": captura de ecrã
- "type_text": digitar texto
- "shortcut": atalho de teclado

Formato de cada passo:
{ "step": 1, "agent": "nome_agente", "action": "descrição curta e concreta", "input": "o que enviar ao agente — texto concreto, sem referências vagas", "usePreviousOutput": false }

Se um passo precisa do resultado do anterior, põe "usePreviousOutput": true e em "input" descreve concretamente como usar (ex: "Cria PDF com o resumo sobre React hooks").

REGRAS CRÍTICAS:
1. Máximo 5 passos
2. Ordem lógica (pesquisa antes de criar PDF, etc.)
3. Cada passo é UMA ação atómica
4. NUNCA uses "input" vago como "output do passo anterior" ou "resultado do passo X" — sê concreto sobre o que o agente deve fazer
5. Se o utilizador diz "não criar agora", "como ficaria", "só planear", "blueprint" → retorna UM ÚNICO passo com "ai_chat" que gera um plano textual detalhado. NÃO decompor em vários passos de criação.
6. Se o pedido é ambíguo ou falta informação essencial → o PRIMEIRO passo deve ser "ai_chat" a pedir esclarecimento ao utilizador
7. Se um passo falha, os seguintes que dependem dele também falharão — ordena para minimizar dependências
8. Retorna APENAS o JSON array — nada mais

PEDIDO: `;

/**
 * Usa IA para decompor pedido em passos
 */
async function decompose(message) {
  if (!aiAgent.isAvailable()) {
    return null;
  }

  try {
    const response = await aiAgent.askAI(DECOMPOSE_PROMPT + message, [], {
      maxTokens: 800,
      temperature: 0.2,
      system: 'Responde APENAS com JSON array válido. Sem markdown, sem explicação.'
    });

    // Extrair JSON
    const steps = extractJSON(response);
    
    if (!Array.isArray(steps) || steps.length === 0) {
      return null;
    }

    // Validar e limitar
    const validated = steps
      .slice(0, 5)
      .map((s, i) => ({
        step: i + 1,
        agent: s.agent || 'ai_chat',
        action: s.action || `Passo ${i + 1}`,
        input: s.input || '',
        usePreviousOutput: !!s.usePreviousOutput
      }));

    return validated;

  } catch (error) {
    console.error('❌ Chaining decompose error:', error.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// EXECUÇÃO
// ═══════════════════════════════════════════════════════════

/**
 * Executa um chain de agentes sequencialmente
 * @param {Array} steps - Passos decompostos
 * @param {Function} executeStep - Função que executa um passo individual (recebe agent, input)
 * @param {Function} onProgress - Callback de progresso (step, total, action)
 * @param {Object} options - { failFast: true } para parar no primeiro erro
 * @returns {Object} Resultado agregado
 */
async function executeChain(steps, executeStep, onProgress, options = {}) {
  const results = [];
  let previousOutput = '';
  let allSuccess = true;
  const failFast = options.failFast !== false; // fail-fast por defeito

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    
    // Callback de progresso
    if (onProgress) {
      onProgress(i + 1, steps.length, step.action);
    }

    // Preparar input (pode usar output anterior)
    let input = step.input;
    if (step.usePreviousOutput && previousOutput) {
      input = `${step.input}\n\nContexto do passo anterior:\n${previousOutput}`;
    }

    try {
      console.log(`  🔗 [${i + 1}/${steps.length}] ${step.agent}: ${step.action}`);
      
      const result = await executeStep(step.agent, input);
      
      results.push({
        step: i + 1,
        agent: step.agent,
        action: step.action,
        success: true,
        output: typeof result === 'string' ? result : (result?.response || result?.output || JSON.stringify(result))
      });

      // Guardar output para o próximo passo
      previousOutput = results[results.length - 1].output;

    } catch (error) {
      console.error(`  ❌ Passo ${i + 1} falhou:`, error.message);
      
      results.push({
        step: i + 1,
        agent: step.agent,
        action: step.action,
        success: false,
        error: error.message
      });

      allSuccess = false;
      
      // Fail-fast: parar se activado e o próximo passo depende deste
      if (failFast) {
        const remaining = steps.slice(i + 1);
        const dependentExists = remaining.some(s => s.usePreviousOutput);
        if (dependentExists) {
          console.log(`  ⛔ Fail-fast: passos dependentes não serão executados`);
          // Marcar passos restantes como cancelados
          remaining.forEach((s, j) => {
            results.push({
              step: i + 2 + j,
              agent: s.agent,
              action: s.action,
              success: false,
              error: `Cancelado — passo ${i + 1} falhou`
            });
          });
          break;
        }
      }
    }

    // Pausa entre passos (rate limiting)
    if (i < steps.length - 1) {
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  return {
    success: allSuccess,
    totalSteps: steps.length,
    completedSteps: results.filter(r => r.success).length,
    results
  };
}

/**
 * Formata resultado de um chain para mostrar ao utilizador
 */
function formatChainResult(chainResult) {
  let output = `🔗 **Execução Multi-Passo** (${chainResult.completedSteps}/${chainResult.totalSteps} ✅)\n\n`;

  chainResult.results.forEach(r => {
    const icon = r.success ? '✅' : '❌';
    output += `${icon} **Passo ${r.step}:** ${r.action}\n`;
    
    if (r.success && r.output) {
      // Truncar outputs longos
      const truncated = r.output.length > 300 
        ? r.output.substring(0, 300) + '...' 
        : r.output;
      output += `   ${truncated}\n\n`;
    } else if (r.error) {
      output += `   Erro: ${r.error}\n\n`;
    }
  });

  // Último output completo (resultado final principal)
  const lastSuccess = [...chainResult.results].reverse().find(r => r.success);
  if (lastSuccess && lastSuccess.output && lastSuccess.output.length > 300) {
    output += `---\n📋 **Resultado Final:**\n${lastSuccess.output}\n`;
  }

  return output;
}

/**
 * Formata preview do plano antes de executar
 */
function formatChainPlan(steps) {
  let output = `🔗 **Plano Multi-Passo** (${steps.length} passos)\n\n`;
  
  const agentIcons = {
    'ai_chat': '🧠', 'web_search': '🔍', 'create_pdf': '📄',
    'create_file': '📁', 'run_code': '💻', 'system_open_app': '🖥️',
    'system_open_url': '🌐', 'system_execute': '⚙️',
    'screenshot': '📸', 'type_text': '⌨️', 'shortcut': '⌨️'
  };

  steps.forEach(s => {
    const icon = agentIcons[s.agent] || '🔹';
    const chain = s.usePreviousOutput ? ' ← (usa resultado anterior)' : '';
    output += `${icon} **${s.step}.** ${s.action}${chain}\n`;
  });

  return output;
}

// ═══════════════════════════════════════════════════════════
// UTILITÁRIOS
// ═══════════════════════════════════════════════════════════

function extractJSON(text) {
  try { return JSON.parse(text.trim()); } catch {}
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) { try { return JSON.parse(match[1].trim()); } catch {} }
  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (arrMatch) { try { return JSON.parse(arrMatch[0]); } catch {} }
  return null;
}

module.exports = {
  isMultiStep,
  isBlueprintRequest,
  decompose,
  executeChain,
  formatChainResult,
  formatChainPlan
};
