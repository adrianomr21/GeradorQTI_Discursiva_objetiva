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

  it('não deve marcar como repetidas questões com o mesmo texto de enunciado mas alternativas diferentes', () => {
    const q1 = {
      id: 1,
      type: 'multiple_choice',
      prompt: '<p>A partir da análise do trecho de código em linguagem Java abaixo, é correto afirmar que:</p>',
      options: [
        { letter: 'a', text: 'Opção A1', isCorrect: false },
        { letter: 'b', text: 'Opção B1', isCorrect: true },
        { letter: 'c', text: 'Opção C1', isCorrect: false },
        { letter: 'd', text: 'Opção D1', isCorrect: false },
        { letter: 'e', text: 'Opção E1', isCorrect: false }
      ]
    };

    const q2 = {
      id: 2,
      type: 'multiple_choice',
      prompt: '<p>A partir da análise do trecho de código em linguagem Java abaixo, é correto afirmar que:</p>',
      options: [
        { letter: 'a', text: 'Opção A2 diferente', isCorrect: false },
        { letter: 'b', text: 'Opção B2 diferente', isCorrect: false },
        { letter: 'c', text: 'Opção C2 diferente', isCorrect: true },
        { letter: 'd', text: 'Opção D2 diferente', isCorrect: false },
        { letter: 'e', text: 'Opção E2 diferente', isCorrect: false }
      ]
    };

    assert.strictEqual(isSameQuestion(q1, q2), false);
    assert.strictEqual(isDuplicateQuestion(q1, [q1, q2]), false);
    assert.strictEqual(isDuplicateQuestion(q2, [q1, q2]), false);
  });

  it('não deve marcar como repetidas questões com o mesmo texto de enunciado mas imagens diferentes', () => {
    const q1 = {
      id: 1,
      type: 'multiple_choice',
      prompt: '<p>Considere o código a seguir:</p><p><img src="data:image/png;base64,IMAGEM_1_AAA" /></p>',
      options: [
        { letter: 'a', text: 'Opção 1', isCorrect: true },
        { letter: 'b', text: 'Opção 2', isCorrect: false },
        { letter: 'c', text: 'Opção 3', isCorrect: false },
        { letter: 'd', text: 'Opção 4', isCorrect: false },
        { letter: 'e', text: 'Opção 5', isCorrect: false }
      ]
    };

    const q2 = {
      id: 2,
      type: 'multiple_choice',
      prompt: '<p>Considere o código a seguir:</p><p><img src="data:image/png;base64,IMAGEM_2_BBB" /></p>',
      options: [
        { letter: 'a', text: 'Opção 1', isCorrect: true },
        { letter: 'b', text: 'Opção 2', isCorrect: false },
        { letter: 'c', text: 'Opção 3', isCorrect: false },
        { letter: 'd', text: 'Opção 4', isCorrect: false },
        { letter: 'e', text: 'Opção 5', isCorrect: false }
      ]
    };

    assert.strictEqual(isSameQuestion(q1, q2), false);
    assert.strictEqual(isDuplicateQuestion(q1, [q1, q2]), false);
    assert.strictEqual(isDuplicateQuestion(q2, [q1, q2]), false);
  });

  it('deve marcar como repetidas questões com as mesmas alternativas mesmo que estejam embaralhadas', () => {
    const q1 = {
      id: 1,
      type: 'multiple_choice',
      prompt: '<p>Qual é a capital da França?</p>',
      options: [
        { letter: 'a', text: 'Paris', isCorrect: true },
        { letter: 'b', text: 'Lyon', isCorrect: false },
        { letter: 'c', text: 'Marselha', isCorrect: false },
        { letter: 'd', text: 'Nice', isCorrect: false },
        { letter: 'e', text: 'Toulouse', isCorrect: false }
      ]
    };

    const q2 = {
      id: 2,
      type: 'multiple_choice',
      prompt: '<p>Qual é a capital da França?</p>',
      options: [
        { letter: 'a', text: 'Toulouse', isCorrect: false },
        { letter: 'b', text: 'Paris', isCorrect: true },
        { letter: 'c', text: 'Nice', isCorrect: false },
        { letter: 'd', text: 'Lyon', isCorrect: false },
        { letter: 'e', text: 'Marselha', isCorrect: false }
      ]
    };

    assert.strictEqual(isSameQuestion(q1, q2), true);
    assert.strictEqual(isDuplicateQuestion(q1, [q1, q2]), true);
  });

  it('deve retornar false com segurança para objetos nulos ou indefinidos', () => {
    assert.strictEqual(hasQuestionIssues(null), false);
    assert.strictEqual(hasQuestionIssues(undefined), false);
  });
});

