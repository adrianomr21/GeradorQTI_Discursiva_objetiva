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

    // 0. Protege blocos de fórmulas matemáticas (.qti-math, MathML, SVG) contra quebra de linhas e falsos-positivos de alternativas
    const mathTokens = [];
    let protectedInput = this.protectMathBlocks(rawInput, mathTokens);

    // 0.1. Protege blocos de tabelas (<table>...</table>) para manter sua estrutura íntegra e evitar quebra de tags internas
    const tableTokens = [];
    protectedInput = this.protectTableBlocks(protectedInput, tableTokens);

    // Identifica se a entrada contém tags HTML
    const isHtml = /<[a-z][\s\S]*>/i.test(protectedInput);
    let normalized;

    if (isHtml) {
      // Normalização Inteligente de HTML (Word / Navegador):
      // 1. Substitui espaços especiais (&nbsp;) por espaços normais
      // 2. Converte quebras de bloco (</p>, </div>, </li>, </tr>, <br>) em marcador de nova linha
      // 3. Converte quebras de linha internas (\r\n) dentro de tags em espaço simples (como o HTML funciona)
      // 4. Converte o marcador de bloco de volta para quebras reais de linha
      normalized = protectedInput
        .replace(/&amp;nbsp;/gi, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\u00a0/g, ' ')
        .replace(/<br\s*\/?>/gi, '__BLOCK_DELIMITER__')
        .replace(/<\/(p|div|h[1-6])>/gi, '__BLOCK_DELIMITER__')
        .replace(/<\/(ul|ol|table|iframe|video|object|blockquote)>/gi, '$&__BLOCK_DELIMITER__')
        .replace(/<(ul|ol|table|iframe|video|object|blockquote)(\s+[^>]*)?>/gi, '__BLOCK_DELIMITER__$&')
        .replace(/(__QTI_TABLE_TOKEN_\d+__|__QTI_MATH_TOKEN_\d+__)/g, '__BLOCK_DELIMITER__$1__BLOCK_DELIMITER__')
        .replace(/(?:^|\n)(\s*\*?(?:\(?([a-eA-E])[\)\.\:\]\–\—-]|\(([a-eA-E])\))\s*|\s*(?:padr[aã]o\s+de\s+resposta|feedback|gabarito|coment[aá]rio|quest[aã]o\s*\d+):?)/gi, '__BLOCK_DELIMITER__$1')
        .replace(/\r\n|\r|\n/g, ' ')
        .replace(/__BLOCK_DELIMITER__/g, '\n');
    } else {
      normalized = protectedInput.replace(/\r\n|\r/g, '\n');
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
    const modelAnswerLines = [];
    const feedbackLines = [];
    const bodyLines = [];
    let currentSection = 'body'; // 'body' | 'modelAnswer' | 'feedback'

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

    // 2. Itera pelas linhas restantes separando seções de cabeçalho
    for (; lineIndex < rawLines.length; lineIndex++) {
      const lineHtml = rawLines[lineIndex];
      const linePlain = this.stripHtml(lineHtml);

      if (!linePlain && !lineHtml.includes('<img') && !lineHtml.includes('<table') && !lineHtml.includes('<iframe') && !lineHtml.includes('<video') && !lineHtml.includes('<embed') && !lineHtml.includes('<object') && !lineHtml.includes('__QTI_MATH_TOKEN_') && !lineHtml.includes('__QTI_TABLE_TOKEN_')) {
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
      } else if (currentSection === 'feedback') {
        feedbackLines.push(lineHtml);
      } else {
        bodyLines.push(lineHtml);
      }
    }

    const { promptLines, options } = this.extractOptionsAndPrompt(bodyLines, isHtml);

    const rawPrompt = isHtml ? this.assembleBlockContent(promptLines) : promptLines.join('\n');
    const rawModelAnswer = isHtml ? this.assembleBlockContent(modelAnswerLines) : modelAnswerLines.join('\n');
    const rawFeedback = isHtml ? this.assembleBlockContent(feedbackLines) : feedbackLines.join('\n');

    // Restaura tokens de fórmulas matemáticas
    const promptMath = this.restoreMathTokens(rawPrompt, mathTokens);
    const modelAnswerMath = this.restoreMathTokens(rawModelAnswer, mathTokens);
    const feedbackMath = this.restoreMathTokens(rawFeedback, mathTokens);
    const titleMath = this.restoreMathTokens(title, mathTokens);
    const optionsMath = options.map(opt => ({
      ...opt,
      text: this.restoreMathTokens(opt.text, mathTokens)
    }));

    // Restaura tokens de tabelas protegidas
    const prompt = this.restoreTableTokens(promptMath, tableTokens);
    const modelAnswer = this.restoreTableTokens(modelAnswerMath, tableTokens);
    const feedback = this.restoreTableTokens(feedbackMath, tableTokens);
    const restoredTitle = this.restoreTableTokens(titleMath, tableTokens);
    const restoredOptions = optionsMath.map(opt => ({
      ...opt,
      text: this.restoreTableTokens(opt.text, tableTokens)
    }));

    if (!prompt.trim() || prompt === '<p></p>') {
      Logger.error('Não foi possível identificar o enunciado da questão.');
      return null;
    }

    // 3. Determina se é Múltipla Escolha ou Discursiva
    if (restoredOptions.length > 0) {
      // É Múltipla Escolha
      const correctCount = restoredOptions.filter(opt => opt.isCorrect).length;
      let needsCorrectAnswerAdjustment = false;
      let hadMultipleCorrectAnswers = false;

      if (correctCount === 0) {
        Logger.warn(`Atenção: Nenhuma alternativa com '*' foi marcada na "${restoredTitle}". Ajustar alternativa correta.`);
        needsCorrectAnswerAdjustment = true;
      } else if (correctCount > 1) {
        Logger.warn(`Atenção: Mais de uma alternativa marcada com '*' na "${restoredTitle}". Só pode haver uma alternativa correta (apenas a primeira foi mantida).`);
        hadMultipleCorrectAnswers = true;
        let foundFirst = false;
        restoredOptions.forEach(opt => {
          if (opt.isCorrect) {
            if (!foundFirst) foundFirst = true;
            else opt.isCorrect = false;
          }
        });
      }

      // Verifica duplicidade de alternativas (por letra ou por conteúdo de texto)
      const seenLetters = new Set();
      const seenTexts = new Set();
      let hasDuplicateOptions = false;

      for (const opt of restoredOptions) {
        const normLetter = (opt.letter || '').toLowerCase().trim();
        const plainText = this.stripHtml(opt.text || '').replace(/\s+/g, ' ').trim().toLowerCase();

        if (normLetter && seenLetters.has(normLetter)) {
          hasDuplicateOptions = true;
        } else if (normLetter) {
          seenLetters.add(normLetter);
        }

        if (plainText.length > 0 && seenTexts.has(plainText)) {
          hasDuplicateOptions = true;
        } else if (plainText.length > 0) {
          seenTexts.add(plainText);
        }
      }

      if (hasDuplicateOptions) {
        Logger.warn(`Atenção: Foram identificadas alternativas repetidas na "${restoredTitle}".`);
      }

      // Verifica quantidade de alternativas (o padrão são 5 para questões objetivas)
      const hasFewOptions = restoredOptions.length < 5;
      if (hasFewOptions) {
        Logger.warn(`Atenção: A "${restoredTitle}" possui apenas ${restoredOptions.length} alternativas (o padrão são 5 alternativas).`);
      }

      const correctOpt = restoredOptions.find(opt => opt.isCorrect);
      const statusStr = correctOpt ? `Correta: ${correctOpt.letter.toUpperCase()}` : 'Ajustar alternativa correta';
      Logger.success(`Parse concluído: [Múltipla Escolha] "${restoredTitle}" com ${restoredOptions.length} alternativas (${statusStr}).`);

      return {
        id: nextIndex,
        type: 'multiple_choice',
        title: restoredTitle,
        prompt: prompt,
        options: restoredOptions,
        modelAnswer: modelAnswer,
        feedback: feedback,
        needsCorrectAnswerAdjustment: needsCorrectAnswerAdjustment,
        hadMultipleCorrectAnswers: hadMultipleCorrectAnswers,
        hasDuplicateOptions: hasDuplicateOptions,
        hasFewOptions: hasFewOptions
      };
    } else {
      // É Discursiva
      const details = [];
      if (modelAnswer) details.push('com Padrão de Resposta');
      if (feedback) details.push('com Feedback');
      const detailsStr = details.length > 0 ? ` (${details.join(', ')})` : '';

      Logger.success(`Parse concluído: [Discursiva] "${restoredTitle}"${detailsStr}.`);

      return {
        id: nextIndex,
        type: 'discursive',
        title: restoredTitle,
        prompt: prompt,
        options: [],
        modelAnswer: modelAnswer,
        feedback: feedback
      };
    }
  },

  /**
   * Extrai o enunciado (prompt) e as alternativas (options) a partir das linhas do corpo da questão.
   * Utiliza um algoritmo de pontuação de blocos candidatos para evitar falsos-positivos de alternativas
   * no meio do enunciado (como registros contábeis C-/D-, tópicos ou algarismos romanos).
   * @param {Array<string>} bodyLines
   * @param {boolean} isHtml
   * @returns {{ promptLines: Array<string>, options: Array<Object> }}
   */
  extractOptionsAndPrompt(bodyLines, isHtml) {
    // Expressão regular para alternativas no texto plano:
    // Aceita tanto com texto na mesma linha quanto com texto nas linhas seguintes
    const optionRegex = /^(\*?)\s*(?:\(?([a-eA-E])[\)\.\:\]]|\(?([a-eA-E])\s*[-–—]|\(([a-eA-E])\))(?:\s*(.*))$/;
    // Padrões de início de instrução ou tópicos de enunciado para penalizar alternativas falsas
    const promptLeadInRegex = /^(?:[eé]s?t[aã]o?\s+corret[ao]s?|[eé]\s+correto|[aá]ssinale|julgue|com\s+base|considerando|podemos\s+afirmar|pode-se\s+afirmar|[eé]\s+poss[ií]vel\s+afirmar|marque\s+a|escolha\s+a|selecione\s+a|quais?\s+est[aã]o|qual\s+est[aá]|(?:[iIvVxX]+|\d+)[\s\-\–\—\)\.\:])/i;

    const candidateIndices = [];
    for (let i = 0; i < bodyLines.length; i++) {
      const plain = this.stripHtml(bodyLines[i]);
      if (optionRegex.test(plain)) {
        // Apenas considera como início de bloco candidato se for a primeira linha
        // ou se a linha anterior NÃO casar com optionRegex (evita iniciar no meio de alternativas consecutivas)
        const prevPlain = i > 0 ? this.stripHtml(bodyLines[i - 1]) : '';
        if (i === 0 || !optionRegex.test(prevPlain)) {
          candidateIndices.push(i);
        }
      }
    }

    if (candidateIndices.length === 0) {
      return { promptLines: bodyLines, options: [] };
    }

    let bestCandidate = null;
    let bestScore = -Infinity;

    for (const startIndex of candidateIndices) {
      const candidateOptions = [];
      let duplicateLetterFound = false;
      let duplicateTextFound = false;
      let promptLeadInFound = false;
      const seenLetters = new Set();
      const seenTexts = new Set();

      for (let j = startIndex; j < bodyLines.length; j++) {
        const lineHtml = bodyLines[j];
        const linePlain = this.stripHtml(lineHtml);

        if (!linePlain && !lineHtml.includes('<img') && !lineHtml.includes('<table') && !lineHtml.includes('<iframe') && !lineHtml.includes('<video') && !lineHtml.includes('<embed') && !lineHtml.includes('<object') && !lineHtml.includes('__QTI_MATH_TOKEN_') && !lineHtml.includes('__QTI_TABLE_TOKEN_')) {
          continue;
        }

        const match = linePlain.match(optionRegex);
        if (match) {
          const isCorrect = match[1] === '*';
          const letter = (match[2] || match[3] || match[4]).toLowerCase();

          if (seenLetters.has(letter)) {
            duplicateLetterFound = true;
          }
          seenLetters.add(letter);

          let optionContentHtml = this.removeOptionPrefix(lineHtml, letter);
          optionContentHtml = this.stripFullOptionBold(optionContentHtml);

          const plainOptText = this.stripHtml(optionContentHtml).replace(/\s+/g, ' ').trim().toLowerCase();
          if (plainOptText.length > 0) {
            if (seenTexts.has(plainOptText)) {
              duplicateTextFound = true;
            }
            seenTexts.add(plainOptText);
          }

          const optIndex = candidateOptions.length + 1;
          candidateOptions.push({
            id: `answer_${optIndex}`,
            letter: letter,
            text: isHtml ? HtmlSanitizer.toValidXhtml(optionContentHtml) : optionContentHtml,
            isCorrect: isCorrect
          });
        } else {
          // Linha de continuação
          if (candidateOptions.length > 0) {
            if (promptLeadInRegex.test(linePlain)) {
              promptLeadInFound = true;
            }
            const sep = isHtml ? '<br />' : ' ';
            candidateOptions[candidateOptions.length - 1].text += `${sep}${isHtml ? HtmlSanitizer.toValidXhtml(lineHtml) : lineHtml}`;
          }
        }
      }

      if (candidateOptions.length < 2) {
        continue;
      }

      let score = 0;

      // 1. Começa com 'a'
      const firstLetter = candidateOptions[0].letter;
      if (firstLetter === 'a') {
        score += 100;
      } else {
        score -= 50;
      }

      // 2. Sequencialidade das letras (a, b, c, d, e...)
      let isStrictlySequential = true;
      let isAscending = true;
      for (let k = 0; k < candidateOptions.length; k++) {
        const expectedCharCode = 97 + k;
        const actualCharCode = candidateOptions[k].letter.charCodeAt(0);
        if (actualCharCode !== expectedCharCode) {
          isStrictlySequential = false;
        }
        if (k > 0) {
          const prevCharCode = candidateOptions[k - 1].letter.charCodeAt(0);
          if (actualCharCode <= prevCharCode) {
            isAscending = false;
          }
        }
      }

      if (isStrictlySequential) {
        score += 100;
      } else if (isAscending) {
        score += 40;
      }

      // 3. Penalidade se houver letras duplicadas
      if (duplicateLetterFound) {
        score -= 40;
      }

      // 4. Penalidade se houver texto idêntico entre opções
      if (duplicateTextFound) {
        score -= 100;
      }

      // 5. Penalidade severa se linha de continuação parecer instrução de enunciado
      if (promptLeadInFound) {
        score -= 200;
      }

      // 6. Quantidade de alternativas
      if (candidateOptions.length === 5) {
        score += 40;
      } else if (candidateOptions.length === 4) {
        score += 30;
      } else if (candidateOptions.length === 2 || candidateOptions.length === 3) {
        score += 20;
      } else if (candidateOptions.length > 5) {
        score -= 100;
      }

      // 7. Marcação de correta com asterisco
      const correctCount = candidateOptions.filter(o => o.isCorrect).length;
      if (correctCount === 1) {
        score += 60;
      } else if (correctCount > 1) {
        score += 20;
      }

      // 8. Enunciado presente antes das alternativas
      if (startIndex > 0) {
        score += 20;
      }

      if (score > bestScore) {
        bestScore = score;
        bestCandidate = {
          startIndex: startIndex,
          options: candidateOptions,
          score: score
        };
      }
    }

    if (bestCandidate && bestCandidate.score >= 50) {
      const promptLines = bodyLines.slice(0, bestCandidate.startIndex);
      bestCandidate.options.forEach((opt, idx) => {
        opt.id = `answer_${idx + 1}`;
      });
      return {
        promptLines: promptLines,
        options: bestCandidate.options
      };
    }

    return {
      promptLines: bodyLines,
      options: []
    };
  },

  /**
   * Protege blocos de fórmulas matemáticas (.qti-math, MathML, SVG) substituindo por tokens atômicos.
   * @param {string} html
   * @param {Array<string>} mathTokens
   * @returns {string}
   */
  protectMathBlocks(html, mathTokens = []) {
    if (!html) return '';
    let result = '';
    let i = 0;
    while (i < html.length) {
      const mathIdx = html.indexOf('<span class="qti-math', i);
      const mathIdx2 = html.indexOf("<span class='qti-math", i);
      let startIdx = -1;
      if (mathIdx !== -1 && mathIdx2 !== -1) startIdx = Math.min(mathIdx, mathIdx2);
      else if (mathIdx !== -1) startIdx = mathIdx;
      else if (mathIdx2 !== -1) startIdx = mathIdx2;

      const svgIdx = html.indexOf('<svg', i);
      const mathmlIdx = html.indexOf('<math', i);
      let tagType = 'span';
      let minStart = startIdx;

      if (svgIdx !== -1 && (minStart === -1 || svgIdx < minStart)) {
        minStart = svgIdx;
        tagType = 'svg';
      }
      if (mathmlIdx !== -1 && (minStart === -1 || mathmlIdx < minStart)) {
        minStart = mathmlIdx;
        tagType = 'math';
      }

      if (minStart === -1) {
        result += html.substring(i);
        break;
      }

      result += html.substring(i, minStart);

      if (tagType === 'span') {
        let depth = 0;
        let pos = minStart;
        let endPos = -1;
        while (pos < html.length) {
          const openSpan = html.indexOf('<span', pos);
          const closeSpan = html.indexOf('</span>', pos);
          if (closeSpan === -1) break;
          if (openSpan !== -1 && openSpan < closeSpan) {
            depth++;
            pos = openSpan + 5;
          } else {
            depth--;
            pos = closeSpan + 7;
            if (depth === 0) {
              endPos = pos;
              break;
            }
          }
        }
        if (endPos !== -1) {
          const fullSpan = html.substring(minStart, endPos);
          const token = `__QTI_MATH_TOKEN_${mathTokens.length}__`;
          mathTokens.push(fullSpan);
          result += token;
          i = endPos;
        } else {
          result += html.substring(minStart, minStart + 5);
          i = minStart + 5;
        }
      } else {
        const closingTag = `</${tagType}>`;
        const closeIdx = html.indexOf(closingTag, minStart);
        if (closeIdx !== -1) {
          const endPos = closeIdx + closingTag.length;
          const fullTag = html.substring(minStart, endPos);
          const token = `__QTI_MATH_TOKEN_${mathTokens.length}__`;
          mathTokens.push(fullTag);
          result += token;
          i = endPos;
        } else {
          result += html.substring(minStart, minStart + tagType.length + 1);
          i = minStart + tagType.length + 1;
        }
      }
    }
    return result;
  },

  /**
   * Restaura os tokens de fórmulas matemáticas de volta ao HTML original.
   * @param {string} str
   * @param {Array<string>} mathTokens
   * @returns {string}
   */
  restoreMathTokens(str, mathTokens) {
    if (!str || !mathTokens || mathTokens.length === 0) return str || '';
    let res = str;
    mathTokens.forEach((tokenHtml, idx) => {
      res = res.replaceAll(`__QTI_MATH_TOKEN_${idx}__`, tokenHtml);
    });
    return res;
  },

  /**
   * Protege blocos de tabelas (<table>...</table>) substituindo por tokens atômicos.
   * Evita que linhas e parágrafos internos da tabela sejam quebrados durante a normalização de linhas.
   * @param {string} html
   * @param {Array<string>} tableTokens
   * @returns {string}
   */
  protectTableBlocks(html, tableTokens = []) {
    if (!html) return '';
    let result = '';
    let i = 0;
    while (i < html.length) {
      const tableStartIdx = html.toLowerCase().indexOf('<table', i);
      if (tableStartIdx === -1) {
        result += html.substring(i);
        break;
      }

      result += html.substring(i, tableStartIdx);

      // Encontra o fechamento correspondente </table> lidando com tabelas aninhadas
      let depth = 0;
      let pos = tableStartIdx;
      let endPos = -1;

      while (pos < html.length) {
        const nextOpen = html.toLowerCase().indexOf('<table', pos);
        const nextClose = html.toLowerCase().indexOf('</table>', pos);

        if (nextClose === -1) break;

        if (nextOpen !== -1 && nextOpen < nextClose) {
          depth++;
          pos = nextOpen + 6;
        } else {
          depth--;
          pos = nextClose + 8;
          if (depth === 0) {
            endPos = pos;
            break;
          }
        }
      }

      if (endPos !== -1) {
        let fullTable = html.substring(tableStartIdx, endPos);
        // Higieniza a tabela garantindo XHTML válido e sem &nbsp;
        fullTable = HtmlSanitizer.cleanHtml(fullTable);
        fullTable = HtmlSanitizer.toValidXhtml(fullTable);

        const token = `__QTI_TABLE_TOKEN_${tableTokens.length}__`;
        tableTokens.push(fullTable);
        result += `\n${token}\n`;
        i = endPos;
      } else {
        result += html.substring(tableStartIdx, tableStartIdx + 6);
        i = tableStartIdx + 6;
      }
    }
    return result;
  },

  /**
   * Restaura os tokens de tabelas de volta ao HTML original.
   * @param {string} str
   * @param {Array<string>} tableTokens
   * @returns {string}
   */
  restoreTableTokens(str, tableTokens) {
    if (!str || !tableTokens || tableTokens.length === 0) return str || '';
    let res = str;
    tableTokens.forEach((tokenHtml, idx) => {
      const token = `__QTI_TABLE_TOKEN_${idx}__`;
      res = res.replaceAll(token, tokenHtml);
    });
    return res;
  },

  /**
   * Escapa caracteres especiais de uma string para uso seguro em expressões regulares.
   * @param {string} str
   * @returns {string}
   */
  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  },

  /**
   * Limpa uma linha individual removendo tags de bloco órfãs no início e no fim.
   * @param {string} line
   * @returns {string}
   */
  cleanLineContent(line) {
    if (!line) return '';
    const trimmed = line.trim();
    if (trimmed.startsWith('__QTI_TABLE_TOKEN_') || trimmed.startsWith('__QTI_MATH_TOKEN_')) {
      return trimmed;
    }
    let cleaned = HtmlSanitizer.cleanHtml(line);
    // Mescla tags de estilo adjacentes preservando espaços intermediários
    cleaned = cleaned.replace(/<\/(strong|b|em|i|u|s|sup|sub)>(\s*)<\1>/gi, (m, tag, sp) => sp || '');
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
        if (trimmed.startsWith('__QTI_TABLE_TOKEN_') || trimmed.startsWith('__QTI_MATH_TOKEN_')) {
          return trimmed;
        }
        if (trimmed.startsWith('<p') || trimmed.startsWith('<div') || trimmed.startsWith('<table') || trimmed.startsWith('<ul') || trimmed.startsWith('<ol') || trimmed.startsWith('<blockquote') || trimmed.startsWith('<iframe') || trimmed.startsWith('<video') || trimmed.startsWith('<object') || trimmed.startsWith('<embed') || trimmed.startsWith('<figure')) {
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
   * Remove prefixos de alternativa (*a), b., (c), etc.) preservando as tags HTML internas abertas
   * e tratando tags inline intermediárias ou prefixos repetidos.
   * Remove APENAS o primeiro prefixo da alternativa, preservando conteúdo subsequente (como lançamentos contábeis "D -", "C –", etc.).
   * @param {string} html
   * @param {string} [expectedLetter] - Letra da alternativa (opcional) para remoção precisa
   * @returns {string}
   */
  removeOptionPrefix(html, expectedLetter = null) {
    if (!html) return '';
    let cleaned = html;

    // 1. Mescla tags de formatação adjacentes preservando espaços intermediários
    cleaned = cleaned.replace(/<\/(strong|b|em|i|u|s|sup|sub)>(\s*)<\1>/gi, (m, tag, sp) => sp || '');

    // 2. Trata tags fragmentadas no início contendo apenas o asterisco (ex: <strong>*</strong><strong>A)</strong>)
    cleaned = cleaned.replace(/^<([a-z0-9]+)[^>]*>\s*\*+\s*<\/\1>\s*/i, '');

    const letterClass = expectedLetter ? `[${expectedLetter.toLowerCase()}${expectedLetter.toUpperCase()}]` : '[a-eA-E]';

    // Expressões regulares para identificar o prefixo da alternativa:
    // Captura: 1 = tag externa se houver, 2 = asterisco, 3/4/5 = letra, 4/6 = delimitador
    const fullTagPrefixRegex = new RegExp(`^<([a-z0-9]+)[^>]*>\\s*(\\*?)\\s*(?:\\(?(${letterClass})([\\)\\.\\:\\]\\–\\—-]\\s*)|\\((${letterClass})\\)\\s*)<\\/\\1>\\s*`, 'i');
    const insideTagPrefixRegex = new RegExp(`^(<[a-z0-9]+[^>]*>)\\s*(\\*?)\\s*(?:\\(?(${letterClass})([\\)\\.\\:\\]\\–\\—-]\\s*)|\\((${letterClass})\\)\\s*)`, 'i');
    const plainPrefixRegex = new RegExp(`^\\s*(\\*?)\\s*(?:\\(?(${letterClass})([\\)\\.\\:\\]\\–\\—-]\\s*)|\\((${letterClass})\\)\\s*)`, 'i');

    let matchedLetter = null;
    let matchedDelimiter = null;

    // Remove apenas o primeiro prefixo da alternativa
    if (fullTagPrefixRegex.test(cleaned)) {
      const m = cleaned.match(fullTagPrefixRegex);
      matchedLetter = (m[3] || m[5] || '').toLowerCase();
      matchedDelimiter = m[4] ? m[4].trim() : ')';
      cleaned = cleaned.replace(fullTagPrefixRegex, '');
    } else if (insideTagPrefixRegex.test(cleaned)) {
      const m = cleaned.match(insideTagPrefixRegex);
      matchedLetter = (m[3] || m[5] || '').toLowerCase();
      matchedDelimiter = m[4] ? m[4].trim() : ')';
      cleaned = cleaned.replace(insideTagPrefixRegex, '$1');
    } else if (plainPrefixRegex.test(cleaned)) {
      const m = cleaned.match(plainPrefixRegex);
      matchedLetter = (m[2] || m[4] || '').toLowerCase();
      matchedDelimiter = m[3] ? m[3].trim() : ')';
      cleaned = cleaned.replace(plainPrefixRegex, '');
    }

    // Se houver um prefixo idêntico duplicado logo em seguida (ex: *A) *A) ou A) A) com a MESMA letra e MESMO delimitador)
    if (matchedLetter && matchedDelimiter) {
      const escapedDelim = matchedDelimiter.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const dupPattern = new RegExp(`^\\s*\\*?\\s*\\(?${matchedLetter}${escapedDelim}\\s*`, 'i');
      cleaned = cleaned.replace(dupPattern, '');
    }

    // 3. Limpa tags vazias residuais no início (ex: <strong></strong>)
    cleaned = cleaned.replace(/^<([a-z0-9]+)[^>]*>\s*<\/\1>\s*/gi, '');

    return cleaned.trim();
  },

  /**
   * Remove negrito que envolva 100% do texto da alternativa (usado como gabarito no Word),
   * preservando formatações parciais semânticas internas (ex: <strong>SQL</strong> (Structured...)).
   * @param {string} html
   * @returns {string}
   */
  stripFullOptionBold(html) {
    if (!html) return '';
    let trimmed = html.trim();

    let hasPWrapper = false;
    const pMatch = trimmed.match(/^<p[^>]*>([\s\S]*)<\/p>$/i);
    if (pMatch) {
      trimmed = pMatch[1].trim();
      hasPWrapper = true;
    }

    const match = trimmed.match(/^<(strong|b)[^>]*>([\s\S]*)<\/\1>$/i);
    if (match) {
      const inner = match[2];
      // Se não houver fechamento intermediário da mesma tag (evita falso positivo de <strong>A</strong> e <strong>B</strong>)
      if (!inner.includes(`</${match[1]}>`)) {
        trimmed = inner.trim();
      }
    }

    return hasPWrapper ? `<p>${trimmed}</p>` : trimmed;
  }
};
