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

    it('deve sinalizar hasFewOptions true quando questão objetiva possuir menos de 5 alternativas', () => {
      const raw = `Questão 1
Pergunta com 4 alternativas
*a) Opção A
b) Opção B
c) Opção C
d) Opção D`;

      const parsed = QuestionParser.parse(raw, 1);
      assert.ok(parsed);
      assert.strictEqual(parsed.hasFewOptions, true, 'Deve sinalizar menos de 5 alternativas');
    });

    it('deve sinalizar hasFewOptions false quando questão objetiva possuir 5 ou mais alternativas', () => {
      const raw = `Questão 1
Pergunta com 5 alternativas
*a) Opção A
b) Opção B
c) Opção C
d) Opção D
e) Opção E`;

      const parsed = QuestionParser.parse(raw, 1);
      assert.ok(parsed);
      assert.strictEqual(parsed.hasFewOptions, false, 'Não deve sinalizar menos de 5 alternativas quando tiver 5');
    });

    it('deve parsear perfeitamente questão com registros contábeis (C-, D-) e afirmações no enunciado sem confundir com alternativas', () => {
      const raw = `Questão 12

Uma empresa contratou em determinada data um seguro por 36 meses pelo valor de R$12.000,00, sendo pago 50% à vista e o restante em 30 dias. A respeito dessa situação são realizadas as seguintes afirmações:

I- No momento da contratação do seguro, o registro contábil seria esse:

C- Prêmio de seguros a apropriar – R$12.000,00.
D- Caixa ou equivalente de caixa – R$6.000,00
D- Seguros a pagar – R$6.000,00
II- As despesas geradas pelo seguro são apropriadas na medida da vigência do contrato.
III- O valor a ser apropriado mensalmente de despesas com esse seguro seria de R$1.333,33.
É correto o que se afirma em:
A) I, apenas
*B) II, apenas
C) III apenas
D) I e II, apenas
E) II e III apenas
Feedback:
As afirmações I e III estão incorretas. Na afirmação I, os débitos estão invertidos com os créditos. Na afirmação III, o valor correto da realização da despesa seria de R$333,33.`;

      const parsed = QuestionParser.parse(raw, 12);
      assert.ok(parsed);
      assert.strictEqual(parsed.id, 12);
      assert.strictEqual(parsed.type, 'multiple_choice');
      assert.strictEqual(parsed.title, 'Questão 12');

      // Verifica que o enunciado contém o texto completo, incluindo C-, D- e as afirmações
      assert.ok(parsed.prompt.includes('Uma empresa contratou em determinada data um seguro'));
      assert.ok(parsed.prompt.includes('C- Prêmio de seguros a apropriar – R$12.000,00.'));
      assert.ok(parsed.prompt.includes('D- Caixa ou equivalente de caixa – R$6.000,00'));
      assert.ok(parsed.prompt.includes('D- Seguros a pagar – R$6.000,00'));
      assert.ok(parsed.prompt.includes('II- As despesas geradas pelo seguro são apropriadas'));
      assert.ok(parsed.prompt.includes('III- O valor a ser apropriado mensalmente'));
      assert.ok(parsed.prompt.includes('É correto o que se afirma em:'));

      // Verifica as alternativas reais (exatamente 5)
      assert.strictEqual(parsed.options.length, 5);
      assert.strictEqual(parsed.options[0].letter, 'a');
      assert.strictEqual(parsed.options[0].text, 'I, apenas');
      assert.strictEqual(parsed.options[0].isCorrect, false);

      assert.strictEqual(parsed.options[1].letter, 'b');
      assert.strictEqual(parsed.options[1].text, 'II, apenas');
      assert.strictEqual(parsed.options[1].isCorrect, true);

      assert.strictEqual(parsed.options[2].letter, 'c');
      assert.strictEqual(parsed.options[2].text, 'III apenas');

      assert.strictEqual(parsed.options[3].letter, 'd');
      assert.strictEqual(parsed.options[3].text, 'I e II, apenas');

      assert.strictEqual(parsed.options[4].letter, 'e');
      assert.strictEqual(parsed.options[4].text, 'II e III apenas');

      // Validações de integridade
      assert.strictEqual(parsed.hasDuplicateOptions, false, 'Não deve alertar alternativas duplicadas');
      assert.strictEqual(parsed.hasFewOptions, false);
      assert.strictEqual(parsed.needsCorrectAnswerAdjustment, false);
      assert.ok(parsed.feedback.includes('As afirmações I e III estão incorretas.'));
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
