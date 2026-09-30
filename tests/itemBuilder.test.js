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

    it('deve preservar listas (ul, ol, li), tabelas e recuos no XML do pacote QTI', () => {
      const richQuestion = {
        id: 3,
        type: 'discursive',
        title: 'Questão 3',
        prompt: '<p>Analise os tópicos:</p><ul><li>Tópico A</li><li>Tópico B</li></ul><blockquote>Citação importante</blockquote>',
        options: [],
        modelAnswer: '<ol><li>Critério 1</li><li>Critério 2</li></ol>',
        feedback: '<p>Excelente análise!</p>'
      };

      const xml = ItemBuilder.build(richQuestion, 3);
      assert.ok(xml.includes('<ul><li>Tópico A</li><li>Tópico B</li></ul>'));
      assert.ok(xml.includes('<blockquote>Citação importante</blockquote>'));
      assert.ok(xml.includes('<ol><li>Critério 1</li><li>Critério 2</li></ol>'));
    });
  });

  describe('Conformidade XML estrita com imagens e tags balanceadas', () => {
    it('deve gerar XML 100% balanceado e válido mesmo se as alternativas possuírem tags não fechadas ou imagens em base64', () => {
      const qWithImages = {
        id: 7,
        type: 'multiple_choice',
        title: 'Questão 7',
        prompt: '<p>Veja o gráfico: <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" alt="Gráfico" /></p>',
        options: [
          { id: 'answer_1', letter: 'a', text: '<strong><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" alt="A" />', isCorrect: true },
          { id: 'answer_2', letter: 'b', text: '<p>Alternativa B</p>', isCorrect: false },
          { id: 'answer_3', letter: 'c', text: '<em>Alternativa C', isCorrect: false }
        ],
        feedback: '<p><strong>Gabarito:</strong> Letra A.</p>'
      };

      const xml = ItemBuilder.build(qWithImages, 7);
      assert.ok(xml.includes('QUE__00007'));
      // Verifica se a tag <strong> na opção A foi fechada antes de fechar </simpleChoice>
      assert.ok(xml.includes('<strong><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" alt="A" /></strong></p></simpleChoice>'));
      // Verifica se a tag <em> na opção C foi fechada
      assert.ok(xml.includes('<p><em>Alternativa C</em></p></simpleChoice>'));
      // Não deve haver tags descasadas
      assert.ok(!xml.includes('<strong><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" alt="A" /></simpleChoice>'));
    });
  });
});
