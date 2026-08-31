import { describe, it } from 'node:test';
import assert from 'node:assert';
import { QuestionParser } from '../js/parser.js';

describe('QuestionParser Module', () => {
  describe('Questões de Múltipla Escolha', () => {
    it('deve parsear questão objetiva padrão com asterisco na alternativa correta', () => {
      const raw = `Questão 1
Qual é a principal função de um banco de dados relacional?
a) Editar imagens vetoriais
*b) Armazenar e recuperar dados estruturados
c) Reproduzir áudio e vídeo
d) Compilar código binário
Feedback: Bancos relacionais servem para armazenamento estruturado.`;

      const parsed = QuestionParser.parse(raw, 1);
      assert.ok(parsed);
      assert.strictEqual(parsed.id, 1);
      assert.strictEqual(parsed.type, 'multiple_choice');
      assert.strictEqual(parsed.title, 'Questão 1');
      assert.strictEqual(parsed.prompt, 'Qual é a principal função de um banco de dados relacional?');
      assert.strictEqual(parsed.options.length, 4);
      assert.strictEqual(parsed.options[0].isCorrect, false);
      assert.strictEqual(parsed.options[1].isCorrect, true);
      assert.strictEqual(parsed.options[1].letter, 'b');
      assert.strictEqual(parsed.feedback, 'Bancos relacionais servem para armazenamento estruturado.');
    });

    it('deve reconhecer diferentes formatos de prefixo de alternativas (*A., *a), *(c), d -)', () => {
      const raw = `Questão 10
Pergunta de teste
*A. Primeira opção
b) Segunda opção
(c) Terceira opção
d - Quarta opção`;

      const parsed = QuestionParser.parse(raw, 10);
      assert.ok(parsed);
      assert.strictEqual(parsed.options.length, 4);
      assert.strictEqual(parsed.options[0].isCorrect, true);
      assert.strictEqual(parsed.options[0].letter, 'a');
      assert.strictEqual(parsed.options[1].letter, 'b');
      assert.strictEqual(parsed.options[2].letter, 'c');
      assert.strictEqual(parsed.options[3].letter, 'd');
    });

    it('deve sinalizar "Ajustar alternativa correta" caso nenhuma possua asterisco (*)', () => {
      const raw = `Questão 1
Pergunta sem asterisco
a) Opção 1
b) Opção 2`;

      const parsed = QuestionParser.parse(raw, 1);
      assert.ok(parsed);
      assert.strictEqual(parsed.needsCorrectAnswerAdjustment, true);
      assert.strictEqual(parsed.options.some(opt => opt.isCorrect), false);
    });

    it('deve manter apenas a primeira opção se múltiplas forem marcadas com asterisco (*) e sinalizar hadMultipleCorrectAnswers', () => {
      const raw = `Questão 1
Pergunta com múltiplos asteriscos
*a) Opção 1
*b) Opção 2
*c) Opção 3`;

      const parsed = QuestionParser.parse(raw, 1);
      assert.ok(parsed);
      assert.strictEqual(parsed.hadMultipleCorrectAnswers, true, 'Deve sinalizar que havia múltiplas alternativas corretas');
      assert.strictEqual(parsed.options[0].isCorrect, true);
      assert.strictEqual(parsed.options[1].isCorrect, false);
      assert.strictEqual(parsed.options[2].isCorrect, false);
    });

    it('deve remover prefixos repetidos ou com formatação HTML inline fragmentada (*A) *A) ou <strong>*</strong><strong>A)</strong>)', () => {
      const raw = `Questão 1
A Inteligência Artificial é mais bem descrita como:
*A) *A) Um campo da ciência da computação dedicado a sistemas capazes.
B) Uma tecnologia única e padronizada.
C) Um sistema robótico humanoide.
Feedback: Resposta correta é a letra A.`;

      const parsed = QuestionParser.parse(raw, 1);
      assert.ok(parsed);
      assert.strictEqual(parsed.options[0].isCorrect, true);
      assert.strictEqual(parsed.options[0].letter, 'a');
      assert.strictEqual(parsed.options[0].text, 'Um campo da ciência da computação dedicado a sistemas capazes.');

      // Testa também com tags HTML fragmentadas
      const htmlLine = '<p><strong>*</strong><strong>A)</strong> Um campo da computação.</p>';
      const cleanLine = QuestionParser.cleanLineContent(htmlLine);
      const stripped = QuestionParser.removeOptionPrefix(cleanLine);
      assert.strictEqual(stripped, 'Um campo da computação.');
    });

    it('deve identificar e sinalizar alternativas repetidas por conteúdo de texto idêntico', () => {
      const raw = `Questão 1
Pergunta sobre alternativas repetidas
*a) Mesma resposta
b) Outra resposta
c) Mesma resposta`;

      const parsed = QuestionParser.parse(raw, 1);
      assert.ok(parsed);
      assert.strictEqual(parsed.hasDuplicateOptions, true, 'Deve sinalizar alternativas com texto repetido');
    });

    it('deve identificar e sinalizar alternativas repetidas por letras duplicadas', () => {
      const raw = `Questão 1
Pergunta sobre letras repetidas
*a) Primeira resposta
a) Segunda resposta com mesma letra
b) Terceira resposta`;

      const parsed = QuestionParser.parse(raw, 1);
      assert.ok(parsed);
      assert.strictEqual(parsed.hasDuplicateOptions, true, 'Deve sinalizar alternativas com letras duplicadas');
    });

    it('deve retornar hasDuplicateOptions false quando todas as alternativas forem distintas', () => {
      const raw = `Questão 1
Pergunta normal
*a) Opção Alfa
b) Opção Beta
c) Opção Gama`;

      const parsed = QuestionParser.parse(raw, 1);
      assert.ok(parsed);
      assert.strictEqual(parsed.hasDuplicateOptions, false, 'Não deve sinalizar duplicidade quando alternativas forem distintas');
    });
  });

  describe('Questões Discursivas', () => {
    it('deve parsear questão discursiva com Padrão de Resposta e Feedback', () => {
      const raw = `Questão 2
Explique o conceito de normalização em bancos de dados.

Padrão de resposta:
A normalização visa eliminar redundâncias e anomalias nas tabelas relacionais.

Feedback:
Excelente resposta! Lembre-se de mencionar a 1FN, 2FN e 3FN.`;

      const parsed = QuestionParser.parse(raw, 2);
      assert.ok(parsed);
      assert.strictEqual(parsed.id, 2);
      assert.strictEqual(parsed.type, 'discursive');
      assert.strictEqual(parsed.prompt, 'Explique o conceito de normalização em bancos de dados.');
      assert.strictEqual(parsed.options.length, 0);
      assert.strictEqual(parsed.modelAnswer, 'A normalização visa eliminar redundâncias e anomalias nas tabelas relacionais.');
      assert.strictEqual(parsed.feedback, 'Excelente resposta! Lembre-se de mencionar a 1FN, 2FN e 3FN.');
    });

    it('não deve confundir palavras iniciando com A/B/C/D/E nem algarismos romanos com alternativas', () => {
      const raw = `Questão 1 — Roteiro 1
A Inteligência Artificial pode ser desenvolvida por meio de duas abordagens:
I) simbólica;
II) baseada em dados.
Padrão de resposta:
I): regras explícitas.
II): aprendizado por dados.
Feedback:
Muito bem!`;

      const parsed = QuestionParser.parse(raw, 1);
      assert.ok(parsed);
      assert.strictEqual(parsed.type, 'discursive');
      assert.strictEqual(parsed.options.length, 0);
      assert.ok(parsed.prompt.includes('A Inteligência Artificial'));
      assert.ok(parsed.prompt.includes('I) simbólica;'));
      assert.ok(parsed.prompt.includes('II) baseada em dados.'));
      assert.ok(parsed.modelAnswer.includes('I): regras explícitas.'));
    });
  });

  describe('Tratamento de Erros e Casos Limite', () => {
    it('deve retornar null para texto vazio ou com apenas espaços', () => {
      assert.strictEqual(QuestionParser.parse('', 1), null);
      assert.strictEqual(QuestionParser.parse('   \n  \n  ', 1), null);
      assert.strictEqual(QuestionParser.parse(null, 1), null);
    });
  });
});
