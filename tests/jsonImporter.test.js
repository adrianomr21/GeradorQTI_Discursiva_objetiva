import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import { JsonImporter } from '../js/jsonImporter.js';

describe('JsonImporter Module', () => {
  it('deve importar com sucesso um array de questões em formato JSON', () => {
    const jsonStr = JSON.stringify([
      {
        type: 'multiple_choice',
        prompt: '<p>Qual é a capital do Brasil?</p>',
        options: [
          { letter: 'a', text: 'Rio de Janeiro', isCorrect: false },
          { letter: 'b', text: 'São Paulo', isCorrect: false },
          { letter: 'c', text: 'Brasília', isCorrect: true },
          { letter: 'd', text: 'Belo Horizonte', isCorrect: false },
          { letter: 'e', text: 'Salvador', isCorrect: false }
        ],
        feedback: '<p>Brasília é a capital federal.</p>'
      },
      {
        type: 'discursive',
        title: 'Questão Discursiva de História',
        prompt: '<p>Explique a Proclamação da República.</p>',
        modelAnswer: '<p>Ocorreu em 15 de novembro de 1889.</p>',
        feedback: '<p>Destaque Marechal Deodoro da Fonseca.</p>'
      }
    ]);

    const result = JsonImporter.importJson(jsonStr, 1);
    assert.ok(result);
    assert.strictEqual(result.questions.length, 2);

    const q1 = result.questions[0];
    assert.strictEqual(q1.id, 1);
    assert.strictEqual(q1.type, 'multiple_choice');
    assert.strictEqual(q1.title, 'Questão 1');
    assert.strictEqual(q1.options.length, 5);
    assert.strictEqual(q1.options[2].isCorrect, true);
    assert.strictEqual(q1.needsCorrectAnswerAdjustment, false);
    assert.strictEqual(q1.hasFewOptions, false);

    const q2 = result.questions[1];
    assert.strictEqual(q2.id, 2);
    assert.strictEqual(q2.type, 'discursive');
    assert.strictEqual(q2.title, 'Questão Discursiva de História');
    assert.strictEqual(q2.modelAnswer, '<p>Ocorreu em 15 de novembro de 1889.</p>');
  });

  it('deve importar objeto JSON contendo { questions: [...], title: "..." }', () => {
    const jsonStr = JSON.stringify({
      title: 'Avaliação Bimestral 1',
      questions: [
        {
          type: 'multiple_choice',
          prompt: '<p>Questão única</p>',
          options: [
            { letter: 'a', text: 'Opção 1', isCorrect: true },
            { letter: 'b', text: 'Opção 2', isCorrect: false }
          ]
        }
      ]
    });

    const result = JsonImporter.importJson(jsonStr, 5);
    assert.strictEqual(result.title, 'Avaliação Bimestral 1');
    assert.strictEqual(result.questions.length, 1);
    assert.strictEqual(result.questions[0].id, 5);
    assert.strictEqual(result.questions[0].title, 'Questão 5');
    assert.strictEqual(result.questions[0].hasFewOptions, true, 'Deve sinalizar que possui menos de 5 alternativas');
  });

  it('deve importar com sucesso o arquivo data/Questoes_Av3__Somente_Av3__Avalia__o_2.json', () => {
    const filePath = 'data/Questoes_Av3__Somente_Av3__Avalia__o_2.json';
    if (!fs.existsSync(filePath)) return;

    const fileContent = fs.readFileSync(filePath, 'utf8');
    const result = JsonImporter.importJson(fileContent, 1);

    assert.ok(result);
    assert.strictEqual(result.questions.length, 21);

    // 17 objetivas + 4 discursivas
    const objCount = result.questions.filter(q => q.type === 'multiple_choice').length;
    const discCount = result.questions.filter(q => q.type === 'discursive').length;
    assert.strictEqual(objCount, 17);
    assert.strictEqual(discCount, 4);

    const q21 = result.questions[20];
    assert.strictEqual(q21.type, 'discursive');
    assert.ok(q21.prompt.includes('<img src="https://avalia.grupoa.com.br/QuestaoPublic/ViewImage'));
  });

  it('deve lançar erro para JSON inválido ou vazio', () => {
    assert.throws(() => JsonImporter.importJson(''), /vazio/i);
    assert.throws(() => JsonImporter.importJson('{ invalid json '), /inválido/i);
    assert.throws(() => JsonImporter.importJson([]), /Nenhuma questão/i);
    assert.throws(() => JsonImporter.importJson({ otherProp: 123 }), /não reconhecida/i);
  });
});
