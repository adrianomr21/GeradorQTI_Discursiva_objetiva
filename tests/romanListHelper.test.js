import { describe, it } from 'node:test';
import assert from 'node:assert';
import { RomanListHelper } from '../js/editor/romanListHelper.js';

describe('RomanListHelper Module', () => {
  describe('toRoman()', () => {
    it('deve converter números de 1 a 20 corretamente em algarismos romanos', () => {
      assert.strictEqual(RomanListHelper.toRoman(1), 'I');
      assert.strictEqual(RomanListHelper.toRoman(2), 'II');
      assert.strictEqual(RomanListHelper.toRoman(3), 'III');
      assert.strictEqual(RomanListHelper.toRoman(4), 'IV');
      assert.strictEqual(RomanListHelper.toRoman(5), 'V');
      assert.strictEqual(RomanListHelper.toRoman(6), 'VI');
      assert.strictEqual(RomanListHelper.toRoman(7), 'VII');
      assert.strictEqual(RomanListHelper.toRoman(8), 'VIII');
      assert.strictEqual(RomanListHelper.toRoman(9), 'IX');
      assert.strictEqual(RomanListHelper.toRoman(10), 'X');
      assert.strictEqual(RomanListHelper.toRoman(11), 'XI');
      assert.strictEqual(RomanListHelper.toRoman(12), 'XII');
      assert.strictEqual(RomanListHelper.toRoman(13), 'XIII');
      assert.strictEqual(RomanListHelper.toRoman(14), 'XIV');
      assert.strictEqual(RomanListHelper.toRoman(15), 'XV');
      assert.strictEqual(RomanListHelper.toRoman(19), 'XIX');
      assert.strictEqual(RomanListHelper.toRoman(20), 'XX');
    });

    it('deve converter números maiores como 40, 50, 90, 100', () => {
      assert.strictEqual(RomanListHelper.toRoman(40), 'XL');
      assert.strictEqual(RomanListHelper.toRoman(50), 'L');
      assert.strictEqual(RomanListHelper.toRoman(90), 'XC');
      assert.strictEqual(RomanListHelper.toRoman(100), 'C');
    });

    it('deve retornar string vazia para valores inválidos ou menores que 1', () => {
      assert.strictEqual(RomanListHelper.toRoman(0), '');
      assert.strictEqual(RomanListHelper.toRoman(-5), '');
      assert.strictEqual(RomanListHelper.toRoman(null), '');
    });
  });

  describe('stripListPrefix()', () => {
    it('deve remover prefixos numéricos (1., 2), 3-, 4 –)', () => {
      assert.strictEqual(RomanListHelper.stripListPrefix('1. Débito em conta'), 'Débito em conta');
      assert.strictEqual(RomanListHelper.stripListPrefix('2) Crédito em conta'), 'Crédito em conta');
      assert.strictEqual(RomanListHelper.stripListPrefix('3- Provisão'), 'Provisão');
      assert.strictEqual(RomanListHelper.stripListPrefix('4 – Reserva Legal'), 'Reserva Legal');
      assert.strictEqual(RomanListHelper.stripListPrefix('(1) Item um'), 'Item um');
      assert.strictEqual(RomanListHelper.stripListPrefix('[1] Item um'), 'Item um');
      assert.strictEqual(RomanListHelper.stripListPrefix('1º - Item um'), 'Item um');
    });

    it('deve remover prefixos alfabéticos (a), b., c -)', () => {
      assert.strictEqual(RomanListHelper.stripListPrefix('a) Primeiro item'), 'Primeiro item');
      assert.strictEqual(RomanListHelper.stripListPrefix('B. Segundo item'), 'Segundo item');
      assert.strictEqual(RomanListHelper.stripListPrefix('c - Terceiro item'), 'Terceiro item');
      assert.strictEqual(RomanListHelper.stripListPrefix('(d) Quarto item'), 'Quarto item');
    });

    it('deve remover prefixos romanos existentes (I., II-, iii))', () => {
      assert.strictEqual(RomanListHelper.stripListPrefix('I. Afirmação um'), 'Afirmação um');
      assert.strictEqual(RomanListHelper.stripListPrefix('II- Afirmação dois'), 'Afirmação dois');
      assert.strictEqual(RomanListHelper.stripListPrefix('iii) Afirmação três'), 'Afirmação três');
      assert.strictEqual(RomanListHelper.stripListPrefix('IV. Afirmação quatro'), 'Afirmação quatro');
      assert.strictEqual(RomanListHelper.stripListPrefix('(V) Afirmação cinco'), 'Afirmação cinco');
    });

    it('deve remover marcadores e traços (-, •, *, >)', () => {
      assert.strictEqual(RomanListHelper.stripListPrefix('- Item com traço'), 'Item com traço');
      assert.strictEqual(RomanListHelper.stripListPrefix('• Item com bullet'), 'Item com bullet');
      assert.strictEqual(RomanListHelper.stripListPrefix('* Item com asterisco'), 'Item com asterisco');
    });

    it('deve preservar texto sem prefixo', () => {
      assert.strictEqual(RomanListHelper.stripListPrefix('Débito em Lucros Acumulados'), 'Débito em Lucros Acumulados');
    });

    it('deve remover tags que envolviam unicamente o prefixo (ex: <strong>1.</strong> Débito)', () => {
      assert.strictEqual(RomanListHelper.stripListPrefix('<strong>1.</strong> Débito em Lucros'), 'Débito em Lucros');
      assert.strictEqual(RomanListHelper.stripListPrefix('<b>a)</b> Primeiro item'), 'Primeiro item');
    });

    it('deve preservar tags que envolvem o restante do texto (ex: 1. <strong>Débito</strong>)', () => {
      assert.strictEqual(RomanListHelper.stripListPrefix('1. <strong>Débito</strong> em Lucros'), '<strong>Débito</strong> em Lucros');
    });
  });

  describe('convertLinesToRoman()', () => {
    it('deve converter array de linhas em itens com numeração romana sequencial', () => {
      const input = [
        '1. Débito em Lucros Acumulados',
        '2. Débito em Dividendos a Pagar',
        '3. Crédito em Lucros Acumulados',
        '4. Débito em Reserva Legal',
        '5. Crédito em Reserva Legal'
      ];
      const result = RomanListHelper.convertLinesToRoman(input);
      assert.deepStrictEqual(result, [
        'I. Débito em Lucros Acumulados',
        'II. Débito em Dividendos a Pagar',
        'III. Crédito em Lucros Acumulados',
        'IV. Débito em Reserva Legal',
        'V. Crédito em Reserva Legal'
      ]);
    });
  });

  describe('convertHtmlToRomanParagraphs()', () => {
    it('deve converter blocos <p> numerados para algarismos romanos sem <ol>/<li>', () => {
      const html = '<p>1. Débito em Lucros Acumulados</p><p>2. Débito em Dividendos</p><p>3. Crédito em Reserva</p>';
      const result = RomanListHelper.convertHtmlToRomanParagraphs(html);
      assert.strictEqual(
        result,
        '<p>I. Débito em Lucros Acumulados</p><p>II. Débito em Dividendos</p><p>III. Crédito em Reserva</p>'
      );
    });

    it('deve converter lista <ol><li>...</li></ol> em parágrafos <p>I. ...</p><p>II. ...</p>', () => {
      const html = '<ol><li>Débito em Lucros Acumulados</li><li>Débito em Dividendos</li><li>Crédito em Reserva</li></ol>';
      const result = RomanListHelper.convertHtmlToRomanParagraphs(html);
      assert.strictEqual(
        result,
        '<p>I. Débito em Lucros Acumulados</p><p>II. Débito em Dividendos</p><p>III. Crédito em Reserva</p>'
      );
      assert.ok(!result.includes('<ol>'));
      assert.ok(!result.includes('<li>'));
    });

    it('deve converter parágrafo contendo <br> separando itens', () => {
      const html = '<p>1. Item um<br>2. Item dois<br>3. Item três</p>';
      const result = RomanListHelper.convertHtmlToRomanParagraphs(html);
      assert.strictEqual(
        result,
        '<p>I. Item um</p><p>II. Item dois</p><p>III. Item três</p>'
      );
    });

    it('deve preservar tags ricas como <strong>, <em> e fórmulas dentro dos parágrafos gerados', () => {
      const html = '<p>1. <strong>Débito</strong> em <em>Lucros</em> de R$ 100,00</p><p>2. <span class="qti-math">\\sqrt{x}</span></p>';
      const result = RomanListHelper.convertHtmlToRomanParagraphs(html);
      assert.strictEqual(
        result,
        '<p>I. <strong>Débito</strong> em <em>Lucros</em> de R$ 100,00</p><p>II. <span class="qti-math">\\sqrt{x}</span></p>'
      );
    });

    it('deve converter texto plano com quebras de linha em parágrafos com algarismos romanos', () => {
      const text = '1. Linha um\n2. Linha dois\n3. Linha três';
      const result = RomanListHelper.convertHtmlToRomanParagraphs(text);
      assert.strictEqual(
        result,
        '<p>I. Linha um</p><p>II. Linha dois</p><p>III. Linha três</p>'
      );
    });
  });
});
