import { describe, it } from 'node:test';
import assert from 'node:assert';
import { hasQuestionIssues } from '../js/app.js';
import { QuestionParser } from '../js/parser.js';

describe('Question Filter and Issue Detection Module', () => {
  it('deve identificar questão objetiva sem alternativa correta como tendo problemas', () => {
    const raw = `Questão 1
Qual a capital do Brasil?
a) Rio de Janeiro
b) São Paulo
c) Brasília`;

    const q = QuestionParser.parse(raw, 1);
    assert.strictEqual(hasQuestionIssues(q), true);
  });

  it('deve identificar questão objetiva com múltiplos asteriscos como tendo problemas', () => {
    const raw = `Questão 2
Qual a capital do Brasil?
*a) Rio de Janeiro
*b) São Paulo
*c) Brasília`;

    const q = QuestionParser.parse(raw, 2);
    assert.strictEqual(hasQuestionIssues(q), true);
  });

  it('deve identificar questão objetiva com alternativas repetidas como tendo problemas', () => {
    const raw = `Questão 3
Qual a capital do Brasil?
*a) Brasília
b) São Paulo
c) Brasília`;

    const q = QuestionParser.parse(raw, 3);
    assert.strictEqual(hasQuestionIssues(q), true);
  });

  it('deve identificar questão objetiva válida com 1 asterisco e sem duplicatas como livre de problemas', () => {
    const raw = `Questão 4
Qual a capital do Brasil?
a) Rio de Janeiro
b) São Paulo
*c) Brasília`;

    const q = QuestionParser.parse(raw, 4);
    assert.strictEqual(hasQuestionIssues(q), false);
  });

  it('deve identificar questão discursiva como livre de problemas', () => {
    const raw = `Questão 5
Explique o ciclo da água.
Padrão de Resposta:
Evaporação, condensação e precipitação.`;

    const q = QuestionParser.parse(raw, 5);
    assert.strictEqual(hasQuestionIssues(q), false);
  });

  it('deve retornar false com segurança para objetos nulos ou indefinidos', () => {
    assert.strictEqual(hasQuestionIssues(null), false);
    assert.strictEqual(hasQuestionIssues(undefined), false);
  });
});
