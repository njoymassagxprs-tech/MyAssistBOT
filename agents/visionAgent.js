/**
 * 👁️ Vision Agent — Captura de Ecrã & Análise por IA
 * 
 * Funcionalidades:
 *   - Captura de ecrã (screenshot) via PowerShell/nativa
 *   - Análise de imagem com Gemini Vision (ou outro LLM com vision)
 *   - OCR de texto visível no ecrã
 *   - Descrição do estado atual do ecrã
 *   - Análise de erros visíveis
 * 
 * Exemplos:
 *   "o que está no meu ecrã?"
 *   "lê o erro que aparece"
 *   "screenshot" / "captura de ecrã"
 *   "analisa esta imagem"
 */

const fs = require('fs');
const path = require('path');
const { execSync, exec } = require('child_process');
const https = require('https');

// ═══════════════════════════════════════════════════════════
//  CONSTANTES
// ═══════════════════════════════════════════════════════════

const TEMP_DIR = path.join(__dirname, '..', 'temp');
const SCREENSHOTS_DIR = path.join(TEMP_DIR, 'screenshots');

// ═══════════════════════════════════════════════════════════
//  CAPTURA DE ECRÃ
// ═══════════════════════════════════════════════════════════

/**
 * Captura screenshot do ecrã completo
 * @returns {{ success: boolean, path?: string, error?: string }}
 */
function captureScreen() {
  ensureDir(SCREENSHOTS_DIR);

  const filename = `screenshot_${Date.now()}.png`;
  const filepath = path.join(SCREENSHOTS_DIR, filename);

  try {
    if (process.platform === 'win32') {
      return captureWindows(filepath);
    } else if (process.platform === 'linux') {
      return captureLinux(filepath);
    } else if (process.platform === 'darwin') {
      return captureMac(filepath);
    } else {
      return { success: false, error: `SO não suportado: ${process.platform}` };
    }
  } catch (err) {
    return { success: false, error: `Erro na captura: ${err.message}` };
  }
}

function captureWindows(filepath) {
  const script = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bitmap = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$bitmap.Save('${filepath.replace(/\\/g, '\\\\')}', [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()
`;

  try {
    execSync(`powershell -NoProfile -Command "${script.replace(/\n/g, ' ')}"`, {
      timeout: 10000,
      windowsHide: true
    });

    if (fs.existsSync(filepath)) {
      return { success: true, path: filepath, size: fs.statSync(filepath).size };
    }
    return { success: false, error: 'Screenshot gerado mas ficheiro não encontrado' };
  } catch (e) {
    return { success: false, error: `PowerShell error: ${e.message}` };
  }
}

function captureLinux(filepath) {
  try {
    // Tentar com diferentes ferramentas
    const tools = [
      `gnome-screenshot -f "${filepath}"`,
      `scrot "${filepath}"`,
      `import -window root "${filepath}"` // ImageMagick
    ];

    for (const cmd of tools) {
      try {
        execSync(cmd, { timeout: 10000 });
        if (fs.existsSync(filepath)) {
          return { success: true, path: filepath, size: fs.statSync(filepath).size };
        }
      } catch {}
    }

    return { success: false, error: 'Nenhuma ferramenta de screenshot encontrada (instala gnome-screenshot ou scrot)' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function captureMac(filepath) {
  try {
    execSync(`screencapture -x "${filepath}"`, { timeout: 10000 });
    if (fs.existsSync(filepath)) {
      return { success: true, path: filepath, size: fs.statSync(filepath).size };
    }
    return { success: false, error: 'Captura falhou' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ═══════════════════════════════════════════════════════════
//  ANÁLISE DE IMAGEM COM IA
// ═══════════════════════════════════════════════════════════

/**
 * Analisa uma imagem usando Gemini Vision
 * @param {string} imagePath - Caminho para a imagem
 * @param {string} prompt - O que perguntar sobre a imagem
 * @returns {Promise<{success: boolean, analysis?: string, error?: string}>}
 */
async function analyzeImage(imagePath, prompt = 'Descreve detalhadamente o que vês nesta imagem.') {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      error: '⚠️ Vision requer GEMINI_API_KEY configurado (Gemini 2.0 Flash suporta visão).\n' +
        'Configura em: https://aistudio.google.com/apikey'
    };
  }

  if (!fs.existsSync(imagePath)) {
    return { success: false, error: `Ficheiro não encontrado: ${imagePath}` };
  }

  try {
    // Ler imagem como base64
    const imageData = fs.readFileSync(imagePath);
    const base64Image = imageData.toString('base64');
    const mimeType = getMimeType(imagePath);

    const response = await callGeminiVision(apiKey, base64Image, mimeType, prompt);

    return {
      success: true,
      analysis: response,
      imagePath
    };
  } catch (err) {
    return { success: false, error: `Erro na análise: ${err.message}` };
  }
}

/**
 * Captura ecrã e analisa com IA em um passo
 */
async function captureAndAnalyze(prompt = 'Descreve o que vês no ecrã. Se houver erros ou avisos, destaca-os.') {
  const capture = captureScreen();

  if (!capture.success) {
    return { success: false, error: `📸 Erro na captura: ${capture.error}` };
  }

  console.log(`[VisionAgent] 📸 Screenshot capturado: ${capture.path} (${formatSize(capture.size)})`);

  const analysis = await analyzeImage(capture.path, prompt);

  // Limpar screenshot temporário após análise
  try { fs.unlinkSync(capture.path); } catch {}

  if (!analysis.success) {
    return analysis;
  }

  return {
    success: true,
    message: `📸 **Análise do Ecrã:**\n\n${analysis.analysis}`
  };
}

/**
 * Analisa imagem fornecida pelo utilizador (upload)
 */
async function analyzeUploadedImage(filePath, question = '') {
  const prompt = question || 'Descreve detalhadamente o que vês nesta imagem. Identifica texto, elementos visuais e contexto.';
  return analyzeImage(filePath, prompt);
}

// ═══════════════════════════════════════════════════════════
//  GEMINI VISION API
// ═══════════════════════════════════════════════════════════

function callGeminiVision(apiKey, base64Image, mimeType, prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Image
            }
          }
        ]
      }],
      generationConfig: {
        temperature: 0.4,
        topP: 0.8,
        maxOutputTokens: 2048
      }
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      port: 443,
      path: `/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 30000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);

          if (json.error) {
            return reject(new Error(json.error.message || 'Gemini API error'));
          }

          const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            resolve(text);
          } else {
            reject(new Error('Resposta vazia do Gemini'));
          }
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(body);
    req.end();
  });
}

// ═══════════════════════════════════════════════════════════
//  OCR SIMPLIFICADO (extrair texto do ecrã)
// ═══════════════════════════════════════════════════════════

/**
 * Captura ecrã e extrai todo o texto visível
 */
async function extractTextFromScreen() {
  const capture = captureScreen();

  if (!capture.success) {
    return { success: false, error: capture.error };
  }

  const prompt = 'Extrai TODO o texto visível nesta imagem, mantendo a formatação original. ' +
    'Não adiciones nenhuma interpretação, apenas transcreve o texto tal como está.';

  const analysis = await analyzeImage(capture.path, prompt);

  try { fs.unlinkSync(capture.path); } catch {}

  return analysis.success
    ? { success: true, text: analysis.analysis }
    : analysis;
}

/**
 * Captura ecrã e identifica erros
 */
async function findScreenErrors() {
  const capture = captureScreen();

  if (!capture.success) {
    return { success: false, error: capture.error };
  }

  const prompt = 'Analisa esta imagem de ecrã e identifica:\n' +
    '1. Erros ou mensagens de erro (em vermelho, popups, etc)\n' +
    '2. Avisos ou warnings\n' +
    '3. Problemas visuais\n\n' +
    'Para cada erro, indica:\n- O texto exato do erro\n- Possível causa\n- Sugestão de solução\n\n' +
    'Se não houver erros visíveis, diz "Nenhum erro visível."';

  const analysis = await analyzeImage(capture.path, prompt);

  try { fs.unlinkSync(capture.path); } catch {}

  return analysis;
}

// ═══════════════════════════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════════════════════════

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getMimeType(filepath) {
  const ext = path.extname(filepath).toLowerCase();
  const types = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp'
  };
  return types[ext] || 'image/png';
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function isAvailable() {
  return !!process.env.GEMINI_API_KEY;
}

function getStats() {
  // Contar screenshots na pasta
  let screenshotCount = 0;
  try {
    if (fs.existsSync(SCREENSHOTS_DIR)) {
      screenshotCount = fs.readdirSync(SCREENSHOTS_DIR).length;
    }
  } catch {}

  return {
    available: isAvailable(),
    provider: 'Gemini Vision',
    screenshotCount,
    platform: process.platform
  };
}

// ═══════════════════════════════════════════════════════════
//  EXPORTS
// ═══════════════════════════════════════════════════════════

module.exports = {
  captureScreen,
  analyzeImage,
  captureAndAnalyze,
  analyzeUploadedImage,
  extractTextFromScreen,
  findScreenErrors,
  isAvailable,
  getStats
};
