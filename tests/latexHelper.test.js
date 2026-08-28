import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'module';

global.self = global;
const require = createRequire(import.meta.url);
require('../lib/katex/katex.min.js');

import { LatexHelper } from '../js/editor/latexHelper.js';
import { HtmlSanitizer } from '../js/editor/htmlSanitizer.js';
import { QuestionParser } from '../js/parser.js';
import { ItemBuilder } from '../js/qti/itemBuilder.js';

describe('LatexHelper and Math Formulas Module', () => {
  it('deve renderizar fórmula quadrática em MathML e HTML com KaTeX', () => {
    const latex = 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}';
    const rendered = LatexHelper.renderFormula(latex, false);

    assert.ok(rendered);
    assert.ok(rendered.includes('class="katex"'));
    assert.ok(rendered.includes('<math xmlns="http://www.w3.org/1998/Math/MathML">'));
    assert.ok(rendered.includes('<mfrac>'));
    assert.ok(rendered.includes('<msqrt>'));
  });

  it('deve renderizar integrais e somatórios em modo display (bloco centralizado)', () => {
    const latex = '\\int_{0}^{\\infty} e^{-x} dx = 1';
    const rendered = LatexHelper.renderFormula(latex, true);

    assert.ok(rendered);
    assert.ok(rendered.includes('class="katex-display"'));
    assert.ok(rendered.includes('<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">'));
  });

  it('deve tratar fórmulas inválidas sem lançar exceções fatais', () => {
    const invalidLatex = '\\frac{a}{';
    const rendered = LatexHelper.renderFormula(invalidLatex, false);

    assert.ok(rendered);
    assert.ok(typeof rendered === 'string');
  });

  it('deve preservar classes katex e atributos data-latex ao higienizar HTML', () => {
    const latex = 'E = mc^2';
    const rendered = LatexHelper.renderFormula(latex, false);
    const inputHtml = `<p>Segundo Einstein: <span class="qti-math" data-latex="${latex}" contenteditable="false">${rendered}</span>.</p>`;

    const cleaned = HtmlSanitizer.cleanHtml(inputHtml);
    assert.ok(cleaned.includes('class="qti-math"'));
    assert.ok(cleaned.includes('data-latex="E = mc^2"'));
    assert.ok(cleaned.includes('<math'));
  });

  it('deve parsear questão contendo fórmulas matemáticas em LaTeX no enunciado e alternativas', () => {
    const formula1 = LatexHelper.renderFormula('f(x) = x^2 - 4x + 4', false);
    const formula2 = LatexHelper.renderFormula('x = 2', false);
    const formula3 = LatexHelper.renderFormula('x = -2', false);

    const rawQuestion = `<p>Encontre a raiz da função <span class="qti-math" data-latex="f(x) = x^2 - 4x + 4">${formula1}</span>:</p>
*A) <span class="qti-math" data-latex="x = 2">${formula2}</span>
B) <span class="qti-math" data-latex="x = -2">${formula3}</span>
Feedback: A única raiz real dupla é 2.`;

    const parsed = QuestionParser.parse(rawQuestion, 1);
    assert.ok(parsed);
    assert.strictEqual(parsed.type, 'multiple_choice');
    assert.strictEqual(parsed.options.length, 2);
    assert.strictEqual(parsed.options[0].isCorrect, true);
    assert.ok(parsed.prompt.includes('qti-math'));
    assert.ok(parsed.options[0].text.includes('qti-math'));
  });

  it('deve gerar XML QTI 2.1 com MathML estrito sem duplicar tags HTML de renderização paralela', () => {
    const formula = LatexHelper.renderFormula('\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1', true);
    const question = {
      id: 1,
      type: 'discursive',
      title: 'Questão de Limite',
      prompt: `<p>Demonstre o limite fundamental: <span class="qti-math" data-latex="\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1">${formula}</span></p>`,
      options: [],
      modelAnswer: "Usando a regra de L'Hôpital ou o Teorema do Confronto.",
      feedback: 'Excelente raciocínio analítico.'
    };

    const xml = ItemBuilder.buildDiscursive(question);
    assert.ok(xml.includes('<assessmentItem'));
    assert.ok(xml.includes('<math xmlns="http://www.w3.org/1998/Math/MathML"'));
    assert.ok(!xml.includes('katex-html'), 'Não deve conter katex-html no XML do QTI para evitar duplicação no LMS');
  });

  it('deve gerar opções de múltipla escolha com MathML limpo sem tags visuais duplicadas', () => {
    const formulaOptA = LatexHelper.renderFormula('3x^2 - 5 + c', false);
    const formulaOptB = LatexHelper.renderFormula('3\\frac{x^2}{2} - 5x + c', false);

    const question = {
      id: 1,
      type: 'multiple_choice',
      title: 'Questão de Integral',
      prompt: '<p>Assinale a alternativa correta:</p>',
      options: [
        { id: 'answer_1', letter: 'a', text: `<span class="qti-math" data-latex="3x^2 - 5 + c">${formulaOptA}</span>`, isCorrect: false },
        { id: 'answer_2', letter: 'b', text: `<span class="qti-math" data-latex="3\\frac{x^2}{2} - 5x + c">${formulaOptB}</span>`, isCorrect: true }
      ],
      modelAnswer: '',
      feedback: 'Gabarito Oficial'
    };

    const xml = ItemBuilder.buildMultipleChoice(question, 1);
    assert.ok(xml.includes('<math xmlns="http://www.w3.org/1998/Math/MathML"'));
    assert.ok(!xml.includes('katex-html'), 'Alternativas não devem conter katex-html duplicado');
  });

  it('deve preservar classes de layout (mfrac, vlist, frac-line, pstrut) de frações após sanitização e parse', () => {
    const fractionFormula = LatexHelper.renderFormula('\\frac{a}{b}', false);
    const htmlWithFraction = `<p>Calcule a fração: <span class="qti-math" data-latex="\\frac{a}{b}" contenteditable="false">${fractionFormula}</span>.</p>`;

    const cleaned = HtmlSanitizer.cleanHtml(htmlWithFraction);
    // Verifica se as classes críticas de posicionamento do KaTeX foram preservadas
    assert.ok(cleaned.includes('class="mfrac"'));
    assert.ok(cleaned.includes('class="frac-line"'));
    assert.ok(cleaned.includes('class="vlist"'));
    assert.ok(cleaned.includes('class="pstrut"'));
    assert.ok(cleaned.includes('class="base"'));

    const parsed = QuestionParser.parse(htmlWithFraction, 1);
    assert.ok(parsed);
    assert.ok(parsed.prompt.includes('class="mfrac"'));
    assert.ok(parsed.prompt.includes('class="frac-line"'));
    assert.ok(parsed.prompt.includes('class="vlist"'));
  });

  it('deve parsear perfeitamente fórmulas com raiz enésima contendo SVG sem confundir caminhos com alternativas', () => {
    const rootFormula = LatexHelper.renderFormula('\\sqrt[n]{x}', false);
    const htmlWithRoot = `<p><strong>Questão 2</strong></p><p><span class="qti-math" data-latex="\\sqrt[n]{x}" contenteditable="false">${rootFormula}</span></p>`;

    const parsed = QuestionParser.parse(htmlWithRoot, 2);
    assert.ok(parsed);
    // Não deve criar alternativas falsas a partir de comandos de curva 'c' do SVG
    assert.strictEqual(parsed.type, 'discursive');
    assert.strictEqual(parsed.options.length, 0);
    assert.ok(parsed.prompt.includes('data-latex="\\sqrt[n]{x}"'));
    assert.ok(parsed.prompt.includes('<svg'));
  });
});