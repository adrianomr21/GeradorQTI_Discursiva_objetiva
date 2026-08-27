/**
 * parser.js
 * Módulo responsável por analisar o texto colado da questão e convertê-lo
 * em um objeto estruturado (JSON).
 */

import { Logger } from './logger.js';

export const QuestionParser = {
  /**
   * Converte o texto bruto da questão em um objeto estruturado.
   * @param {string} rawText - Texto bruto colado no editor
   * @param {number} nextIndex - Número sequencial da questão
   * @returns {Object|null} Objeto da questão ou null se inválido
   */
  parse(rawText, nextIndex = 1) {
    if (!rawText || !rawText.trim()) {
      Logger.error('O texto da questão está vazio.');
      return null;
    }

    const lines = rawText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (lines.length === 0) {
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

    // Expressão regular rigorosa para alternativas:
    // Ex: *a) Texto, b) Texto, *A. Texto, c - Texto, (d) Texto, etc.
    const optionRegex = /^(\*?)\s*(?:\(?([a-eA-E])[\)\.\:\]]|\(?([a-eA-E])\s*[-–—]|\(([a-eA-E])\))\s+(.*)$/;

    // Expressão regular para identificar início de Padrão de Resposta / Resposta Modelo
    const modelAnswerRegex = /^(?:padr[aã]o\s+de\s+resposta|resposta\s+modelo|crit[eé]rios?\s+de\s+corre[cç][aã]o|resposta\s+esperada)\s*:?\s*(.*)$/i;

    // Expressão regular para identificar início de Feedback / Comentário
    const feedbackRegex = /^(?:feedback|gabarito\s+comentado|coment[aá]rio)\s*:?\s*(.*)$/i;

    // Expressão regular para título inicial (Ex: "Questão 1 — Roteiro 1", "Questão 02", "Q1", etc.)
    const titleRegex = /^(?:quest[aã]o\s*\d+|q\d+)/i;

    let lineIndex = 0;

    // 1. Verifica se a primeira linha é o Título
    if (lines.length > 0 && titleRegex.test(lines[0])) {
      title = lines[0];
      lineIndex = 1;
    }

    // 2. Itera pelas linhas restantes
    for (; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];

      // Verifica se entrou na seção de Padrão de Resposta
      const modelAnswerMatch = line.match(modelAnswerRegex);
      if (modelAnswerMatch) {
        currentSection = 'modelAnswer';
        if (modelAnswerMatch[1] && modelAnswerMatch[1].trim()) {
          modelAnswerLines.push(modelAnswerMatch[1].trim());
        }
        continue;
      }

      // Verifica se entrou na seção de Feedback
      const feedbackMatch = line.match(feedbackRegex);
      if (feedbackMatch) {
        currentSection = 'feedback';
        if (feedbackMatch[1] && feedbackMatch[1].trim()) {
          feedbackLines.push(feedbackMatch[1].trim());
        }
        continue;
      }

      if (currentSection === 'modelAnswer') {
        modelAnswerLines.push(line);
        continue;
      }

      if (currentSection === 'feedback') {
        feedbackLines.push(line);
        continue;
      }

      // Verifica se a linha é uma Alternativa de múltipla escolha
      const optionMatch = line.match(optionRegex);
      if (optionMatch) {
        currentSection = 'options';
        const isCorrect = optionMatch[1] === '*';
        const letter = (optionMatch[2] || optionMatch[3] || optionMatch[4]).toLowerCase();
        const text = optionMatch[5].trim();
        const optionIndex = options.length + 1;

        options.push({
          id: `answer_${optionIndex}`,
          letter: letter,
          text: text,
          isCorrect: isCorrect
        });
      } else {
        // Se ainda estamos no Enunciado
        if (currentSection === 'prompt') {
          promptLines.push(line);
        } else if (currentSection === 'options' && options.length > 0) {
          // Acrescenta linha à última alternativa
          options[options.length - 1].text += ` ${line}`;
        }
      }
    }

    const prompt = promptLines.join('\n');
    const modelAnswer = modelAnswerLines.join('\n');
    const feedback = feedbackLines.join('\n');

    if (!prompt.trim()) {
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
  }
};
