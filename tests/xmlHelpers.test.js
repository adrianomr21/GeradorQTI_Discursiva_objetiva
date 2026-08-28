import { describe, it } from 'node:test';
import assert from 'node:assert';
import { XmlHelpers } from '../js/qti/xmlHelpers.js';

describe('XmlHelpers Module', () => {
  describe('escapeXml()', () => {
    it('deve escapar caracteres especiais & < > " e \'', () => {
      const input = 'Teste & <exemplo> com "aspas" e \'apóstrofo\'';
      const expected = 'Teste &amp; &lt;exemplo&gt; com &quot;aspas&quot; e &apos;apóstrofo&apos;';
      assert.strictEqual(XmlHelpers.escapeXml(input), expected);
    });

    it('deve retornar string vazia para valores nulos ou vazios', () => {
      assert.strictEqual(XmlHelpers.escapeXml(''), '');
      assert.strictEqual(XmlHelpers.escapeXml(null), '');
      assert.strictEqual(XmlHelpers.escapeXml(undefined), '');
    });
  });

  describe('formatContent()', () => {
    it('deve converter linhas de texto simples em tags <p>', () => {
      const text = 'Linha 1\nLinha 2\nLinha 3';
      const formatted = XmlHelpers.formatContent(text);
      assert.strictEqual(formatted, '<p>Linha 1</p>\n<p>Linha 2</p>\n<p>Linha 3</p>');
    });

    it('deve preservar conteúdo que já contenha tags <p> ou <div>', () => {
      const html = '<p>Parágrafo existente</p>';
      assert.strictEqual(XmlHelpers.formatContent(html), html);
    });

    it('deve escapar caracteres especiais dentro dos parágrafos gerados', () => {
      const text = 'A < B & C > D';
      const formatted = XmlHelpers.formatContent(text);
      assert.strictEqual(formatted, '<p>A &lt; B &amp; C &gt; D</p>');
    });
  });

  describe('formatItemIdentifier()', () => {
    it('deve formatar número sequencial para assessmentItem com 5 dígitos', () => {
      assert.strictEqual(XmlHelpers.formatItemIdentifier(1), 'assessmentItem00001');
      assert.strictEqual(XmlHelpers.formatItemIdentifier(42), 'assessmentItem00042');
      assert.strictEqual(XmlHelpers.formatItemIdentifier(999), 'assessmentItem00999');
    });
  });

  describe('formatQuestionIdentifier()', () => {
    it('deve formatar número sequencial para QUE__ com 5 dígitos', () => {
      assert.strictEqual(XmlHelpers.formatQuestionIdentifier(1), 'QUE__00001');
      assert.strictEqual(XmlHelpers.formatQuestionIdentifier(5), 'QUE__00005');
      assert.strictEqual(XmlHelpers.formatQuestionIdentifier(123), 'QUE__00123');
    });
  });
});
