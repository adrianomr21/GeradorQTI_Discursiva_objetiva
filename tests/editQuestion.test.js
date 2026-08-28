import { describe, it } from 'node:test';
import assert from 'node:assert';
import { questionToEditorHtml } from '../js/app.js';
import { QuestionParser } from '../js/parser.js';

describe('Edit Question & Reconstitution Module', () => {
  it('deve converter questão objetiva em HTML para o editor e re-parsear perfeitamente', () => {
    const originalQ = {
      id: 2,
      type: 'multiple_choice',
      title: 'Questão 2',
      prompt: '<p>Qual é a linguagem padrão de estilos para páginas web?</p>',
      options: [
        { id: 'answer_1', letter: 'a', text: 'HTML', isCorrect: false },
        { id: 'answer_2', letter: 'b', text: '<strong>CSS</strong> (Cascading Style Sheets)', isCorrect: true },
        { id: 'answer_3', letter: 'c', text: 'JavaScript', isCorrect: false }
      ],
      feedback: '<p>CSS é a linguagem utilizada para estilizar elementos HTML.</p>'
    };

    const editorHtml = questionToEditorHtml(originalQ);
    assert.ok(editorHtml.includes('Questão 2'));
    assert.ok(editorHtml.includes('Qual é a linguagem padrão'));
    assert.ok(editorHtml.includes('*B)'));
    assert.ok(editorHtml.includes('Feedback:'));

    // Re-parseia o HTML gerado
    const reParsed = QuestionParser.parse(editorHtml, 2);
    assert.ok(reParsed);
    assert.strictEqual(reParsed.id, 2);
    assert.strictEqual(reParsed.type, 'multiple_choice');
    assert.strictEqual(reParsed.options.length, 3);
    assert.strictEqual(reParsed.options[1].isCorrect, true);
    assert.strictEqual(reParsed.options[1].letter, 'b');
    assert.ok(reParsed.options[1].text.includes('CSS'));
    assert.ok(reParsed.feedback.includes('CSS é a linguagem'));
  });

  it('deve converter questão discursiva em HTML para o editor e re-parsear perfeitamente', () => {
    const originalDisc = {
      id: 5,
      type: 'discursive',
      title: 'Questão 5',
      prompt: '<p>Explique o conceito de polimorfismo na POO.</p>',
      options: [],
      modelAnswer: '<p>Polimorfismo permite que classes filhas implementem métodos com o mesmo nome de formas distintas.</p>',
      feedback: '<p>Revise sobre sobrecarga e sobrescrita de métodos.</p>'
    };

    const editorHtml = questionToEditorHtml(originalDisc);
    assert.ok(editorHtml.includes('Questão 5'));
    assert.ok(editorHtml.includes('Padrão de resposta:'));
    assert.ok(editorHtml.includes('Polimorfismo permite'));
    assert.ok(editorHtml.includes('Feedback:'));

    // Re-parseia o HTML gerado
    const reParsed = QuestionParser.parse(editorHtml, 5);
    assert.ok(reParsed);
    assert.strictEqual(reParsed.id, 5);
    assert.strictEqual(reParsed.type, 'discursive');
    assert.ok(reParsed.prompt.includes('Explique o conceito de polimorfismo'));
    assert.ok(reParsed.modelAnswer.includes('Polimorfismo permite que classes filhas'));
    assert.ok(reParsed.feedback.includes('Revise sobre sobrecarga'));
  });
});
