import { Logger } from './logger.js';
import { HtmlSanitizer } from './editor/htmlSanitizer.js';

export const QuestionParser = {
  /**
   * Converte o texto bruto ou HTML da questão em um objeto estruturado.
   * @param {string} rawInput - Texto bruto ou HTML colado no editor
   * @param {number} nextIndex - Número sequencial da questão
   * @returns {Object|null} Objeto da questão ou null se inválido
   */
  parse(rawInput, nextIndex = 1) {
    if (!rawInput || !rawInput.trim()) {
      Logger.error('O texto da questão está vazio.');
      return null;
    }

    // Identifica se a entrada contém tags HTML
    const isHtml = /<[a-z][\s\S]*>/i.test(rawInput);
    let normalized;

    if (isHtml) {
      // Normalização Inteligente de HTML (Word / Navegador):
      // 1. Substitui espaços especiais (&nbsp;) por espaços normais
      // 2. Converte quebras de bloco (</p>, </div>, </li>, </tr>, <br>) em marcador de nova linha
      // 3. Converte quebras de linha internas (\r\n) dentro de tags em espaço simples (como o HTML funciona)
      // 4. Converte o marcador de bloco de volta para quebras reais de linha
      normalized = rawInput
        .replace(/&nbsp;/gi, ' ')
        .replace(/<br\s*\/?>/gi, '__BLOCK_DELIMITER__')
        .replace(/<\/(p|div|h[1-6]|blockquote)>/gi, '__BLOCK_DELIMITER__')
        .replace(/<\/(ul|ol|table)>/gi, '$&__BLOCK_DELIMITER__')
        .replace(/\r\n|\r|\n/g, ' ')
        .replace(/__BLOCK_DELIMITER__/g, '\n');
    } else {
      normalized = rawInput.replace(/\r\n|\r/g, '\n');
    }

    const rawLines = normalized
      .split('\n')
      .map(line => this.cleanLineContent(line))
      .filter(line => line.length > 0);

    if (rawLines.length === 0) {
      Logger.error('Nenhuma linha válida encontrada no texto.');
      return null;
    }

    Logger.info(`Iniciando análise (parse) da questão #${nextIndex}...`);

    let title = `Questão ${nextIndex}`;
    let promptLines = [];
    let options = [];
    let modelAnswerLines = [];
    let feedbackLines = [];
    let currentSection = 'prompt'; // 'prompt' | 'modelAnswer' | 'feedback' | 'options'

    // Expressão regular para alternativas no texto plano:
    // Aceita tanto com texto na mesma linha quanto com texto nas linhas seguintes
    const optionRegex = /^(\*?)\s*(?:\(?([a-eA-E])[\)\.\:\]]|\(?([a-eA-E])\s*[-–—]|\(([a-eA-E])\))(?:\s+(.*)|\s*)$/;

    // Expressão regular para Padrão de Resposta
    const modelAnswerRegex = /^(?:padr[aã]o\s+de\s+resposta|resposta\s+modelo|crit[eé]rios?\s+de\s+corre[cç][aã]o|resposta\s+esperada)\s*:?\s*(.*)$/i;

    // Expressão regular para Feedback
    const feedbackRegex = /^(?:feedback|gabarito\s+comentado|coment[aá]rio)\s*:?\s*(.*)$/i;

    // Expressão regular para Título
    const titleRegex = /^(?:quest[aã]o\s*\d+|q\d+)/i;

    let lineIndex = 0;

    // 1. Verifica se a primeira linha é o Título
    const firstPlain = this.stripHtml(rawLines[0]);
    if (rawLines.length > 0 && titleRegex.test(firstPlain)) {
      title = firstPlain;
      lineIndex = 1;
    }

    // 2. Itera pelas linhas restantes
    for (; lineIndex < rawLines.length; lineIndex++) {
      const lineHtml = rawLines[lineIndex];
      const linePlain = this.stripHtml(lineHtml);

      if (!linePlain && !lineHtml.includes('<img') && !lineHtml.includes('<table')) {
        continue;
      }

      // Verifica Padrão de Resposta
      const modelAnswerMatch = linePlain.match(modelAnswerRegex);
      if (modelAnswerMatch) {
        currentSection = 'modelAnswer';
        const inlineText = modelAnswerMatch[1].trim();
        if (inlineText) {
          modelAnswerLines.push(inlineText);
        }
        continue;
      }

      // Verifica Feedback
      const feedbackMatch = linePlain.match(feedbackRegex);
      if (feedbackMatch) {
        currentSection = 'feedback';
        const inlineText = feedbackMatch[1].trim();
        if (inlineText) {
          feedbackLines.push(inlineText);
        }
        continue;
      }

      if (currentSection === 'modelAnswer') {
        modelAnswerLines.push(lineHtml);
        continue;
      }

      if (currentSection === 'feedback') {
        feedbackLines.push(lineHtml);
        continue;
      }

      // Verifica Alternativa
      const optionMatch = linePlain.match(optionRegex);
      if (optionMatch) {
        currentSection = 'options';
        const isCorrect = optionMatch[1] === '*';
        const letter = (optionMatch[2] || optionMatch[3] || optionMatch[4]).toLowerCase();
        
        // Remove o prefixo da alternativa mantendo tags semânticas internas balanceadas
        const optionContentHtml = this.removeOptionPrefix(lineHtml);
        const optionIndex = options.length + 1;

        options.push({
          id: `answer_${optionIndex}`,
          letter: letter,
          text: isHtml ? HtmlSanitizer.toValidXhtml(optionContentHtml) : optionContentHtml,
          isCorrect: isCorrect
        });
      } else {
        // Enunciado ou continuação
        if (currentSection === 'prompt') {
          promptLines.push(lineHtml);
        } else if (currentSection === 'options' && options.length > 0) {
          const sep = isHtml ? '<br />' : ' ';
          options[options.length - 1].text += `${sep}${isHtml ? HtmlSanitizer.toValidXhtml(lineHtml) : lineHtml}`;
        }
      }
    }

    const prompt = isHtml ? this.assembleBlockContent(promptLines) : promptLines.join('\n');
    const modelAnswer = isHtml ? this.assembleBlockContent(modelAnswerLines) : modelAnswerLines.join('\n');
    const feedback = isHtml ? this.assembleBlockContent(feedbackLines) : feedbackLines.join('\n');

    if (!prompt.trim() || prompt === '<p></p>') {
      Logger.error('Não foi possível identificar o enunciado da questão.');
      return null;
    }

    // 3. Determina se é Múltipla Escolha ou Discursiva
    if (options.length > 0) {
      // É Múltipla Escolha
      const correctCount = options.filter(opt => opt.isCorrect).length;

      if (correctCount === 0) {
        Logger.warn(`Atenção: Nenhuma alternativa com '*' foi marcada na "${title}". Marcando a primeira por padrão.`);
        options[0].isCorrect = true;
      } else if (correctCount > 1) {
        Logger.warn(`Atenção: Mais de uma alternativa marcada com '*' na "${title}". Apenas a primeira marcada será mantida como correta.`);
        let foundFirst = false;
        options.forEach(opt => {
          if (opt.isCorrect) {
            if (!foundFirst) foundFirst = true;
            else opt.isCorrect = false;
          }
        });
      }

      const correctOpt = options.find(opt => opt.isCorrect);
      Logger.success(`Parse concluído: [Múltipla Escolha] "${title}" com ${options.length} alternativas (Correta: ${correctOpt ? correctOpt.letter.toUpperCase() : '?'}).`);

      return {
        id: nextIndex,
        type: 'multiple_choice',
        title: title,
        prompt: prompt,
        options: options,
        modelAnswer: modelAnswer,
        feedback: feedback
      };
    } else {
      // É Discursiva
      const details = [];
      if (modelAnswer) details.push('com Padrão de Resposta');
      if (feedback) details.push('com Feedback');
      const detailsStr = details.length > 0 ? ` (${details.join(', ')})` : '';

      Logger.success(`Parse concluído: [Discursiva] "${title}"${detailsStr}.`);

      return {
        id: nextIndex,
        type: 'discursive',
        title: title,
        prompt: prompt,
        options: [],
        modelAnswer: modelAnswer,
        feedback: feedback
      };
    }
  },

  /**
   * Limpa uma linha individual removendo tags de bloco órfãs no início e no fim.
   * @param {string} line
   * @returns {string}
   */
  cleanLineContent(line) {
    if (!line) return '';
    let cleaned = HtmlSanitizer.cleanHtml(line);
    // Remove tags de bloco soltas no início/fim da linha para evitar aninhamento quebrado
    cleaned = cleaned.replace(/^\s*<(?:p|div)[^>]*>/i, '');
    cleaned = cleaned.replace(/<\/(?:p|div)>\s*$/i, '');
    return cleaned.trim();
  },

  /**
   * Monta um bloco de conteúdo (prompt, modelAnswer, feedback) encapsulando linhas em <p> se necessário.
   * @param {Array<string>} lines
   * @returns {string}
   */
  assembleBlockContent(lines) {
    if (!lines || lines.length === 0) return '';
    return lines
      .map(line => {
        const trimmed = line.trim();
        if (!trimmed) return '';
        if (trimmed.startsWith('<p') || trimmed.startsWith('<div') || trimmed.startsWith('<table') || trimmed.startsWith('<ul') || trimmed.startsWith('<ol') || trimmed.startsWith('<blockquote')) {
          return HtmlSanitizer.toValidXhtml(trimmed);
        }
        return `<p>${HtmlSanitizer.toValidXhtml(trimmed)}</p>`;
      })
      .filter(l => l.length > 0)
      .join('\n');
  },

  /**
   * Remove tags HTML e retorna apenas texto plano.
   * @param {string} html
   * @returns {string}
   */
  stripHtml(html) {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').trim();
  },

  /**
   * Remove prefixos de alternativa (*a), b., (c), etc.) preservando as tags HTML internas abertas.
   * @param {string} html
   * @returns {string}
   */
  removeOptionPrefix(html) {
    if (!html) return '';
    return html
      .replace(/^((?:\s*<[^>]+>)*)\s*\*?\s*(?:\(?([a-eA-E])[\)\.\:\]]|\(?([a-eA-E])\s*[-–—]|\(([a-eA-E])\))\s*/i, '$1')
      .trim();
  }
};
