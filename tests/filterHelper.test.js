import { describe, it } from 'node:test';
import assert from 'node:assert';
import { hasQuestionIssues, isDuplicateQuestion, isSameQuestion } from '../js/app.js';
import { QuestionParser } from '../js/parser.js';

describe('Question Filter and Issue Detection Module', () => {
  it('deve identificar questão objetiva sem alternativa correta como tendo problemas', () => {
    const raw = `Questão 1
Qual a capital do Brasil?
a) Rio de Janeiro
b) São Paulo
c) Brasília
d) Belo Horizonte
e) Salvador`;

    const q = QuestionParser.parse(raw, 1);
    assert.strictEqual(hasQuestionIssues(q), true);
  });

  it('deve identificar questão objetiva com múltiplos asteriscos como tendo problemas', () => {
    const raw = `Questão 2
Qual a capital do Brasil?
*a) Rio de Janeiro
*b) São Paulo
*c) Brasília
d) Belo Horizonte
e) Salvador`;

    const q = QuestionParser.parse(raw, 2);
    assert.strictEqual(hasQuestionIssues(q), true);
  });

  it('deve identificar questão objetiva com alternativas repetidas como tendo problemas', () => {
    const raw = `Questão 3
Qual a capital do Brasil?
*a) Brasília
b) São Paulo
c) Brasília
d) Belo Horizonte
e) Salvador`;

    const q = QuestionParser.parse(raw, 3);
    assert.strictEqual(hasQuestionIssues(q), true);
  });

  it('deve identificar questão objetiva com menos de 5 alternativas como tendo problemas', () => {
    const raw = `Questão 4
Qual a capital do Brasil?
a) Rio de Janeiro
b) São Paulo
*c) Brasília
d) Salvador`;

    const q = QuestionParser.parse(raw, 4);
    assert.strictEqual(q.hasFewOptions, true);
    assert.strictEqual(hasQuestionIssues(q), true, 'Questão com 4 alternativas deve ser marcada como tendo pendência/aviso');
  });

  it('deve identificar questão objetiva válida com 5 alternativas, 1 asterisco e sem duplicatas como livre de problemas', () => {
    const raw = `Questão 5
Qual a capital do Brasil?
a) Rio de Janeiro
b) São Paulo
*c) Brasília
d) Belo Horizonte
e) Salvador`;

    const q = QuestionParser.parse(raw, 5);
    assert.strictEqual(q.hasFewOptions, false);
    assert.strictEqual(hasQuestionIssues(q), false);
  });

  it('deve identificar questão discursiva única como livre de problemas', () => {
    const raw = `Questão 6
Explique o ciclo da água.
Padrão de Resposta:
Evaporação, condensação e precipitação.`;

    const q = QuestionParser.parse(raw, 6);
    assert.strictEqual(hasQuestionIssues(q), false);
  });

  it('deve identificar questões repetidas no banco de questões e sinalizar problema', () => {
    const raw1 = `Questão 1
Qual a capital da França?
*a) Paris
b) Lyon
c) Marselha
d) Nice
e) Toulouse`;

    const raw2 = `Questão 2
Qual a capital da França?
*a) Paris
b) Lyon
c) Marselha
d) Nice
e) Toulouse`;

    const raw3 = `Questão 3
Qual a capital da Itália?
*a) Roma
b) Milão
c) Nápoles
d) Turim
e) Florença`;

    const q1 = QuestionParser.parse(raw1, 1);
    const q2 = QuestionParser.parse(raw2, 2);
    const q3 = QuestionParser.parse(raw3, 3);

    const bank = [q1, q2, q3];

    assert.strictEqual(isSameQuestion(q1, q2), true, 'q1 e q2 possuem o mesmo conteúdo');
    assert.strictEqual(isSameQuestion(q1, q3), false, 'q1 e q3 são questões diferentes');

    assert.strictEqual(isDuplicateQuestion(q1, bank), true, 'q1 deve ser identificada como duplicada no banco');
    assert.strictEqual(isDuplicateQuestion(q2, bank), true, 'q2 deve ser identificada como duplicada no banco');
    assert.strictEqual(isDuplicateQuestion(q3, bank), false, 'q3 é única no banco');

    assert.strictEqual(hasQuestionIssues(q1, bank), true, 'q1 tem problema por ser duplicata');
    assert.strictEqual(hasQuestionIssues(q2, bank), true, 'q2 tem problema por ser duplicata');
    assert.strictEqual(hasQuestionIssues(q3, bank), false, 'q3 está perfeita e sem problemas');
  });

  it('deve retornar false com segurança para objetos nulos ou indefinidos', () => {
    assert.strictEqual(hasQuestionIssues(null), false);
    assert.strictEqual(hasQuestionIssues(undefined), false);
  });
});
