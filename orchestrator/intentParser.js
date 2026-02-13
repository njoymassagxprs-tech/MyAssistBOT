/**
 * 🎯 Intent Parser - Analisa intenções de mensagens
 * 
 * Identifica o que o utilizador quer fazer baseado em palavras-chave
 */

/**
 * Padrões de intenção
 */
const INTENT_PATTERNS = {
  create_pdf: {
    patterns: [
      /cri(?:a|ar)\s+(?:um\s+)?pdf/i,
      /gerar?\s+pdf/i,
      /fazer?\s+pdf/i,
      /pdf\s+sobre/i,
      /documento\s+pdf/i
    ],
    extract: (text) => {
      const match = text.match(/(?:pdf|documento)\s+(?:sobre|de|com)?\s*(.+)/i);
      return { topic: match?.[1]?.trim() || text };
    }
  },
  
  create_note: {
    patterns: [
      /cri(?:a|ar)\s+nota/i,
      /nota\s+(?:sobre|de|com)/i,
      /guardar?\s+nota/i,
      /escrever?\s+nota/i
    ],
    extract: (text) => {
      const match = text.match(/nota\s+(?:sobre|de|com|:)?\s*(.+)/i);
      return { content: match?.[1]?.trim() || text };
    }
  },
  
  run_code: {
    patterns: [
      /execut(?:a|ar)\s*:/i,
      /run\s*:/i,
      /código\s*:/i,
      /^console\./,
      /^Math\./,
      /^(?:const|let|var)\s+/
    ],
    extract: (text) => {
      return { code: text };
    }
  },
  
  list_files: {
    patterns: [
      /list(?:a|ar)\s+ficheiros/i,
      /ver\s+ficheiros/i,
      /mostrar?\s+ficheiros/i,
      /ficheiros\s+disponíveis/i,
      /que\s+ficheiros/i
    ],
    extract: () => ({})
  },
  
  system_info: {
    patterns: [
      /info(?:rmação)?\s+(?:do\s+)?sistema/i,
      /estado\s+(?:do\s+)?sistema/i,
      /status/i,
      /\/status/
    ],
    extract: () => ({})
  },
  
  help: {
    patterns: [
      /ajuda/i,
      /help/i,
      /\/help/,
      /comandos?\s+disponíveis/i,
      /o\s+que\s+(?:podes|consegues)\s+fazer/i
    ],
    extract: () => ({})
  },
  
  agents_list: {
    patterns: [
      /\/agents/,
      /listar?\s+agentes/i,
      /quais?\s+agentes/i,
      /agentes\s+disponíveis/i
    ],
    extract: () => ({})
  },
  
  current_time: {
    patterns: [
      /que\s+horas?\s+(?:são|s[aã]o|é|e)/i,
      /hora(?:s)?\s+(?:atual|atuais|agora|certa|certas)/i,
      /diz(?:-me)?\s+(?:as?\s+)?horas?/i,
      /mostra(?:-me)?\s+(?:as?\s+)?horas?/i,
      /qual\s+(?:é\s+)?(?:a\s+)?hora(?:\s+atual)?/i,
      /^horas?\??$/i,
      /^hora actual\??$/i,
      /what\s+time\s+is\s+it/i,
      /current\s+time/i,
      /^que\s+horas\??$/i,
      /horas?\s+por\s+favor/i,
      /agora\s+(?:são\s+)?que\s+horas/i
    ],
    extract: () => ({})
  },
  
  current_date: {
    patterns: [
      /que\s+dia\s+(?:é|e|hoje)/i,
      /qual\s+(?:é\s+)?(?:a\s+)?data/i,
      /data\s+(?:atual|de\s+hoje)/i,
      /hoje\s+(?:é\s+)?que\s+dia/i,
      /diz(?:-me)?\s+(?:a\s+)?data/i,
      /what\s+date\s+is\s+it/i,
      /what(?:'s|\s+is)\s+(?:the\s+)?date/i,
      /^que\s+dia\??$/i,
      /^data\??$/i
    ],
    extract: () => ({})
  },
  
  // ═══════════════════════════════════════════════════════════
  // SYSTEM CONTROLLER (Nível 1)
  // ═══════════════════════════════════════════════════════════
  
  system_create_file: {
    patterns: [
      /cri(?:a|ar)\s+(?:um\s+)?ficheiro\s+(.+)/i,
      /cri(?:a|ar)\s+(?:um\s+)?arquivo\s+(.+)/i,
      /criar\s+file\s+(.+)/i,
      /novo\s+ficheiro\s+(.+)/i
    ],
    extract: (text) => {
      // "cria ficheiro teste.txt com olá mundo"
      const match = text.match(/ficheiro\s+([^\s]+)\s+(?:com|contendo|:)\s*(.+)/i) ||
                    text.match(/arquivo\s+([^\s]+)\s+(?:com|contendo|:)\s*(.+)/i);
      if (match) {
        return { path: match[1], content: match[2] };
      }
      // "cria ficheiro teste.txt"
      const simpleMatch = text.match(/(?:ficheiro|arquivo|file)\s+([^\s]+)/i);
      return { path: simpleMatch?.[1] || 'novo_ficheiro.txt', content: '' };
    }
  },
  
  system_read_file: {
    patterns: [
      /l(?:ê|e)\s+(?:o\s+)?ficheiro\s+(.+)/i,
      /mostra(?:r)?\s+(?:conteúdo\s+(?:do|de)\s+)?ficheiro\s+(.+)/i,
      /abre?\s+(?:o\s+)?ficheiro\s+(.+)/i,
      /ver\s+(?:o\s+)?ficheiro\s+(.+)/i,
      /cat\s+(.+)/i
    ],
    extract: (text) => {
      const match = text.match(/(?:ficheiro|arquivo|file)\s+([^\s]+)/i) ||
                    text.match(/cat\s+([^\s]+)/i);
      return { path: match?.[1] || '' };
    }
  },
  
  system_edit_file: {
    patterns: [
      /edit(?:a|ar)\s+(?:o\s+)?ficheiro\s+(.+)/i,
      /adiciona(?:r)?\s+(.+)\s+(?:ao|no)\s+ficheiro\s+(.+)/i,
      /escreve(?:r)?\s+(.+)\s+(?:no|em)\s+ficheiro\s+(.+)/i,
      /append\s+(.+)\s+to\s+(.+)/i
    ],
    extract: (text) => {
      // "adiciona linha nova ao ficheiro notas.txt"
      const appendMatch = text.match(/adiciona(?:r)?\s+(.+)\s+(?:ao|no)\s+ficheiro\s+([^\s]+)/i) ||
                          text.match(/escreve(?:r)?\s+(.+)\s+(?:no|em)\s+ficheiro\s+([^\s]+)/i);
      if (appendMatch) {
        return { content: appendMatch[1], path: appendMatch[2], mode: 'append' };
      }
      // "edita ficheiro X"
      const editMatch = text.match(/(?:ficheiro|arquivo)\s+([^\s]+)/i);
      return { path: editMatch?.[1] || '', content: '', mode: 'append' };
    }
  },
  
  system_list_dir: {
    patterns: [
      /lista(?:r)?\s+(?:os\s+)?(?:a\s+)?(?:ficheiros|arquivos|pasta|diretório)/i,
      /mostra(?:r)?\s+(?:os\s+)?(?:a\s+)?(?:ficheiros|arquivos|pasta)/i,
      /ver\s+(?:os\s+)?(?:a\s+)?(?:ficheiros|arquivos|pasta)/i,
      /(?:o\s+)?que\s+(?:há|tem)\s+(?:na|em|aqui)/i,
      /(?:o\s+)?que\s+(?:há|tem)\s+nesta?\s+pasta/i,
      /^ls\s*(.+)?/i,
      /^dir\s*(.+)?/i,
      /ficheiros\s+(?:na|em|aqui)/i,
      /(?:lista|mostra)\s+aqui/i
    ],
    extract: (text) => {
      const match = text.match(/(?:pasta|diretório|folder|em|na)\s+([^\s]+)/i) ||
                    text.match(/(?:ls|dir)\s+([^\s]+)/i);
      return { path: match?.[1] || '.' };
    }
  },
  
  system_open_folder: {
    patterns: [
      /abre?\s+(?:a\s+)?pasta\s+(.+)/i,
      /abrir\s+(?:a\s+)?pasta\s+(.+)/i,
      /open\s+(?:folder\s+)?(.+)/i,
      /explorer\s+(.+)/i
    ],
    extract: (text) => {
      const match = text.match(/(?:pasta|folder|diretório)\s+([^\s]+)/i) ||
                    text.match(/(?:explorer|open)\s+([^\s]+)/i);
      return { path: match?.[1] || 'Downloads' };
    }
  },
  
  system_execute: {
    patterns: [
      /executa(?:r)?\s*:\s*(.+)/i,
      /run\s*:\s*(.+)/i,
      /comando\s*:\s*(.+)/i,
      /cmd\s*:\s*(.+)/i,
      /terminal\s*:\s*(.+)/i
    ],
    extract: (text) => {
      const match = text.match(/(?:executa(?:r)?|run|comando|cmd|terminal)\s*:\s*(.+)/i);
      return { command: match?.[1]?.trim() || '' };
    }
  },
  
  system_run_script: {
    patterns: [
      /corre(?:r)?\s+(?:o\s+)?script\s+(.+)/i,
      /executa(?:r)?\s+(?:o\s+)?script\s+(.+)/i,
      /run\s+script\s+(.+)/i
    ],
    extract: (text) => {
      const match = text.match(/script\s+([^\s]+)/i);
      return { path: match?.[1] || '' };
    }
  },

  // ═══════════════════════════════════════════════════════════
  // LEVEL 2 - APLICAÇÕES, PROCESSOS, JANELAS
  // ═══════════════════════════════════════════════════════════
  
  system_open_app: {
    patterns: [
      /abre?\s+(?:o\s+)?(?:programa|app|aplicação|aplicativo)\s+(.+)/i,
      /abrir\s+(?:o\s+)?(?:programa|app|aplicação)\s+(.+)/i,
      /abre?\s+(?:o\s+)?(notepad|chrome|firefox|edge|vscode|code|terminal|calculadora|word|excel|spotify|discord)/i,
      /inicia(?:r)?\s+(?:o\s+)?(.+)/i,
      /launch\s+(.+)/i,
      /open\s+(?:app\s+)?(.+)/i,
      /start\s+(.+)/i
    ],
    extract: (text) => {
      const match = text.match(/(?:abre?|abrir|inicia|launch|open|start)\s+(?:o\s+)?(?:programa|app|aplicação|aplicativo)?\s*(.+)/i);
      return { app: match?.[1]?.trim() || '' };
    }
  },
  
  system_open_url: {
    patterns: [
      /abre?\s+(?:o\s+)?(?:site|url|link|página)\s+(.+)/i,
      /abrir\s+(?:o\s+)?(?:site|url|link)\s+(.+)/i,
      /vai?\s+(?:para|a)\s+(.+\.(?:com|org|net|pt|br|io))/i,
      /navega(?:r)?\s+(?:para|a)\s+(.+)/i,
      /(?:abre?|open)\s+(https?:\/\/.+)/i,
      /(?:abre?|open)\s+(www\..+)/i,
      /(?:abre?|open)\s+(\w+\.(?:com|org|net|pt|br|io)\S*)/i
    ],
    extract: (text) => {
      const match = text.match(/(?:site|url|link|página|para|a)\s+([^\s]+)/i) ||
                    text.match(/(https?:\/\/[^\s]+)/i) ||
                    text.match(/(www\.[^\s]+)/i) ||
                    text.match(/(\w+\.(?:com|org|net|pt|br|io)[^\s]*)/i);
      return { url: match?.[1]?.trim() || '' };
    }
  },
  
  system_list_processes: {
    patterns: [
      /lista(?:r)?\s+(?:os\s+)?processos/i,
      /mostra(?:r)?\s+(?:os\s+)?processos/i,
      /ver\s+(?:os\s+)?processos/i,
      /que\s+processos\s+(?:estão|tão)\s+(?:a\s+)?(?:correr|rodar|executar)/i,
      /processos\s+(?:em\s+)?(?:execução|ativos|activos)/i,
      /task\s*(?:manager)?/i,
      /ps\s+aux/i
    ],
    extract: (text) => {
      const match = text.match(/processos?\s+(?:de\s+)?(\w+)/i);
      return { filter: match?.[1] || '' };
    }
  },
  
  system_kill_process: {
    patterns: [
      /(?:mata|termina|fecha|kill|encerra)(?:r)?\s+(?:o\s+)?processo\s+(.+)/i,
      /(?:mata|termina|fecha|kill)(?:r)?\s+(.+)/i,
      /para(?:r)?\s+(?:o\s+)?processo\s+(.+)/i,
      /taskkill\s+(.+)/i,
      /força(?:r)?\s+(?:o\s+)?fecho\s+(?:de\s+)?(.+)/i
    ],
    extract: (text) => {
      // Try specific patterns first
      const processMatch = text.match(/(?:mata|termina|fecha|kill|para|força\s+fecho)(?:r)?\s+(?:o\s+)?(?:processo\s+)?(.+)/i);
      if (processMatch) {
        // Remove leading 'de ' and 'processo '
        let id = processMatch[1].replace(/^(?:de\s+)?(?:o\s+)?(?:processo\s+)?/i, '').trim();
        return { identifier: id || '' };
      }
      const taskMatch = text.match(/taskkill\s+(.+)/i);
      return { identifier: taskMatch?.[1]?.trim() || '' };
    }
  },
  
  system_list_windows: {
    patterns: [
      /lista(?:r)?\s+(?:as\s+)?janelas/i,
      /mostra(?:r)?\s+(?:as\s+)?janelas/i,
      /ver\s+(?:as\s+)?janelas/i,
      /que\s+janelas\s+(?:estão|tão)\s+abertas/i,
      /janelas\s+abertas/i
    ],
    extract: () => ({})
  },
  
  system_focus_window: {
    patterns: [
      /foca(?:r)?\s+(?:na\s+)?(?:janela\s+)?(.+)/i,
      /alt\s*tab\s+(?:para\s+)?(.+)/i,
      /muda(?:r)?\s+(?:para\s+)?(?:a\s+)?janela\s+(.+)/i,
      /vai?\s+(?:para\s+)?(?:a\s+)?janela\s+(.+)/i
    ],
    extract: (text) => {
      const match = text.match(/(?:foca|tab|muda|vai|janela)\s+(?:para\s+)?(?:na\s+)?(?:a\s+)?(.+)/i);
      return { window: match?.[1]?.trim() || '' };
    }
  },
  
  system_window_action: {
    patterns: [
      /(?:minimiza|maximize|restaura|fecha)(?:r)?\s+(?:a\s+)?(?:janela\s+)?(.+)/i,
      /(minimize|maximize|restore|close)\s+(?:window\s+)?(.+)/i
    ],
    extract: (text) => {
      const actionMatch = text.match(/(minimiza|maximize|restaura|fecha|minimize|maximize|restore|close)/i);
      const windowMatch = text.match(/(?:minimiza|maximize|restaura|fecha|minimize|maximize|restore|close)(?:r)?\s+(?:a\s+)?(?:janela\s+)?(.+)/i);
      
      const actionMap = {
        'minimiza': 'minimize', 'minimize': 'minimize',
        'maximize': 'maximize', 
        'restaura': 'restore', 'restore': 'restore',
        'fecha': 'close', 'close': 'close'
      };
      
      return { 
        action: actionMap[actionMatch?.[1]?.toLowerCase()] || 'minimize',
        window: windowMatch?.[1]?.trim() || ''
      };
    }
  },

  // ═══════════════════════════════════════════════════════════
  // LEVEL 3 - INPUT: TECLADO, RATO, SCREENSHOTS, CLIPBOARD
  // ═══════════════════════════════════════════════════════════
  
  input_type: {
    patterns: [
      /(?:digita|escreve|type)(?:r)?\s+["']?(.+?)["']?$/i,
      /digit[ae]\s+(?:o\s+)?texto\s+["']?(.+?)["']?$/i,
      /escreve(?:r)?\s+["']?(.+?)["']?$/i
    ],
    extract: (text) => {
      const match = text.match(/(?:digita|escreve|type|texto)\s+["']?(.+?)["']?$/i);
      return { text: match?.[1] || '' };
    }
  },
  
  input_shortcut: {
    patterns: [
      /(?:atalho|shortcut)\s+(.+)/i,
      /(?:pressiona|press)\s+(?:ctrl|alt|shift)[\s+]+\w+/i,
      /ctrl[\s+]+\w+/i,
      /alt[\s+]+\w+/i,
      /(?:faz|executa)\s+(?:copy|paste|colar|copiar|ctrl\+\w)/i
    ],
    extract: (text) => {
      const match = text.match(/(?:atalho|shortcut|pressiona|press|faz|executa)?\s*((?:ctrl|alt|shift)[\s+]+\w+|copy|paste|copiar|colar|undo|redo|save|selectall)/i);
      return { keys: match?.[1]?.trim() || '' };
    }
  },
  
  input_key: {
    patterns: [
      /(?:pressiona|press|carrega)\s+(?:a\s+)?(?:tecla\s+)?(\w+)(?:\s+(\d+)\s*(?:vezes|x))?/i,
      /(?:tecla|key)\s+(\w+)/i
    ],
    extract: (text) => {
      const match = text.match(/(?:pressiona|press|carrega|tecla|key)\s+(?:a\s+)?(?:tecla\s+)?(\w+)(?:\s+(\d+))?/i);
      return { key: match?.[1] || '', times: parseInt(match?.[2]) || 1 };
    }
  },
  
  input_click: {
    patterns: [
      /(?:click|clica|carrega)\s+(?:em\s+)?(?:\(?\s*(\d+)\s*,\s*(\d+)\s*\)?)?/i,
      /(?:click|clica)\s+(?:botão\s+)?(esquerdo|direito|left|right)/i,
      /(?:double\s*click|duplo\s*click|clica\s+duas?\s+vezes?)/i
    ],
    extract: (text) => {
      const posMatch = text.match(/(\d+)\s*,\s*(\d+)/);
      const buttonMatch = text.match(/(esquerdo|direito|left|right)/i);
      const doubleMatch = /double|duplo|duas/i.test(text);
      
      return { 
        x: posMatch ? parseInt(posMatch[1]) : null,
        y: posMatch ? parseInt(posMatch[2]) : null,
        button: buttonMatch ? (buttonMatch[1].toLowerCase().startsWith('d') || buttonMatch[1].toLowerCase() === 'right' ? 'right' : 'left') : 'left',
        double: doubleMatch
      };
    }
  },
  
  input_scroll: {
    patterns: [
      /(?:scroll|rola|desliza)(?:r)?\s+(?:para\s+)?(cima|baixo|up|down)/i,
      /(?:scroll|rola)\s+(\d+)/i
    ],
    extract: (text) => {
      const dirMatch = text.match(/(cima|baixo|up|down)/i);
      const amountMatch = text.match(/(\d+)/);
      return { 
        direction: dirMatch?.[1]?.toLowerCase().replace('cima', 'up').replace('baixo', 'down') || 'down',
        amount: parseInt(amountMatch?.[1]) || 3
      };
    }
  },
  
  input_move: {
    patterns: [
      /(?:move|mover)\s+(?:o\s+)?(?:cursor|rato|mouse)\s+(?:para\s+)?(?:\(?\s*(\d+)\s*,\s*(\d+)\s*\)?)/i
    ],
    extract: (text) => {
      const match = text.match(/(\d+)\s*,\s*(\d+)/);
      return { x: parseInt(match?.[1]) || 0, y: parseInt(match?.[2]) || 0 };
    }
  },
  
  input_screenshot: {
    patterns: [
      /(?:screenshot|captura|print\s*screen|capturar?\s+(?:o\s+)?(?:ecrã|tela|ecra|screen))/i,
      /tira(?:r)?\s+(?:um\s+)?(?:print|screenshot|foto\s+do\s+ecr[aã])/i
    ],
    extract: () => ({})
  },
  
  input_copy: {
    patterns: [
      /(?:copia|copy)\s+(?:o\s+)?(?:texto\s+)?["']?(.+?)["']?$/i,
      /(?:copia|copy)\s+(?:para\s+)?(?:o\s+)?clipboard/i
    ],
    extract: (text) => {
      const match = text.match(/(?:copia|copy)\s+(?:o\s+)?(?:texto\s+)?["']?(.+?)["']?$/i);
      return { text: match?.[1] || '' };
    }
  },
  
  input_paste: {
    patterns: [
      /\b(?:cola|paste|colar)\b(?:\s+aqui)?/i
    ],
    extract: () => ({})
  },
  
  input_get_position: {
    patterns: [
      /(?:onde|posição|posicao)\s+(?:está|esta)\s+(?:o\s+)?(?:cursor|rato|mouse)/i,
      /(?:posição|posicao)\s+(?:do\s+)?(?:cursor|rato|mouse)/i
    ],
    extract: () => ({})
  },

  // ═══════════════════════════════════════════════════════════
  // REMOTE AGENT — Automação de Máquinas Remotas (SSH)
  // ═══════════════════════════════════════════════════════════

  remote_list_machines: {
    patterns: [
      /lista(?:r)?\s+(?:as\s+)?(?:m[aá]quinas?|servidore?s?)\s*(?:remotos?|registad[ao]s?)?/i,
      /(?:m[aá]quinas?|servidore?s?)\s+(?:remotos?|registad[ao]s?|dispon[ií]veis)/i,
      /ver\s+(?:as\s+)?(?:m[aá]quinas?|servidore?s?)/i,
      /invent[aá]rio\s+(?:de\s+)?(?:m[aá]quinas?|servidore?s?)/i
    ],
    extract: () => ({})
  },

  remote_add_machine: {
    patterns: [
      /adiciona(?:r)?\s+(?:uma?\s+)?(?:m[aá]quina|servidor)\s+(.+)/i,
      /registar?\s+(?:uma?\s+)?(?:m[aá]quina|servidor)\s+(.+)/i,
      /nova\s+(?:m[aá]quina|servidor)\s+(.+)/i
    ],
    extract: (text) => {
      // "adiciona máquina servidor1 192.168.1.100 user root"
      const match = text.match(/(?:m[aá]quina|servidor)\s+(\S+)\s+(\S+)\s+(?:user|utilizador|username)\s+(\S+)/i);
      if (match) {
        return { alias: match[1], host: match[2], username: match[3] };
      }
      // "adiciona máquina servidor1 192.168.1.100"
      const simpleMatch = text.match(/(?:m[aá]quina|servidor)\s+(\S+)\s+([\d.]+\S*)/i);
      if (simpleMatch) {
        return { alias: simpleMatch[1], host: simpleMatch[2], username: '' };
      }
      return { alias: '', host: '', username: '' };
    }
  },

  remote_remove_machine: {
    patterns: [
      /(?:remove|remover?|elimina|apaga)(?:r)?\s+(?:a\s+)?(?:m[aá]quina|servidor)\s+(\S+)/i
    ],
    extract: (text) => {
      const match = text.match(/(?:m[aá]quina|servidor)\s+(\S+)/i);
      return { alias: match?.[1] || '' };
    }
  },

  remote_execute: {
    patterns: [
      /executa(?:r)?\s+(?:em|no|na)\s+(?:m[aá]quina|servidor)\s+(\S+)\s*:?\s+(.+)/i,
      /(?:ssh|remoto)\s+(\S+)\s+(.+)/i,
      /corre(?:r)?\s+(?:em|no|na)\s+(\S+)\s*:?\s+(.+)/i
    ],
    extract: (text) => {
      const match = text.match(/(?:executa(?:r)?|ssh|remoto|corre(?:r)?)\s+(?:em|no|na)?\s*(?:m[aá]quina|servidor)?\s*(\S+)\s*:?\s+(.+)/i);
      return { alias: match?.[1] || '', command: match?.[2]?.trim() || '' };
    }
  },

  remote_status: {
    patterns: [
      /estado\s+(?:da\s+)?(?:m[aá]quina|servidor)\s+(\S+)/i,
      /status\s+(?:da\s+)?(?:m[aá]quina|servidor)\s+(\S+)/i,
      /(?:m[aá]quina|servidor)\s+(\S+)\s+(?:est[aá]|status|estado)/i
    ],
    extract: (text) => {
      const match = text.match(/(?:m[aá]quina|servidor)\s+(\S+)/i);
      return { alias: match?.[1] || '' };
    }
  },

  // ═══════════════════════════════════════════════════════════
  // PROJECT BUILDER — Criação de Projetos Completos via IA
  // ═══════════════════════════════════════════════════════════

  // Blueprint ANTES de project_create — regex testa em ordem, o primeiro a bater ganha
  project_blueprint: {
    patterns: [
      // Padrões explícitos de blueprint/planeamento
      /(?:cria|faz|gera)\s+(?:um\s+)?blueprint\s+(.+)/i,
      /(?:planei?a|planear|planifica)\s+(?:uma?\s+)?(?:app|projeto|projecto|site|api)\s+(.+)/i,
      /blueprint\s+(?:para|de|da|do)\s+(.+)/i,
      /(?:plano|roadmap)\s+(?:para|de|da|do)\s+(?:uma?\s+)?(?:app|projeto|site)\s+(.+)/i,
      // Negação explícita — "não criar agora", "mas não cries", "sem criar"
      /(?:cri(?:a|ar)|faz|gera|quero)\s+(?:uma?\s+)?(?:app|projeto|projecto|site|api)\s+.+(?:mas\s+)?(?:não|nao|sem)\s+(?:cri(?:a|ar|es)|fazer?|construir?|implementar?)\s+(?:agora|já|ja|ainda|nada)/i,
      /(?:não|nao|sem)\s+(?:cri(?:a|ar|es)|fazer?|construir?)\s+(?:agora|já|ja|ainda|nada).+(?:app|projeto|projecto|site|api)/i,
      // "como ficaria", "como seria", "testa como seria"
      /(?:como\s+(?:ficaria|seria|ficava)|testa(?:r)?\s+como\s+(?:seria|ficaria))\s+(?:uma?\s+)?(?:app|projeto|site|api)\s+(.+)/i,
      // "só o plano", "apenas o blueprint", "quero só a estrutura"
      /(?:só|apenas|somente)\s+(?:o\s+)?(?:plano|blueprint|estrutura|arquitetura)\s+(.+)/i
    ],
    extract: (text) => {
      // Remover frases de negação para extrair a descrição do projeto
      const cleaned = text
        .replace(/(?:cria|faz|gera|planeia|planear|planifica|quero)\s+(?:um\s+)?(?:blueprint|plano|roadmap)\s+(?:para|de|da|do)?\s*/i, '')
        .replace(/(?:mas\s+)?(?:não|nao|sem)\s+(?:cri(?:a|ar|es)|fazer?|construir?|implementar?)\s+(?:agora|já|ja|ainda|nada)/gi, '')
        .replace(/(?:só|apenas|somente)\s+(?:o\s+)?(?:plano|blueprint|estrutura|arquitetura)\s+(?:para|de|da|do)?\s*/i, '')
        .replace(/(?:como\s+(?:ficaria|seria|ficava)|testa(?:r)?\s+como\s+(?:seria|ficaria))\s+/i, '')
        .trim();
      
      const match = text.match(
        /(?:app|aplicação|aplicativo|projeto|projecto|project|site|website|api|servidor|server)\s+(?:de\s+|para\s+|com\s+)?(.+)/i
      );
      return { description: match?.[1]?.trim() || cleaned || text };
    }
  },

  project_create: {
    patterns: [
      /cri(?:a|ar)\s+(?:um\s+)?(?:projeto|projecto|project)\s+(.+)/i,
      /cri(?:a|ar)\s+(?:uma?\s+)?(?:app|aplicação|aplicativo|aplicaçao)\s+(.+)/i,
      /cri(?:a|ar)\s+(?:um\s+)?(?:site|website)\s+(.+)/i,
      /cri(?:a|ar)\s+(?:uma?\s+)?(?:api|servidor|server)\s+(.+)/i,
      /(?:gera|montar?|construir?|build)\s+(?:um\s+)?(?:projeto|project)\s+(.+)/i,
      /(?:novo|new)\s+(?:projeto|project|app)\s+(.+)/i,
      /(?:scaffold|bootstrap)\s+(.+)/i,
      /quero\s+(?:uma?\s+)?(?:app|projeto|site|api)\s+(.+)/i
    ],
    extract: (text) => {
      const match = text.match(
        /(?:cri(?:a|ar)|gera|montar?|construir?|build|novo|new|scaffold|bootstrap|quero)\s+(?:uma?\s+)?(?:projeto|projecto|project|app|aplicação|aplicativo|site|website|api|servidor|server)?\s*(.+)/i
      );
      return { description: match?.[1]?.trim() || text };
    }
  },

  project_list: {
    patterns: [
      /lista(?:r)?\s+(?:os\s+)?(?:meus\s+)?projetos/i,
      /(?:meus|os)\s+projetos/i,
      /projetos?\s+(?:criados|existentes)/i,
      /list\s+projects/i
    ],
    extract: () => ({})
  },

  // RAG - Indexação e pesquisa de documentos
  rag_index: {
    patterns: [
      /index(?:a|ar)\s+(?:os?\s+)?(?:documentos?|ficheiros?|pasta|diretório|directorio|directory|folder)/i,
      /(?:analisa|analisar|processar?)\s+(?:os?\s+)?(?:documentos?|ficheiros?)/i,
      /index(?:a|ar)\s+(?:para\s+)?rag/i,
      /rag\s+index/i
    ],
    extract: (text) => {
      const match = text.match(/(?:index(?:a|ar)|analisa|analisar|processar?)\s+(?:os?\s+)?(?:documentos?|ficheiros?|pasta|diretório|directorio|directory|folder)\s*(.+)?/i);
      return { directory: match?.[1]?.trim() || null };
    }
  },

  rag_search: {
    patterns: [
      /pesquis(?:a|ar)\s+(?:nos?\s+)?documentos?\s+(.+)/i,
      /procur(?:a|ar)\s+(?:nos?\s+)?documentos?\s+(.+)/i,
      /(?:o que|que)\s+(?:dizem?|têm|tem)\s+(?:os?\s+)?documentos?\s+(?:sobre\s+)?(.+)/i,
      /rag\s+search\s+(.+)/i
    ],
    extract: (text) => {
      const match = text.match(/(?:pesquis|procur|dizem?|têm|tem|search)\s+(?:nos?\s+)?(?:documentos?\s+)?(?:sobre\s+)?(.+)/i);
      return { query: match?.[1]?.trim() || text };
    }
  },

  rag_stats: {
    patterns: [
      /(?:estado|stats?|estatísticas?)\s+(?:do\s+)?(?:rag|índice|indice|documentos?)/i,
      /rag\s+stats?/i,
      /quantos?\s+documentos?\s+(?:indexad|carregad)/i
    ],
    extract: () => ({})
  },

  file_upload: {
    patterns: [
      /(?:upload|carrega|carregar|envia|enviar)\s+(?:um\s+)?(?:ficheiro|arquivo|file|documento)/i,
      /(?:importa|importar)\s+(?:um\s+)?(?:ficheiro|arquivo|file|documento)/i
    ],
    extract: (text) => {
      const match = text.match(/(?:upload|carrega|enviar?|importar?)\s+(?:um\s+)?(?:ficheiro|arquivo|file|documento)\s*(.+)?/i);
      return { filename: match?.[1]?.trim() || null };
    }
  },

  // ═══════════════════════════════════════════════════════════
  // AUTOMATION AGENT — Tarefas Agendadas
  // ═══════════════════════════════════════════════════════════

  schedule_task: {
    patterns: [
      /agend(?:a|ar)\s+/i,
      /(?:todos?\s+(?:os\s+)?dias?|diariamente)\s+(?:[àa]s?\s+)?/i,
      /(?:a\s+)?cada\s+\d+\s*(?:min|hora|h|segundo|s)\b/i,
      /(?:todas?\s+(?:as?\s+)?)?(?:segunda|terça|quarta|quinta|sexta|s[aá]bado|domingo)/i,
      /(?:semanalmente|mensalmente)\s+/i,
      /(?:daqui\s+a|em|dentro\s+de)\s+\d+\s*(?:min|hora|h|segundo|dia)/i,
      /(?:programa|agendar?|schedule)\s+(?:uma?\s+)?(?:tarefa|task)/i,
      /(?:repet(?:e|ir)|recorr[eê]ncia)\s+/i
    ],
    extract: (text) => ({ text })
  },

  list_tasks: {
    patterns: [
      /lista(?:r)?\s+(?:as?\s+)?(?:minhas?\s+)?tarefas?\s*(?:agendad[ao]s?)?/i,
      /tarefas?\s+(?:agendad[ao]s?|programad[ao]s?|ativ[ao]s?)/i,
      /(?:que|quais)\s+tarefas?\s+(?:tenho|existem|h[aá])/i,
      /(?:ver|mostra)\s+(?:as?\s+)?(?:agend[ao]s?|tarefas?|schedules?)/i,
      /list\s+tasks?/i
    ],
    extract: () => ({})
  },

  delete_task: {
    patterns: [
      /(?:apaga|remove|elimina|cancela)(?:r)?\s+(?:a\s+)?tarefa\s+(.+)/i,
      /(?:para|stop)(?:r)?\s+(?:a\s+)?tarefa\s+(.+)/i,
      /delete\s+task\s+(.+)/i
    ],
    extract: (text) => {
      const match = text.match(/(?:tarefa|task)\s+(.+)/i);
      return { taskId: match?.[1]?.trim() || '', name: match?.[1]?.trim() || '' };
    }
  },

  task_history: {
    patterns: [
      /hist[oó]rico\s+(?:de\s+)?(?:automa[çc][ãa]o|tarefas?|execu[çc][õo]es?)/i,
      /(?:tarefas?|automa[çc][ãa]o)\s+(?:hist[oó]rico|executad[ao]s?)/i,
      /task\s+history/i
    ],
    extract: () => ({})
  },

  // ═══════════════════════════════════════════════════════════
  // SMART MEMORY — Memória Inteligente
  // ═══════════════════════════════════════════════════════════

  remember: {
    patterns: [
      /lembra[\s-]*te\s+(?:que|de que|disso:?)\s*/i,
      /(?:memoriza|guarda|grava|regista)(?:r)?\s+(?:que|isso|isto)?\s*/i,
      /(?:anota|aponta|nota|toma\s+nota)(?:r?)?\s*:?\s*/i,
      /remember\s+(?:that|this)?\s*/i,
      /(?:não\s+)?(?:te\s+)?esqueças?\s+(?:que|de\s+que)\s*/i
    ],
    extract: (text) => ({ text })
  },

  recall: {
    patterns: [
      /(?:o\s+)?que\s+(?:sabes|lembras?|tens?\s+(?:na\s+)?mem[oó]ria)\s+(?:sobre|de|do|da)\s*/i,
      /(?:lembras[\s-]*te|recordas)\s+(?:do|da|de)?\s*/i,
      /(?:o\s+)?que\s+(?:eu\s+)?(?:te\s+)?(?:disse|contei|pedi|falei)\s+(?:sobre|de)\s*/i,
      /(?:o\s+)?que\s+sabes?\s+(?:sobre|de)\s+mim/i,
      /(?:o\s+)?que\s+sabes?\s+sobre\s+/i,
      /recall\s+/i
    ],
    extract: (text) => {
      const match = text.match(/(?:sobre|de|do|da)\s+(.+)/i);
      return { query: match?.[1]?.trim() || text };
    }
  },

  forget: {
    patterns: [
      /esquece\s+(?:o|a|que|isso|isto|tudo\s+sobre)?\s*/i,
      /(?:apaga|remove|elimina)(?:r)?\s+(?:da\s+)?mem[oó]ria\s*/i,
      /forget\s+/i
    ],
    extract: (text) => {
      const match = text.match(/(?:esquece|apaga|remove|elimina|forget)\s+(?:o|a|que|isso|isto|da\s+mem[oó]ria|tudo\s+sobre)?\s*(.+)/i);
      return { query: match?.[1]?.trim() || text };
    }
  },

  memory_profile: {
    patterns: [
      /(?:o\s+)?que\s+sabes?\s+(?:sobre|de)\s+mim/i,
      /(?:meu|o\s+meu)\s+perfil/i,
      /perfil\s+(?:de\s+)?mem[oó]ria/i,
      /(?:mostra|ver)\s+(?:a\s+)?(?:minha\s+)?mem[oó]ria/i,
      /(?:tudo\s+)?(?:o\s+)?que\s+(?:tens?\s+)?(?:memorizado|guardado|gravado)/i,
      /memory\s+profile/i
    ],
    extract: () => ({})
  },

  // ═══════════════════════════════════════════════════════════
  // SKILL AGENT — Comandos Personalizados
  // ═══════════════════════════════════════════════════════════

  create_skill: {
    patterns: [
      /quando\s+(?:eu\s+)?diss?er\s+/i,
      /(?:cria|criar|ensina|ensinar|adiciona|novo)\s+(?:uma?\s+)?(?:skill|comando|atalho)\s*/i,
      /(?:aprende|aprender)\s+(?:que\s+)?quando\s*/i,
      /(?:configura|definir?)\s+(?:um\s+)?(?:comando|atalho)\s*/i,
      /teach\s+/i,
      /create\s+skill\s*/i
    ],
    extract: (text) => ({ text })
  },

  list_skills: {
    patterns: [
      /lista(?:r)?\s+(?:as?\s+)?(?:minhas?\s+)?skills?/i,
      /(?:que|quais)\s+skills?\s+(?:tenho|existem|h[aá])/i,
      /(?:ver|mostra)\s+(?:as?\s+)?skills?/i,
      /(?:meus?|os?\s+meus?)\s+(?:comandos?|atalhos?|skills?)/i,
      /list\s+skills?/i
    ],
    extract: () => ({})
  },

  delete_skill: {
    patterns: [
      /(?:apaga|remove|elimina)(?:r)?\s+(?:a\s+)?skill\s+(.+)/i,
      /(?:apaga|remove|elimina)(?:r)?\s+(?:o\s+)?comando\s+(.+)/i,
      /delete\s+skill\s+(.+)/i
    ],
    extract: (text) => {
      const match = text.match(/(?:skill|comando|atalho)\s+(.+)/i);
      return { name: match?.[1]?.trim() || text };
    }
  },

  // ═══════════════════════════════════════════════════════════
  // VISION AGENT — Captura + Análise Visual
  // ═══════════════════════════════════════════════════════════

  screenshot_analyze: {
    patterns: [
      /(?:analisa|analisar?|descreve|ver)\s+(?:o\s+)?(?:meu\s+)?ecr[ãa]/i,
      /(?:o\s+)?que\s+(?:está|esta|há|vês?)\s+(?:no\s+)?(?:meu\s+)?ecr[ãa]/i,
      /(?:screenshot|captura)\s+(?:e\s+)?(?:analisa|descreve)/i,
      /(?:analisa|analisar?)\s+(?:o\s+)?(?:meu\s+)?(?:ecr[ãa]|tela|monitor)/i,
      /analyze\s+(?:my\s+)?screen/i,
      /(?:o\s+)?que\s+(?:tenho|vejo|aparece)\s+(?:no?\s+)?ecr[ãa]/i
    ],
    extract: (text) => {
      const match = text.match(/(?:analisa|descreve|ver)\s+(?:o\s+)?(?:meu\s+)?ecr[ãa]\s*(.+)?/i);
      return { prompt: match?.[1]?.trim() || 'Descreve o que vês no ecrã' };
    }
  },

  screen_ocr: {
    patterns: [
      /(?:extrai|extrair?|l[eê])\s+(?:o\s+)?texto\s+(?:do\s+)?ecr[ãa]/i,
      /ocr\s+(?:do\s+)?ecr[ãa]/i,
      /texto\s+(?:do|no)\s+ecr[ãa]/i,
      /(?:l[eê]|ler)\s+(?:o\s+)?ecr[ãa]/i,
      /screen\s+ocr/i,
      /extract\s+text\s+(?:from\s+)?screen/i
    ],
    extract: () => ({})
  },

  screen_errors: {
    patterns: [
      /(?:que\s+)?erros?\s+(?:há|tem|exist[ei]m?|aparec[ei]m?)\s+(?:no\s+)?ecr[ãa]?/i,
      /(?:encontra|procura|busca)(?:r)?\s+erros?\s+(?:no\s+)?ecr[ãa]?/i,
      /(?:analisa|verificar?)\s+erros?\s+(?:no\s+)?ecr[ãa]?/i,
      /(?:screen|ecr[ãa]?)\s+errors?/i,
      /debug\s+(?:o\s+)?ecr[ãa]?/i,
      /erros?\s+(?:no|do)\s+ecr[ãa]?/i
    ],
    extract: () => ({})
  },

  // ═══════════════════════════════════════════════════════════
  // ALERT AGENT — Monitorização Proativa
  // ═══════════════════════════════════════════════════════════

  create_monitor: {
    patterns: [
      /monitoriz(?:a|ar)\s+(?:o\s+)?(?:site|url|página|link)?\s*/i,
      /(?:vigiar?|monitorar?|observar?)\s+(?:o\s+)?(?:site|url|link|página)?\s*/i,
      /alerta\s+(?:se|quando|me)\s+/i,
      /(?:avisa|notifica)[\s-]*me\s+(?:se|quando)\s+/i,
      /monitor\s+(?:url|site|page)\s*/i,
      /(?:verifica|verificar?)\s+(?:se\s+)?(?:o\s+)?site\s+/i
    ],
    extract: (text) => ({ text })
  },

  create_reminder: {
    patterns: [
      /lembra[\s-]*me\s+(?:em|daqui\s+a|dentro\s+de)\s+/i,
      /(?:cria|criar?)\s+(?:um\s+)?lembrete\s+/i,
      /(?:avisa|notifica)[\s-]*me\s+(?:em|daqui\s+a)\s+/i,
      /(?:daqui\s+a|em|dentro\s+de)\s+\d+\s*(?:min|hora|h|dia)\w*\s+(?:lembra|avisa|diz)/i,
      /remind\s+me\s+(?:in|to)\s+/i,
      /(?:reminder|lembrete)\s+(?:para|de|em)\s+/i
    ],
    extract: (text) => ({ text })
  },

  list_monitors: {
    patterns: [
      /lista(?:r)?\s+(?:os?\s+)?(?:meus?\s+)?(?:monitores?|alertas?|lembretes?)/i,
      /(?:que|quais)\s+(?:monitores?|alertas?)\s+(?:tenho|existem)/i,
      /(?:ver|mostra)\s+(?:os?\s+)?(?:monitores?|alertas?)/i,
      /list\s+(?:monitors?|alerts?)/i
    ],
    extract: () => ({})
  },

  delete_monitor: {
    patterns: [
      /(?:apaga|remove|elimina|cancela)(?:r)?\s+(?:o\s+)?(?:monitor|alerta|lembrete)\s+(.+)/i,
      /(?:para|stop)(?:r)?\s+(?:de\s+)?monitoriz(?:a|ar)\s+(.+)/i,
      /delete\s+(?:monitor|alert)\s+(.+)/i
    ],
    extract: (text) => {
      const match = text.match(/(?:monitor|alerta|lembrete|alert)\s+(.+)/i);
      return { monitorId: match?.[1]?.trim() || '', name: match?.[1]?.trim() || '' };
    }
  },

  alert_history: {
    patterns: [
      /hist[oó]rico\s+(?:de\s+)?(?:alertas?|monitores?|notifica[çc][õo]es?)/i,
      /(?:alertas?|notifica[çc][õo]es?)\s+(?:ant(?:eriores|igos?)|passad[ao]s?|hist[oó]rico)/i,
      /alert\s+history/i
    ],
    extract: () => ({})
  },

  // ═══════════════════════════════════════════════════════════
  // WORKFLOW AGENT — Receitas & Fluxos
  // ═══════════════════════════════════════════════════════════

  list_workflows: {
    patterns: [
      /lista(?:r)?\s+(?:os?\s+)?(?:meus?\s+)?workflows?/i,
      /(?:que|quais)\s+workflows?\s+(?:existem|tenho|h[aá])/i,
      /(?:ver|mostra)\s+(?:os?\s+)?workflows?/i,
      /workflows?\s+dispon[ií]veis/i,
      /list\s+workflows?/i,
      /receitas?\s+(?:dispon[ií]veis|existentes)/i
    ],
    extract: () => ({})
  },

  run_workflow: {
    patterns: [
      /(?:executa|correr?|roda|lança|inicia)(?:r)?\s+(?:o\s+)?workflow\s+(.+)/i,
      /workflow\s+(.+)/i,
      /(?:executa|correr?|roda)\s+(?:a\s+)?receita\s+(.+)/i,
      /run\s+workflow\s+(.+)/i
    ],
    extract: (text) => {
      const match = text.match(/(?:workflow|receita)\s+(.+?)(?:\s+com\s+(.+))?$/i);
      return { name: match?.[1]?.trim() || text, input: match?.[2]?.trim() || '' };
    }
  },

  create_workflow: {
    patterns: [
      /(?:cria|criar?|novo)\s+(?:um\s+)?workflow\s*/i,
      /(?:cria|criar?|nova)\s+(?:uma\s+)?receita\s*/i,
      /create\s+workflow\s*/i
    ],
    extract: (text) => ({ text })
  },

  delete_workflow: {
    patterns: [
      /(?:apaga|remove|elimina)(?:r)?\s+(?:o\s+)?workflow\s+(.+)/i,
      /delete\s+workflow\s+(.+)/i
    ],
    extract: (text) => {
      const match = text.match(/workflow\s+(.+)/i);
      return { name: match?.[1]?.trim() || text };
    }
  },

  // ═══════════════════════════════════════════════════════════
  // CLIPBOARD AGENT — Área de Transferência Inteligente
  // ═══════════════════════════════════════════════════════════

  clipboard_current: {
    patterns: [
      /(?:o\s+)?que\s+(?:tenho|há|está)\s+(?:no\s+)?clipboard/i,
      /(?:mostra|ver)\s+(?:o\s+)?clipboard/i,
      /clipboard\s+(?:atual|corrente|agora)/i,
      /(?:conteúdo|conte[uú]do)\s+(?:do\s+)?clipboard/i,
      /(?:o\s+)?que\s+(?:tenho|copiei|está)\s+(?:na\s+)?[aá]rea\s+(?:de\s+)?transfer[eê]ncia/i
    ],
    extract: () => ({})
  },

  clipboard_history: {
    patterns: [
      /hist[oó]rico\s+(?:do\s+)?clipboard/i,
      /clipboard\s+hist[oó]rico/i,
      /(?:o\s+)?que\s+copiei\s+(?:antes|recentemente|hoje)/i,
      /(?:hist[oó]rico|registo)\s+(?:de\s+)?(?:c[oó]pias|coisas?\s+copiadas?)/i
    ],
    extract: () => ({})
  },

  clipboard_search: {
    patterns: [
      /pesquis(?:a|ar)\s+(?:no\s+)?clipboard\s+(.+)/i,
      /(?:procura|busca)(?:r)?\s+(?:no\s+)?clipboard\s+(.+)/i,
      /clipboard\s+(?:pesquisa|search)\s+(.+)/i,
      /search\s+clipboard\s+(.+)/i
    ],
    extract: (text) => {
      const match = text.match(/clipboard\s+(?:pesquisa|search)?\s*(.+)/i) ||
                    text.match(/(?:pesquisa|procura|busca|search)\s+(?:no\s+)?clipboard\s+(.+)/i);
      return { query: match?.[1]?.trim() || text };
    }
  },

  clipboard_monitor: {
    patterns: [
      /monitoriz(?:a|ar)\s+(?:o\s+)?clipboard/i,
      /(?:ativa|activar?|inicia|para|parar?|stop)\s+(?:a\s+)?monitoriza[çc][ãa]o\s+(?:do\s+)?clipboard/i,
      /clipboard\s+(?:monitor|monitorizar?)/i,
      /(?:guardar?|gravar?)\s+(?:tudo\s+)?(?:o\s+)?que\s+(?:eu\s+)?copi(?:o|ar|ei)/i
    ],
    extract: () => ({})
  },

  web_search: {
    patterns: [
      /pesquis(?:a|ar|e)\s+(?:na\s+internet|web|online)?/i,
      /procur(?:a|ar|e)\s+(?:na\s+internet|online)/i,
      /busc(?:a|ar)\s+(?:na\s+internet|online)/i,
      /search\s+(?:for|the\s+web)?/i,
      /^o\s+que\s+(?:é|são|foi|foram)\s+/i,
      /^quem\s+(?:é|foi|são)\s+/i,
      /^quando\s+(?:foi|é|será)\s+/i,
      /^onde\s+(?:fica|é|está)\s+/i,
      /notícias\s+(?:sobre|de)/i,
      /últimas\s+notícias/i,
      /preço\s+(?:de|do|da)/i,
      /cotação\s+(?:de|do|da)/i,
      /resultado\s+(?:de|do|da)/i,
      /previsão\s+(?:do\s+)?tempo/i,
      /tempo\s+em\s+\w+/i,
      // Novos padrões para tempo real
      /como\s+(?:está|esta|anda|vai)\s+(?:o|a)?\s*\w+\s*(?:hoje|agora)?/i,
      /(?:bitcoin|btc|ethereum|eth|crypto|cripto)\s*(?:hoje|agora|preço|valor)?/i,
      /(?:preço|cotação|valor)\s+(?:do|da|de)?\s*(?:bitcoin|btc|ethereum|eth|dólar|euro)/i,
      /(?:dólar|euro|libra)\s+(?:hoje|agora|cotação)/i,
      /quanto\s+(?:está|custa|vale)/i,
      /qual\s+(?:o|a)\s+(?:preço|valor|cotação)/i
    ],
    extract: (text) => {
      // Remover prefixos comuns para extrair a query
      let query = text
        .replace(/^pesquis(?:a|ar|e)\s+(?:na\s+internet|web|online)?\s*(?:sobre|por)?\s*/i, '')
        .replace(/^procur(?:a|ar|e)\s+(?:na\s+internet|online)?\s*(?:sobre|por)?\s*/i, '')
        .replace(/^busc(?:a|ar)\s+(?:na\s+internet|online)?\s*(?:sobre|por)?\s*/i, '')
        .replace(/^search\s+(?:for)?\s*/i, '')
        .replace(/^o\s+que\s+(?:é|são|foi|foram)\s+/i, '')
        .replace(/^quem\s+(?:é|foi|são)\s+/i, '')
        .replace(/^quando\s+(?:foi|é|será)\s+/i, '')
        .replace(/^onde\s+(?:fica|é|está)\s+/i, '')
        .replace(/^como\s+(?:está|esta|anda|vai)\s+(?:o|a)?\s*/i, '')
        .replace(/^quanto\s+(?:está|custa|vale)\s+(?:o|a)?\s*/i, '')
        .replace(/^qual\s+(?:o|a)\s+(?:preço|valor|cotação)\s+(?:do|da|de)?\s*/i, '')
        .replace(/[?!.]+$/, '')
        .trim();
      return { query: query || text };
    }
  },

  // ═══════════════════════════════════════════════════════════
  // CUSTOM AI PROVIDER — Integração de IA paga pelo utilizador
  // ═══════════════════════════════════════════════════════════

  setup_ai_provider: {
    patterns: [
      /configur(?:a|ar|e)\s+(?:o\s+)?(?:provedor|provider|ia|ai)\s/i,
      /configur(?:a|ar|e)\s+(?:openai|gpt|anthropic|claude|mistral|deepseek|cohere|openrouter|xai|grok)\b/i,
      /(?:setup|configurar?|integrar?|ativar?|add)\s+(?:openai|gpt|anthropic|claude|mistral|deepseek|cohere|openrouter|xai|grok)\b/i,
      /(?:usar?|utilizar?|conectar?)\s+(?:openai|gpt|anthropic|claude|mistral|deepseek|cohere|openrouter|xai|grok)\s+com\b/i,
      /(?:minha|a\s+minha)\s+(?:api\s*key|chave\s+api)\s+(?:é|e)\s/i,
      /api\s*key\s+(?:do|da|de|para)\s+(?:openai|anthropic|claude|mistral|deepseek|cohere|openrouter|xai|grok)/i,
      /integrar?\s+(?:minha?|a\s+minha)\s+(?:ia|ai|intelig[eê]ncia)/i,
      /setup\s+(?:my\s+)?(?:ai|provider|custom)/i,
      /configur(?:a|ar)\s+(?:a\s+)?(?:minha?|meu)\s+(?:ia|ai)/i
    ],
    extract: (text) => ({ rawText: text })
  },

  list_ai_providers: {
    patterns: [
      /list(?:a|ar|e)?\s+(?:os\s+)?proved?or(?:es)?\s+(?:de\s+)?(?:ia|ai)/i,
      /(?:quais|que)\s+proved?or(?:es)?\s+(?:de\s+)?(?:ia|ai)/i,
      /proved?or(?:es)?\s+(?:de\s+)?(?:ia|ai)\s+dispon[ií]ve(?:l|is)/i,
      /(?:ver|mostrar?)\s+(?:os\s+)?proved?or(?:es)?\s+(?:de\s+)?(?:ia|ai)/i,
      /list\s+(?:ai\s+)?providers?/i,
      /(?:que|quais)\s+(?:ias?|ais?)\s+(?:posso|consigo)\s+(?:usar?|integrar?)/i,
      /(?:opções|opcoes)\s+(?:de\s+)?(?:ia|ai)/i
    ],
    extract: () => ({})
  },

  remove_ai_provider: {
    patterns: [
      /remov(?:e|er)\s+(?:o\s+)?(?:meu\s+)?proved?or/i,
      /(?:apagar?|eliminar?|desconfigurar?)\s+(?:o\s+)?(?:meu\s+)?proved?or/i,
      /remov(?:e|er)\s+(?:a\s+)?(?:minha?\s+)?(?:ia|ai)\s+(?:paga?|personalizada?|custom)/i,
      /(?:voltar?|regressar?)\s+(?:ao|para\s+o)?\s*groq/i,
      /remove?\s+(?:my\s+)?(?:ai\s+)?provider/i,
      /(?:apagar?|eliminar?)\s+(?:a\s+)?(?:minha?\s+)?(?:configura[çc][ãa]o|config)\s+(?:de\s+)?(?:ia|ai)/i
    ],
    extract: () => ({})
  },

  ai_provider_status: {
    patterns: [
      /status\s+(?:do\s+)?(?:meu\s+)?proved?or/i,
      /(?:info|informa[çc][ãa]o|detalhe)\s+(?:do\s+)?(?:meu\s+)?proved?or/i,
      /(?:meu\s+)?proved?or\s+(?:de\s+)?(?:ia|ai)\s+(?:status|info)/i,
      /(?:que|qual)\s+(?:ia|ai)\s+(?:estou|est[aá]s?)\s+a?\s*usar/i,
      /(?:provider|provedor)\s+(?:status|info)/i,
      /status\s+(?:da\s+)?(?:minha?\s+)?(?:ia|ai)/i,
      /(?:minha?\s+)?(?:ia|ai)\s+(?:paga?|personalizada?|custom)\s+(?:status|info)/i
    ],
    extract: () => ({})
  },

  toggle_ai_provider: {
    patterns: [
      /(?:ativa|activar?|ativar?|reativar?|ligar?)\s+(?:o\s+)?(?:meu\s+)?proved?or/i,
      /(?:desativa|desactivar?|desativar?|pausar?|desligar?)\s+(?:o\s+)?(?:meu\s+)?proved?or/i,
      /(?:ativa|activar?|ativar?|reativar?|ligar?)\s+(?:a\s+)?(?:minha?\s+)?(?:ia|ai)\s+(?:paga?|personalizada?|custom)/i,
      /(?:desativa|desactivar?|desativar?|pausar?|desligar?)\s+(?:a\s+)?(?:minha?\s+)?(?:ia|ai)\s+(?:paga?|personalizada?|custom)/i,
      /(?:toggle|switch)\s+(?:my\s+)?(?:ai\s+)?provider/i
    ],
    extract: () => ({})
  },

  set_ai_model: {
    patterns: [
      /(?:mudar?|trocar?|alterar?|usar?|switch)\s+(?:o\s+)?modelo\s+(?:para\s+)?(\S+)/i,
      /modelo\s+(?:para\s+)?(\S+)/i,
      /(?:change|switch|set)\s+model\s+(?:to\s+)?(\S+)/i,
      /(?:usar?|utilizar?)\s+(?:o\s+)?modelo\s+(\S+)/i
    ],
    extract: (text) => {
      const match = text.match(/(?:modelo|model)\s+(?:para\s+|to\s+)?(\S+)/i);
      return { model: match ? match[1] : '' };
    }
  },

  ai_provider_onboarding: {
    patterns: [
      /(?:integrar?|ligar?|conectar?)\s+(?:uma?\s+)?(?:ia|ai)\s+(?:paga?|premium|pro)/i,
      /(?:posso|consigo|como)\s+(?:usar?|integrar?|conectar?)\s+(?:a?\s*minha?\s+)?(?:pr[oó]pria?\s+)?(?:ia|ai)/i,
      /(?:como\s+)?configur(?:a|ar)\s+(?:uma?\s+)?(?:ia|ai)\s+(?:paga?|personalizada?|custom|pr[oó]pria)/i,
      /(?:quero|gostava|gostaria)\s+(?:de\s+)?(?:usar?|integrar?)\s+(?:a?\s*minha?\s+)?(?:pr[oó]pria?\s+)?(?:ia|ai)/i,
      /(?:tenho|possuo)\s+(?:uma?\s+)?api\s*key/i,
      /(?:tenho|possuo)\s+(?:uma?\s+)?subscri[çc][ãa]o\s+(?:de|do|da)\s+(?:openai|anthropic|claude|mistral)/i
    ],
    extract: () => ({})
  },

  // ═══════════ i18n — LANGUAGE ═══════════

  change_language: {
    patterns: [
      /(?:mudar?|alterar?|trocar?|definir?)\s+(?:o?\s*)?(?:idioma|l[ií]ngua)\s+(?:para\s+)?(\w+)/i,
      /(?:change|switch|set)\s+(?:the?\s*)?language?\s+(?:to\s+)?(\w+)/i,
      /(?:cambiar?|poner?)\s+(?:el?\s*)?idioma\s+(?:a|en|para)\s+(\w+)/i,
      /(?:changer?|mettre?)\s+(?:la?\s*)?langue?\s+(?:en|à|pour)\s+(\w+)/i,
      /(?:quero|want|je\s+veux|desejo)\s+(?:em\s+|in\s+|en\s+)?(\w+)/i,
      /(?:fala|speak|parle|habla)\s+(?:em\s+|in\s+|en\s+)?(\w+)/i,
      /(?:usa|use|utilise)\s+(?:o?\s*)?(?:idioma\s+)?(\w+)/i,
      /(?:p[oõ]e|coloca)\s+(?:em\s+)?(\w+)/i
    ],
    extract: (text) => {
      const match = text.match(/(?:para|to|a|en|à|pour|em|in)\s+(\w+)\s*$/i) ||
                     text.match(/(?:fala|speak|parle|habla)\s+(?:em\s+|in\s+|en\s+)?(\w+)/i) ||
                     text.match(/(?:usa|use|utilise)\s+(?:o?\s*)?(?:idioma\s+)?(\w+)/i) ||
                     text.match(/(\w+)\s*$/i);
      return { language: match?.[1]?.trim() || '' };
    }
  },

  list_languages: {
    patterns: [
      /(?:que|quais)\s+(?:idiomas?|l[ií]nguas?)\s+(?:suportas?|tens?|h[aá]|existem?|dispon[ií]veis?)/i,
      /(?:idiomas?|l[ií]nguas?)\s+(?:dispon[ií]veis?|suportad[ao]s?)/i,
      /(?:what|which)\s+languages?\s+(?:do\s+you\s+)?(?:support|have|speak)/i,
      /(?:available|supported)\s+languages?/i,
      /(?:list|show|ver|listar?|mostrar?)\s+(?:os?\s*)?(?:idiomas?|l[ií]nguas?)/i,
      /(?:qu[ée]\s+)?idiomas?/i,
      /(?:quelles?|quels?)\s+langues?/i,
      /(?:qu[ée]\s+)?idiomas?\s+(?:soportas?|tienes?|hay)/i
    ],
    extract: () => ({})
  }
};

/**
 * Analisa mensagem e retorna intenção (regex rápido)
 */
function parseIntent(message) {
  if (!message || typeof message !== 'string') {
    return { intent: 'chat', entities: {} };
  }
  
  const text = message.trim();

  // Prioridade: skills personalizadas ("quando eu disser...") antes de qualquer outro match
  if (/quando\s+(?:eu\s+)?diss?er\s+/i.test(text)) {
    return { intent: 'create_skill', entities: INTENT_PATTERNS.create_skill.extract(text), confidence: 0.95 };
  }

  // Prioridade: lembretes com tempo ("lembra-me em Xh de...") antes de schedule_task
  if (/lembra[\s-]*me\s+(?:em|daqui\s+a|dentro\s+de)\s+/i.test(text)) {
    return { intent: 'create_reminder', entities: INTENT_PATTERNS.create_reminder.extract(text), confidence: 0.95 };
  }

  // Prioridade: "monitorizar clipboard" antes de create_monitor
  if (/monitoriz(?:a|ar)\s+(?:o\s+)?clipboard/i.test(text)) {
    return { intent: 'clipboard_monitor', entities: {}, confidence: 0.95 };
  }

  // Prioridade: "o que sabes sobre mim" → memory_profile
  if (/(?:o\s+)?que\s+sabes?\s+(?:sobre|de)\s+mim/i.test(text)) {
    return { intent: 'memory_profile', entities: {}, confidence: 0.95 };
  }

  // Prioridade: configurar/setup provedor de IA com api key
  if (/(?:configur|setup|integrar)\S*\s+(?:openai|gpt|anthropic|claude|mistral|deepseek|cohere|openrouter|xai|grok)\b/i.test(text) ||
      /(?:minha|a\s+minha)\s+(?:api\s*key|chave)/i.test(text)) {
    return { intent: 'setup_ai_provider', entities: { rawText: text }, confidence: 0.95 };
  }

  // Prioridade: mudar idioma / change language
  if (/(?:mudar?|alterar?|trocar?|definir?|change|switch|set|cambiar?|changer?)\s+.*(?:idioma|l[ií]ngua|language|langue)/i.test(text) ||
      /(?:idioma|l[ií]ngua|language|langue)\s+(?:para|to|a|en|à)\s+/i.test(text) ||
      /(?:fala|speak|parle|habla)\s+(?:em\s+|in\s+|en\s+)?\w+/i.test(text) ||
      /(?:mudar?|alterar?|trocar?|cambiar?|change|switch)\s+(?:para|to|a|en|à)\s+(?:portugu[eê]s|ingl[eê]s|english|espanhol|espa[nñ]ol|franc[eê]s|fran[cç]ais)/i.test(text)) {
    const langMatch = text.match(/(?:para|to|a|en|à|pour|em|in)\s+(\S+)\s*$/i) ||
                      text.match(/(?:fala|speak|parle|habla)\s+(?:em\s+|in\s+|en\s+)?(\S+)/i);
    if (langMatch) {
      return { intent: 'change_language', entities: { language: langMatch[1].trim() }, confidence: 0.95 };
    }
  }

  // Prioridade: status/info do provedor de IA antes de system_info
  if (/(?:status|info)\s+(?:do\s+)?(?:meu\s+)?proved?or/i.test(text) ||
      /(?:meu\s+)?proved?or\s+(?:de\s+)?(?:ia|ai)/i.test(text) ||
      /(?:que|qual)\s+(?:ia|ai)\s+(?:estou|est[aá])\s+a\s*usar/i.test(text)) {
    return { intent: 'ai_provider_status', entities: {}, confidence: 0.95 };
  }
  
  // Verificar cada padrão de intenção
  for (const [intent, config] of Object.entries(INTENT_PATTERNS)) {
    for (const pattern of config.patterns) {
      if (pattern.test(text)) {
        return {
          intent,
          entities: config.extract(text),
          confidence: 0.9
        };
      }
    }
  }
  
  // Default: chat com IA
  return {
    intent: 'chat',
    entities: { message: text },
    confidence: 1.0
  };
}

/**
 * 🧠 Smart Intent Parser — usa LLM quando regex falha
 * 
 * Fluxo: regex (grátis, 0ms) → LLM fallback (1 API call, ~300ms)
 * Só chama a IA quando o regex não reconhece a intenção.
 */
async function parseIntentSmart(message) {
  // Passo 1: tentar regex (instantâneo, sem custo)
  const regexResult = parseIntent(message);
  
  // Se o regex encontrou algo específico (não "chat"), confia
  if (regexResult.intent !== 'chat') {
    return regexResult;
  }
  
  // Passo 2: usar LLM para classificar intenções ambíguas
  try {
    const aiAgent = require('../agents/aiAgent');
    if (!aiAgent.isAvailable()) {
      return regexResult; // sem IA, fica com chat
    }

    // Apenas intenções seguras para classificação por LLM (excluir input_* e system_* que devem ser explícitas)
    const safeIntents = ['chat', 'web_search', 'create_pdf', 'run_code', 'project_blueprint', 'project_create', 'create_note', 'list_files', 'help', 'system_info', 'rag_index', 'rag_search', 'rag_stats', 'file_upload', 'current_time', 'current_date', 'schedule_task', 'list_tasks', 'delete_task', 'task_history', 'remember', 'recall', 'forget', 'memory_profile', 'create_skill', 'list_skills', 'delete_skill', 'screenshot_analyze', 'screen_ocr', 'screen_errors', 'create_monitor', 'create_reminder', 'list_monitors', 'delete_monitor', 'alert_history', 'list_workflows', 'run_workflow', 'create_workflow', 'delete_workflow', 'clipboard_current', 'clipboard_history', 'clipboard_search', 'clipboard_monitor', 'change_language', 'list_languages'];
    
    const classificationPrompt = `Classifica a intenção do utilizador. Responde APENAS com o nome da intenção mais provável, sem explicação.

Intenções disponíveis: ${safeIntents.join(', ')}

Regras:
- "chat" = conversa normal, perguntas gerais, opiniões, receitas, conselhos, ajuda com algum tema, piadas, histórias, explicações
- "current_time" = pergunta sobre as horas atuais, que horas são, hora certa
- "current_date" = pergunta sobre a data de hoje, que dia é
- "web_search" = APENAS quando precisa de dados em tempo real: preços atuais, cotações, notícias do dia, meteorologia, resultados desportivos
- "create_pdf" = pede explicitamente para criar um documento PDF
- "run_code" = pede explicitamente para executar código
- "project_blueprint" = quer planear, ver blueprint, ver como ficaria um projeto SEM o criar agora. Usa palavras como "blueprint", "planear", "como ficaria", "não criar agora", "só o plano"
- "project_create" = pede explicitamente para criar/construir uma app, projeto ou site (quer que seja criado de facto)
- "create_note" = pede para criar uma nota
- "list_files" = pede para listar ficheiros
- "help" = pede ajuda sobre o que o bot pode fazer
- "system_info" = pede status do sistema
- "schedule_task" = quer agendar/programar uma tarefa recorrente ou pontual
- "list_tasks" = quer ver as tarefas agendadas
- "remember" = quer que o bot memorize algo, "lembra-te que..."
- "recall" = quer saber o que o bot se lembra sobre algo
- "forget" = quer apagar uma memória
- "memory_profile" = quer ver tudo o que o bot sabe sobre ele
- "create_skill" = quer ensinar um comando personalizado "quando eu disser X, faz Y"
- "list_skills" = quer ver os comandos personalizados
- "screenshot_analyze" = quer capturar e analisar o ecrã
- "screen_ocr" = quer extrair texto do ecrã (OCR)
- "create_monitor" = quer monitorizar um site/URL
- "create_reminder" = quer criar um lembrete com hora "lembra-me em 2h de..."
- "list_monitors" = quer ver monitores e alertas ativos
- "list_workflows" = quer ver workflows disponíveis
- "run_workflow" = quer executar um workflow
- "clipboard_current" = quer ver o clipboard atual
- "clipboard_history" = quer ver o histórico do clipboard

IMPORTANTE: Se o utilizador fala de criar um projeto mas diz "não criar agora", "como ficaria", "blueprint" ou "só planear", responde "project_blueprint" e NÃO "project_create". Na dúvida entre estes dois, prefere "project_blueprint".
Na dúvida geral, responde "chat". A maioria das perguntas são "chat".

Mensagem do utilizador: "${message}"

Intenção:`;

    const response = await aiAgent.askAI(classificationPrompt, [], {
      maxTokens: 30,
      temperature: 0.1,
      system: 'Responde APENAS com o nome exato da intenção. Uma palavra/frase, sem explicação.'
    });

    const classified = response.trim().toLowerCase().replace(/[^a-z_]/g, '');
    
    // Validar se a intenção devolvida existe E está na lista segura
    if (safeIntents.includes(classified) && classified !== 'chat' && INTENT_PATTERNS[classified]) {
      // Re-extrair entidades com o padrão correto
      const entities = INTENT_PATTERNS[classified].extract(message);
      return {
        intent: classified,
        entities,
        confidence: 0.7,
        method: 'llm'
      };
    }

    // IA devolveu "chat" ou algo inválido — manter chat
    return { ...regexResult, method: 'llm-fallback' };

  } catch (error) {
    // Erro na IA — manter resultado do regex
    console.error('⚠️ LLM intent fallback error:', error.message);
    return regexResult;
  }
}

/**
 * Verifica se mensagem parece ser código
 */
function looksLikeCode(text) {
  const codeIndicators = [
    /^(?:const|let|var|function|class)\s+/,
    /console\.\w+\(/,
    /Math\.\w+\(/,
    /=>/,
    /\bfunction\s*\(/,
    /\{\s*\n/,
    /;\s*$/m
  ];
  
  return codeIndicators.some(pattern => pattern.test(text));
}

module.exports = {
  parseIntent,
  parseIntentSmart,
  looksLikeCode,
  INTENT_PATTERNS
};
