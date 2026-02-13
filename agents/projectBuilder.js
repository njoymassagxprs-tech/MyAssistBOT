/**
 * 🏗️ Project Builder Agent - Cria projetos completos via IA
 * 
 * Recebe uma descrição em linguagem natural e:
 * 1. Usa IA para decompor em estrutura de ficheiros
 * 2. Gera código de cada ficheiro com IA
 * 3. Cria tudo no sistema de ficheiros
 * 4. Opcionalmente executa setup (npm install, etc.)
 * 
 * EXEMPLO:
 *   "Cria uma app de tarefas em React com Express backend"
 *   → Gera 10-15 ficheiros, package.json, README, etc.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const aiAgent = require('./aiAgent');
const systemAgent = require('./systemAgent');

// Pasta base para projetos criados
const PROJECTS_DIR = path.join(process.cwd(), 'outputs', 'projects');

// Garantir pasta
if (!fs.existsSync(PROJECTS_DIR)) {
  fs.mkdirSync(PROJECTS_DIR, { recursive: true });
}

// ═══════════════════════════════════════════════════════════
// TEMPLATES DE PROMPT PARA A IA
// ═══════════════════════════════════════════════════════════

const PLAN_PROMPT = `És um arquiteto de software sénior. O utilizador quer criar um projeto.

TAREFA: Analisa o pedido e retorna um plano em formato JSON PURO (sem markdown, sem \`\`\`).

O JSON deve ter esta estrutura EXATA:
{
  "name": "nome-do-projeto",
  "description": "descrição curta",
  "tech": ["tecnologia1", "tecnologia2"],
  "files": [
    {
      "path": "caminho/relativo/ficheiro.ext",
      "description": "o que este ficheiro faz",
      "type": "config|component|page|api|style|util|test|doc"
    }
  ],
  "setupCommands": ["npm install", "..."],
  "runCommand": "npm start"
}

REGRAS:
- Inclui TODOS os ficheiros necessários (package.json, README.md, .gitignore, etc.)
- Paths relativos à raiz do projeto
- Máximo 20 ficheiros (prioriza os essenciais)
- Usa tecnologias modernas e boas práticas
- Inclui um README.md com instruções

PEDIDO DO UTILIZADOR: `;

const CODE_PROMPT = `És um programador sénior. Gera o conteúdo COMPLETO do ficheiro descrito abaixo.

PROJETO: {projectName}
DESCRIÇÃO DO PROJETO: {projectDescription}
TECNOLOGIAS: {tech}

FICHEIRO: {filePath}
PROPÓSITO: {fileDescription}
TIPO: {fileType}

REGRAS:
- Retorna APENAS o conteúdo do ficheiro, sem explicações
- Sem blocos markdown (\`\`\`)
- Código funcional, sem placeholders ou TODO
- Usa as melhores práticas da linguagem
- Inclui comentários úteis em português
- Se for package.json, inclui todas as dependências necessárias

CONTEÚDO DO FICHEIRO:`;

const BLUEPRINT_PROMPT = `És um arquiteto de software sénior e consultor técnico. O utilizador quer um BLUEPRINT detalhado de um projeto — um plano completo SEM gerar código.

TAREFA: Analisa o pedido e cria um blueprint profissional em formato Markdown.

O blueprint DEVE incluir estas secções:

## 1. Visão Geral
- Nome sugerido para o projeto
- Descrição do objetivo
- Público-alvo

## 2. Requisitos Funcionais
- Lista de features principais (numeradas)
- Para cada feature: descrição curta, prioridade (Alta/Média/Baixa)

## 3. Requisitos Não-Funcionais
- Performance, segurança, escalabilidade, acessibilidade

## 4. Arquitetura Técnica
- Stack recomendada (frontend, backend, base de dados)
- Diagrama de componentes (em texto)
- Padrões de design sugeridos

## 5. Estrutura de Ficheiros
- Árvore de diretórios proposta
- Descrição de cada ficheiro/pasta principal

## 6. Modelo de Dados
- Entidades principais e relações
- Campos de cada entidade

## 7. Endpoints / Rotas
- Lista de endpoints API ou rotas de páginas

## 8. Critérios de Teste
- O que testar (unitário, integração, e2e)
- Cenários de teste prioritários

## 9. Roadmap de Implementação
- Fases de desenvolvimento (1-3)
- Estimativa de complexidade

## 10. Restrições e Decisões
- Limitações conhecidas
- Decisões técnicas tomadas e porquê

REGRAS:
- NÃO geres código — apenas o plano
- Sê específico e detalhado
- Usa Markdown formatado
- Adapta a complexidade ao tamanho do projeto
- Se faltam detalhes no pedido, faz suposições razoáveis e documenta-as

PEDIDO DO UTILIZADOR: `;

// ═══════════════════════════════════════════════════════════
// FUNÇÕES PRINCIPAIS
// ═══════════════════════════════════════════════════════════

/**
 * Planifica um projeto (passo 1)
 * Retorna o plano sem criar nada
 */
async function planProject(description) {
  if (!aiAgent.isAvailable()) {
    return { success: false, error: '⚠️ IA não disponível. Configura GROQ_API_KEY.' };
  }

  console.log(`🏗️ A planificar projeto: "${description}"`);

  try {
    const response = await aiAgent.askAI(PLAN_PROMPT + description, [], {
      maxTokens: 2048,
      temperature: 0.4,
      system: 'És um arquiteto de software. Responde APENAS com JSON válido, sem markdown.'
    });

    // Extrair JSON da resposta
    const plan = extractJSON(response);
    
    if (!plan || !plan.files || !Array.isArray(plan.files)) {
      return { 
        success: false, 
        error: '❌ A IA não retornou um plano válido. Tenta reformular o pedido.',
        raw: response
      };
    }

    // Sanitizar nome do projeto
    plan.name = sanitizeName(plan.name || 'meu-projeto');
    
    // Validar
    if (plan.files.length === 0) {
      return { success: false, error: '❌ O plano não contém ficheiros.' };
    }
    if (plan.files.length > 25) {
      plan.files = plan.files.slice(0, 25);
    }

    console.log(`📋 Plano criado: ${plan.files.length} ficheiros`);
    
    return {
      success: true,
      plan,
      summary: formatPlanSummary(plan)
    };

  } catch (error) {
    console.error('❌ Erro ao planificar:', error.message);
    return { success: false, error: `❌ Erro: ${error.message}` };
  }
}

/**
 * Gera um blueprint detalhado (plano profissional) SEM criar código
 * Retorna Markdown com arquitetura, features, testes, roadmap
 */
async function generateBlueprint(description) {
  if (!aiAgent.isAvailable()) {
    return { success: false, error: '⚠️ IA não disponível. Configura GROQ_API_KEY.' };
  }

  console.log(`📐 A gerar blueprint: "${description}"`);

  try {
    const response = await aiAgent.askAI(BLUEPRINT_PROMPT + description, [], {
      maxTokens: 4096,
      temperature: 0.4,
      system: 'És um arquiteto de software sénior. Gera um blueprint profissional completo em Markdown. NÃO geres código.'
    });

    if (!response || response.trim().length < 100) {
      return {
        success: false,
        error: '❌ A IA não retornou um blueprint válido. Tenta reformular o pedido.'
      };
    }

    // Limpar possíveis artefactos markdown (``` no início/fim)
    const cleanBlueprint = response
      .replace(/^```(?:markdown|md)?\n?/, '')
      .replace(/\n?```\s*$/, '')
      .trim();

    console.log(`📐 Blueprint gerado: ${cleanBlueprint.length} caracteres`);

    return {
      success: true,
      blueprint: cleanBlueprint,
      summary: formatBlueprintSummary(cleanBlueprint, description)
    };

  } catch (error) {
    console.error('❌ Erro ao gerar blueprint:', error.message);
    return { success: false, error: `❌ Erro: ${error.message}` };
  }
}

/**
 * Formata resumo do blueprint para mostrar ao utilizador
 */
function formatBlueprintSummary(blueprint, description) {
  let summary = `📐 **Blueprint Gerado**\n`;
  summary += `📝 Pedido: _${description}_\n\n`;
  summary += `---\n\n`;
  summary += blueprint;
  summary += `\n\n---\n`;
  summary += `💬 Gostaste do blueprint? Diz **"criar projeto"** para eu construí-lo, ou pede-me para ajustar algo.`;
  
  return summary;
}

/**
 * Constrói o projeto (passo 2)
 * Cria todos os ficheiros com código gerado por IA
 */
async function buildProject(plan, options = {}) {
  if (!aiAgent.isAvailable()) {
    return { success: false, error: '⚠️ IA não disponível.' };
  }

  const projectDir = path.join(
    options.targetDir || PROJECTS_DIR, 
    plan.name
  );

  // Verificar se já existe
  if (fs.existsSync(projectDir) && !options.overwrite) {
    return { 
      success: false, 
      error: `❌ Pasta já existe: ${projectDir}\nUsa "substituir" para sobrescrever.`
    };
  }

  console.log(`🔨 A construir projeto em: ${projectDir}`);

  // Criar pasta raiz
  fs.mkdirSync(projectDir, { recursive: true });

  const results = {
    success: true,
    projectDir,
    filesCreated: [],
    filesFailed: [],
    totalFiles: plan.files.length
  };

  // Gerar e criar cada ficheiro
  for (let i = 0; i < plan.files.length; i++) {
    const file = plan.files[i];
    const filePath = path.join(projectDir, file.path);
    
    console.log(`  📄 [${i + 1}/${plan.files.length}] ${file.path}`);

    try {
      // Gerar conteúdo com IA
      const prompt = CODE_PROMPT
        .replace('{projectName}', plan.name)
        .replace('{projectDescription}', plan.description)
        .replace('{tech}', (plan.tech || []).join(', '))
        .replace('{filePath}', file.path)
        .replace('{fileDescription}', file.description)
        .replace('{fileType}', file.type);

      const content = await aiAgent.askAI(prompt, [], {
        maxTokens: 4096,
        temperature: 0.3,
        system: 'És um programador. Retorna APENAS o conteúdo do ficheiro, sem explicações nem blocos markdown.'
      });

      // Limpar possíveis blocos markdown da resposta
      const cleanContent = cleanCodeResponse(content, file.path);

      // Criar diretório pai se necessário
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Escrever ficheiro
      fs.writeFileSync(filePath, cleanContent, 'utf8');
      
      results.filesCreated.push({
        path: file.path,
        size: cleanContent.length,
        description: file.description
      });

    } catch (error) {
      console.error(`  ❌ Erro em ${file.path}:`, error.message);
      results.filesFailed.push({
        path: file.path,
        error: error.message
      });
    }

    // Pausa entre chamadas à API (rate limit Groq: 30/min)
    if (i < plan.files.length - 1) {
      await sleep(2200);
    }
  }

  // Resumo
  if (results.filesFailed.length > 0) {
    results.success = results.filesCreated.length > 0;
  }

  console.log(`✅ Projeto criado: ${results.filesCreated.length}/${results.totalFiles} ficheiros`);

  return results;
}

/**
 * Fluxo completo: planifica + constrói
 */
async function createProject(description, options = {}) {
  // Passo 1: Planificar
  const planResult = await planProject(description);
  if (!planResult.success) {
    return planResult;
  }

  // Se só quer o plano (preview)
  if (options.planOnly) {
    return planResult;
  }

  // Passo 2: Construir
  const buildResult = await buildProject(planResult.plan, options);
  
  return {
    ...buildResult,
    plan: planResult.plan,
    summary: planResult.summary
  };
}

// ═══════════════════════════════════════════════════════════
// UTILITÁRIOS
// ═══════════════════════════════════════════════════════════

/**
 * Extrai JSON de texto (a IA pode envolver em markdown)
 */
function extractJSON(text) {
  // Tentar parse direto
  try {
    return JSON.parse(text.trim());
  } catch {}

  // Tentar extrair de bloco markdown
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) {
    try {
      return JSON.parse(match[1].trim());
    } catch {}
  }

  // Tentar encontrar { ... } no texto
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {}
  }

  return null;
}

/**
 * Limpa resposta de código (remove markdown wrapping)
 */
function cleanCodeResponse(content, filePath) {
  let clean = content;

  // Detectar extensão para saber a linguagem
  const ext = path.extname(filePath).toLowerCase();
  
  // Remover blocos markdown ```lang ... ```
  const blockMatch = clean.match(/^```\w*\n([\s\S]*?)```\s*$/);
  if (blockMatch) {
    clean = blockMatch[1];
  }

  // Remover ``` no início/fim se houver
  clean = clean.replace(/^```\w*\n?/, '').replace(/\n?```\s*$/, '');

  return clean.trim() + '\n';
}

/**
 * Sanitiza nome de projeto para usar como pasta
 */
function sanitizeName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_\-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50) || 'meu-projeto';
}

/**
 * Formata resumo do plano para mostrar ao utilizador
 */
function formatPlanSummary(plan) {
  let summary = `🏗️ **Plano do Projeto: ${plan.name}**\n`;
  summary += `📝 ${plan.description}\n`;
  summary += `🔧 Tecnologias: ${(plan.tech || []).join(', ')}\n\n`;
  
  summary += `📁 **Ficheiros (${plan.files.length}):**\n`;
  plan.files.forEach((f, i) => {
    const icon = getFileIcon(f.path);
    summary += `  ${icon} ${f.path} — ${f.description}\n`;
  });

  if (plan.setupCommands?.length > 0) {
    summary += `\n⚙️ **Setup:** ${plan.setupCommands.join(' → ')}\n`;
  }
  if (plan.runCommand) {
    summary += `🚀 **Executar:** ${plan.runCommand}\n`;
  }

  summary += `\n💬 Diz **"sim"** ou **"criar"** para construir o projeto.`;
  
  return summary;
}

/**
 * Ícone baseado na extensão do ficheiro
 */
function getFileIcon(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const name = path.basename(filePath).toLowerCase();
  
  if (name === 'package.json') return '📦';
  if (name === 'readme.md') return '📖';
  if (name === '.gitignore') return '🙈';
  if (name === '.env' || name === '.env.example') return '🔐';
  if (name === 'dockerfile') return '🐳';
  
  const icons = {
    '.js': '📜', '.ts': '📘', '.jsx': '⚛️', '.tsx': '⚛️',
    '.html': '🌐', '.css': '🎨', '.scss': '🎨',
    '.json': '📋', '.yaml': '📋', '.yml': '📋',
    '.md': '📝', '.txt': '📄',
    '.py': '🐍', '.rb': '💎', '.go': '🔵',
    '.sql': '🗃️', '.sh': '⚙️', '.bat': '⚙️',
    '.png': '🖼️', '.jpg': '🖼️', '.svg': '🖼️',
    '.test.js': '🧪', '.spec.js': '🧪'
  };
  
  return icons[ext] || '📄';
}

/**
 * Formata resultado de build para mostrar ao utilizador
 */
function formatBuildResult(result) {
  if (!result.success && result.error) {
    return result.error;
  }

  let output = `✅ **Projeto Criado!**\n`;
  output += `📁 Local: ${result.projectDir}\n\n`;
  
  output += `📄 **Ficheiros criados (${result.filesCreated.length}/${result.totalFiles}):**\n`;
  result.filesCreated.forEach(f => {
    output += `  ✅ ${f.path} (${f.size} bytes)\n`;
  });

  if (result.filesFailed.length > 0) {
    output += `\n❌ **Falhas (${result.filesFailed.length}):**\n`;
    result.filesFailed.forEach(f => {
      output += `  ❌ ${f.path}: ${f.error}\n`;
    });
  }

  if (result.plan?.setupCommands?.length > 0) {
    output += `\n⚙️ **Próximo passo:** Executa na pasta do projeto:\n`;
    output += `  cd ${result.projectDir}\n`;
    result.plan.setupCommands.forEach(cmd => {
      output += `  ${cmd}\n`;
    });
  }

  return output;
}

/**
 * Lista projetos criados
 */
function listProjects() {
  if (!fs.existsSync(PROJECTS_DIR)) return [];
  
  return fs.readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => {
      const projPath = path.join(PROJECTS_DIR, d.name);
      const pkgPath = path.join(projPath, 'package.json');
      let description = '';
      
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
          description = pkg.description || '';
        } catch {}
      }
      
      const files = countFiles(projPath);
      
      return {
        name: d.name,
        path: projPath,
        description,
        files,
        created: fs.statSync(projPath).birthtime
      };
    })
    .sort((a, b) => b.created - a.created);
}

/**
 * Conta ficheiros recursivamente
 */
function countFiles(dir) {
  let count = 0;
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      if (item.name === 'node_modules' || item.name === '.git') continue;
      if (item.isDirectory()) {
        count += countFiles(path.join(dir, item.name));
      } else {
        count++;
      }
    }
  } catch {}
  return count;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  planProject,
  buildProject,
  createProject,
  generateBlueprint,
  listProjects,
  formatPlanSummary,
  formatBuildResult,
  PROJECTS_DIR
};
