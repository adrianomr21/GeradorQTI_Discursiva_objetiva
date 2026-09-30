import { describe, it } from 'node:test';
import assert from 'node:assert';
import { HtmlSanitizer } from '../js/editor/htmlSanitizer.js';

describe('HtmlSanitizer Module', () => {
  describe('cleanHtml()', () => {
    it('deve remover tags proprietárias do Word/Office e comentários condicionais', () => {
      const dirtyHtml = '<p class="MsoNormal" style="mso-margin-top-alt:auto"><!--[if gte mso 9]><xml>test</xml><![endif]--><o:p>Texto limpo</o:p></p>';
      const cleaned = HtmlSanitizer.cleanHtml(dirtyHtml);
      assert.strictEqual(cleaned, '<p>Texto limpo</p>');
    });

    it('deve converter tags <b> e <i> para <strong> e <em>', () => {
      const html = '<p><b>Texto em negrito</b> e <i>itálico</i></p>';
      const cleaned = HtmlSanitizer.cleanHtml(html);
      assert.strictEqual(cleaned, '<p><strong>Texto em negrito</strong> e <em>itálico</em></p>');
    });

    it('deve remover tags perigosas como <script>, <style> e <applet>, mas preservar <iframe> e <video>', () => {
      const html = '<p>Texto</p><script>alert("xss")</script><style>body{}</style><iframe src="https://www.youtube.com/embed/xyz" width="560" height="315" allowfullscreen></iframe>';
      const cleaned = HtmlSanitizer.cleanHtml(html);
      assert.ok(!cleaned.includes('<script>'));
      assert.ok(!cleaned.includes('<style>'));
      assert.ok(cleaned.includes('<iframe src="https://www.youtube.com/embed/xyz"'));
    });
  });

  describe('toValidXhtml()', () => {
    it('deve fechar tags vazias como <br>, <hr>, <img> e <source> para conformidade XML', () => {
      const html = '<p>Linha 1<br>Linha 2<hr><img src="foto.png" alt="Foto"><video controls><source src="movie.mp4" type="video/mp4"></video></p>';
      const xhtml = HtmlSanitizer.toValidXhtml(html);
      assert.ok(xhtml.includes('<br />'));
      assert.ok(xhtml.includes('<hr />'));
      assert.ok(xhtml.includes('<img src="foto.png" alt="Foto" />'));
      assert.ok(xhtml.includes('<source src="movie.mp4" type="video/mp4" />'));
      assert.ok(xhtml.includes('controls="controls"'));
    });

    it('deve formatar <iframe> com atributos booleanos válidos em XHTML', () => {
      const html = '<iframe src="https://www.youtube.com/embed/xyz?rel=0&autoplay=1" allowfullscreen></iframe>';
      const xhtml = HtmlSanitizer.toValidXhtml(html);
      assert.ok(xhtml.includes('allowfullscreen="allowfullscreen"'));
      assert.ok(xhtml.includes('&amp;autoplay=1'));
    });

    it('deve escapar & soltos sem duplicar entidades já existentes (&amp;, &lt;)', () => {
      const html = '<p>A & B &amp; C &lt; D</p>';
      const xhtml = HtmlSanitizer.toValidXhtml(html);
      assert.strictEqual(xhtml, '<p>A &amp; B &amp; C &lt; D</p>');
    });

    it('deve balancear e fechar tags não fechadas como <strong> e <em>', () => {
      const unclosed = '<p><strong>Texto com imagem <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" alt="img" /></p>';
      const balanced = HtmlSanitizer.balanceTags(unclosed);
      assert.ok(balanced.includes('</strong>'), 'Deveria fechar a tag strong');
      assert.ok(balanced.endsWith('</p>'), 'Deveria terminar com </p>');
    });

    it('deve descartar tags órfãs de fechamento e tags de fechamento de elementos void como </br> e </img>', () => {
      const messy = '<p>Linha 1</br>Linha 2</img></div><strong>Texto</strong></em></p>';
      const balanced = HtmlSanitizer.balanceTags(messy);
      assert.ok(!balanced.includes('</br>'));
      assert.ok(!balanced.includes('</img>'));
      assert.ok(!balanced.includes('</em>'));
      assert.ok(balanced.includes('<p>Linha 1Linha 2<strong>Texto</strong></p>'));
    });

    it('deve balancear tags inline quando interrompidas por novos blocos <p>', () => {
      const html = '<p><strong>Parágrafo 1<p>Parágrafo 2</strong></p>';
      const balanced = HtmlSanitizer.balanceTags(html);
      // O primeiro <p><strong> deve ter fechado </strong> antes ou ao abrir o novo <p>
      assert.ok(!balanced.includes('<strong> <p>'));
      assert.ok(balanced.includes('<strong>Parágrafo 1</strong>'));
    });
  });
});
