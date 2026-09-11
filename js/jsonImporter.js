/**
 * jsonImporter.js
 * Módulo responsável por importar bancos de questões em formato JSON (.json),
 * validar a estrutura, reindexar sequencialmente e normalizar flags e propriedades.
 */

import { Logger } from './logger.js';
import { HtmlSanitizer } from './editor/htmlSanitizer.js';
import { QuestionParser } from './parser.js';

export const JsonImporter = {
  /**
   * Importa questões a partir de uma string JSON ou objeto/array já parseado.
   * @param {string|Array|Object} jsonData - Texto JSON ou objeto/array
   * @param {number} startingIndex - Índice inicial para numeração das questões
   * @returns {{ questions: Array, title?: string }}
   */
  importJson(jsonData, startingIndex = 1) {
    let parsed;
    if (typeof jsonData === 'string') {
      if (!jsonData || !jsonData.trim()) {
        throw new Error('O arquivo JSON está vazio.');
      }
      try {
        parsed = JSON.parse(jsonData);
      } catch (err) {
        throw new Error(`Arquivo JSON inválido: ${err.message}`);
      }
    } else {
      parsed = jsonData;
    }

    if (!parsed) {
      throw new Error('O arquivo JSON está vazio ou em formato inválido.');
    }

    let rawQuestions = [];
    let title = null;

    if (Array.isArray(parsed)) {
      rawQuestions = parsed;
    } else if (typeof parsed === 'object') {
      if (Array.isArray(parsed.questions)) {
        rawQuestions = parsed.questions;
        if (parsed.title && typeof parsed.title === 'string') {
          title = parsed.title.trim();
        }
      } else if (parsed.prompt || parsed.type) {
        rawQuestions = [parsed];
      } else {
        throw new Error('Estrutura JSON não reconhecida. Esperado um array de questões ou objeto com a propriedade "questions".');
      }
    }

    if (rawQuestions.length === 0) {
      throw new Error('Nenhuma questão encontrada no arquivo JSON.');
    }

    Logger.info(`Lendo ${rawQuestions.length} questões do arquivo JSON...`);

    const questions = [];
    for (let i = 0; i < rawQuestions.length; i++) {
      const rawQ = rawQuestions[i];
      const qIndex = startingIndex + questions.length;

      const normalized = this.normalizeQuestion(rawQ, qIndex);
      if (normalized) {
        questions.push(normalized);
        const typeLabel = normalized.type === 'multiple_choice' ? 'Objetiva' : 'Discursiva';
        Logger.info(`[Importada do JSON] #${normalized.id} "${normalized.title}" [${typeLabel}]`);
      } else {
        Logger.warn(`Item #${i + 1} do JSON ignorado por falta de enunciado (prompt).`);
      }
    }

    if (questions.length === 0) {
      throw new Error('Nenhuma questão válida pôde ser importada do arquivo JSON.');
    }

    Logger.success(`${questions.length} questões importadas com sucesso do arquivo JSON!`);
    return {
      questions,
      title
    };
  },

  /**
   * Normaliza um objeto de questão individual garantindo campos obrigatórios, sanitização e flags
   * @param {Object} rawQ
   * @param {number} nextIndex
   * @returns {Object|null}
   */
  normalizeQuestion(rawQ, nextIndex) {
    if (!rawQ || typeof rawQ !== 'object') return null;

    const rawPrompt = (rawQ.prompt || '').trim();
    if (!rawPrompt) return null;

    const prompt = HtmlSanitizer.toValidXhtml(rawPrompt);
    const type = rawQ.type === 'discursive' ? 'discursive' : 'multiple_choice';

    // Determina o título da questão
    let title = `Questão ${nextIndex}`;
    if (rawQ.title && typeof rawQ.title === 'string') {
      const trimmedTitle = rawQ.title.trim();
      if (!/^Quest[ãa]o\s*\d+$/i.test(trimmedTitle)) {
        title = trimmedTitle;
      }
    }

    const rawModelAnswer = (rawQ.modelAnswer || '').trim();
    const modelAnswer = rawModelAnswer ? HtmlSanitizer.toValidXhtml(rawModelAnswer) : '';

    const rawFeedback = (rawQ.feedback || '').trim();
    const feedback = rawFeedback ? HtmlSanitizer.toValidXhtml(rawFeedback) : '';

    if (type === 'multiple_choice') {
      const rawOptions = Array.isArray(rawQ.options) ? rawQ.options : [];
      let hadMultipleCorrect = false;
      let hasFoundCorrect = false;

      const options = rawOptions.map((opt, optIdx) => {
        const letter = (opt.letter || String.fromCharCode(97 + optIdx)).toLowerCase();
        let isCorrect = !!opt.isCorrect;

        if (isCorrect) {
          if (!hasFoundCorrect) {
            hasFoundCorrect = true;
          } else {
            hadMultipleCorrect = true;
            isCorrect = false; // Mantém apenas a primeira correta
          }
        }

        const optText = (opt.text || '').trim();
        return {
          id: opt.id || `answer_${optIdx + 1}`,
          letter: letter,
          text: optText ? HtmlSanitizer.toValidXhtml(optText) : '',
          isCorrect: isCorrect
        };
      });

      const needsAdjustment = !hasFoundCorrect;

      // Validação de alternativas repetidas por letra ou texto
      const seenLetters = new Set();
      const seenTexts = new Set();
      let hasDuplicateOptions = false;

      for (const opt of options) {
        const normLetter = (opt.letter || '').toLowerCase().trim();
        const plainText = QuestionParser.stripHtml(opt.text || '').replace(/\s+/g, ' ').trim().toLowerCase();

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

      const hasFewOptions = options.length < 5;

      return {
        id: nextIndex,
        type: 'multiple_choice',
        title: title,
        prompt: prompt,
        options: options,
        modelAnswer: modelAnswer,
        feedback: feedback,
        needsCorrectAnswerAdjustment: typeof rawQ.needsCorrectAnswerAdjustment === 'boolean' ? rawQ.needsCorrectAnswerAdjustment : needsAdjustment,
        hadMultipleCorrectAnswers: typeof rawQ.hadMultipleCorrectAnswers === 'boolean' ? rawQ.hadMultipleCorrectAnswers : hadMultipleCorrect,
        hasDuplicateOptions: typeof rawQ.hasDuplicateOptions === 'boolean' ? rawQ.hasDuplicateOptions : hasDuplicateOptions,
        hasFewOptions: typeof rawQ.hasFewOptions === 'boolean' ? rawQ.hasFewOptions : hasFewOptions
      };
    } else {
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
