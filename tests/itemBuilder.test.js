import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ItemBuilder } from '../js/qti/itemBuilder.js';

describe('ItemBuilder Module', () => {
  describe('buildMultipleChoice()', () => {
    const questionObj = {
      id: 1,
      type: 'multiple_choice',
      title: 'Questão 1',
      prompt: 'Qual a linguagem de consulta para BDs relacionais?',
      options: [
        { id: 'answer_1', letter: 'a', text: 'SQL', isCorrect: true },
        { id: 'answer_2', letter: 'b', text: 'HTML', isCorrect: false },
        { id: 'answer_3', letter: 'c', text: 'CSS', isCorrect: false }
      ],
      feedback: 'SQL é a resposta correta.'
    };

    it('deve gerar o identificador QUE__00001 na tag raiz', () => {
      const xml = ItemBuilder.build(questionObj, 1);
      assert.ok(xml.includes('identifier="QUE__00001"'));
    });

    it('deve incluir responseDeclaration com a alternativa correta answer_1', () => {
      const xml = ItemBuilder.build(questionObj, 1);
      assert.ok(xml.includes('<correctResponse>'));
      assert.ok(xml.includes('<value>answer_1</value>'));
    });

    it('deve incluir choiceInteraction com todas as opções cadastradas', () => {
      const xml = ItemBuilder.build(questionObj, 1);
      assert.ok(xml.includes('<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1" shuffle="false">'));
      assert.ok(xml.includes('<simpleChoice identifier="answer_1" fixed="true"><p>SQL</p></simpleChoice>'));
      assert.ok(xml.includes('<simpleChoice identifier="answer_2" fixed="true"><p>HTML</p></simpleChoice>'));
      assert.ok(xml.includes('<simpleChoice identifier="answer_3" fixed="true"><p>CSS</p></simpleChoice>'));
    });

    it('deve incluir responseProcessing e modalFeedback para acerto e erro', () => {
      const xml = ItemBuilder.build(questionObj, 1);
      assert.ok(xml.includes('<responseProcessing>'));
      assert.ok(xml.includes('identifier="correct_fb"'));
      assert.ok(xml.includes('identifier="incorrect_fb"'));
      assert.ok(xml.includes('SQL é a resposta correta.'));
    });
  });

  describe('buildDiscursive()', () => {
    const questionDisc = {
      id: 2,
      type: 'discursive',
      title: 'Questão 2',
      prompt: 'Descreva os princípios da normalização.',
      options: [],
      modelAnswer: 'Padrão: 1FN, 2FN e 3FN para integridade de dados.',
      feedback: 'Comentário geral para o aluno.'
    };

    it('deve gerar o identificador QUE__00002 na tag raiz', () => {
      const xml = ItemBuilder.build(questionDisc, 2);
      assert.ok(xml.includes('identifier="QUE__00002"'));
    });

    it('deve incluir extendedTextInteraction no itemBody', () => {
      const xml = ItemBuilder.build(questionDisc, 2);
      assert.ok(xml.includes('<extendedTextInteraction responseIdentifier="RESPONSE"/>'));
    });

    it('deve incluir o Padrão de Resposta em rubricBlock com view="scorer" use="scoring"', () => {
      const xml = ItemBuilder.build(questionDisc, 2);
      assert.ok(xml.includes('<rubricBlock view="scorer" use="scoring">'));
      assert.ok(xml.includes('Padrão: 1FN, 2FN e 3FN para integridade de dados.'));
    });

    it('deve incluir correctResponse com o Padrão de Resposta dentro de responseDeclaration', () => {
      const xml = ItemBuilder.build(questionDisc, 2);
      assert.ok(xml.includes('<correctResponse>'));
      assert.ok(xml.includes('<value>Padrão: 1FN, 2FN e 3FN para integridade de dados.</value>'));
    });

    it('deve incluir modalFeedback com o Feedback pedagógico do aluno', () => {
      const xml = ItemBuilder.build(questionDisc, 2);
      assert.ok(xml.includes('identifier="correct_fb"'));
      assert.ok(xml.includes('Comentário geral para o aluno.'));
    });
  });
});
