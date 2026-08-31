import { describe, it } from 'node:test';
import assert from 'node:assert';

import { LinkHelper } from '../js/editor/linkHelper.js';
import { HtmlSanitizer } from '../js/editor/htmlSanitizer.js';
import { QuestionParser } from '../js/parser.js';

describe('LinkHelper and Hyperlinks Module', () => {
  it('deve normalizar URLs adicionando https:// se nenhum protocolo for fornecido', () => {
    assert.strictEqual(LinkHelper.normalizeUrl('google.com'), 'https://google.com');
    assert.strictEqual(LinkHelper.normalizeUrl('www.ufscar.br/curso'), 'https://www.ufscar.br/curso');
    assert.strictEqual(LinkHelper.normalizeUrl('http://inseguro.org'), 'http://inseguro.org');
    assert.strictEqual(LinkHelper.normalizeUrl('https://seguro.org'), 'https://seguro.org');
    assert.strictEqual(LinkHelper.normalizeUrl('mailto:prof@universidade.edu.br'), 'mailto:prof@universidade.edu.br');
    assert.strictEqual(LinkHelper.normalizeUrl('#secao-1'), '#secao-1');
    assert.strictEqual(LinkHelper.normalizeUrl('   '), '');
    assert.strictEqual(LinkHelper.normalizeUrl(''), '');
  });

  it('deve preservar tags <a>, href e target="_blank" com rel="noopener noreferrer" na sanitização de HTML', () => {
    const rawHtml = '<p>Acesse o <a href="https://mec.gov.br" target="_blank" rel="noopener noreferrer">portal oficial</a> para consultar.</p>';
    const cleaned = HtmlSanitizer.cleanHtml(rawHtml);
    
    assert.ok(cleaned.includes('<a href="https://mec.gov.br"'), 'Deve manter a tag <a> e o href');
    assert.ok(cleaned.includes('target="_blank"'), 'Deve manter target="_blank"');
    assert.ok(cleaned.includes('rel="noopener noreferrer"'), 'Deve manter rel="noopener noreferrer"');
    assert.ok(cleaned.includes('portal oficial'), 'Deve manter o texto âncora');
  });

  it('deve converter para XHTML válido preservando hiperlinks', () => {
    const html = '<p>Consulte a documentação em <a href="https://developer.mozilla.org" target="_blank">MDN Web Docs</a>.</p>';
    const xhtml = HtmlSanitizer.toValidXhtml(html);

    assert.ok(xhtml.includes('<a href="https://developer.mozilla.org" target="_blank">MDN Web Docs</a>'));
  });

  it('deve remover hiperlink mantendo os nós filhos no DOM', () => {
    // Nó mock de texto e link
    const textNode = { textContent: 'link do artigo', nodeType: 3 };
    const parentNode = {
      children: [],
      insertBefore(child, before) {
        this.children.push(child);
      },
      removeChild(child) {
        this.children = this.children.filter(c => c !== child);
      }
    };
    const linkEl = {
      tagName: 'A',
      nodeType: 1,
      childNodes: [textNode],
      parentNode: parentNode
    };
    parentNode.children.push(linkEl);

    // Remove link
    LinkHelper.removeLink(linkEl);

    // O texto deve ser inserido no pai e o linkEl removido
    assert.strictEqual(parentNode.children.includes(linkEl), false, 'Elemento <a> deve ser removido');
    assert.strictEqual(parentNode.children.includes(textNode), true, 'Texto original deve ser preservado');
  });

  it('deve parsear perfeitamente questões contendo hiperlinks no enunciado e alternativas', () => {
    const questionRaw = `
<p><strong>Questão 1</strong></p>
<p>Consulte o artigo completo em <a href="https://exemplo.org/artigo" target="_blank" rel="noopener noreferrer">Exemplo Acadêmico</a> para responder.</p>
<p>*a) Alternativa com <a href="https://exemplo.org/fonte" target="_blank">fonte verificada</a></p>
<p>b) Alternativa comum sem link</p>
<p>c) Terceira alternativa</p>
    `.trim();

    const parsed = QuestionParser.parse(questionRaw, 1);
    assert.ok(parsed, 'Questão deve ser parseada com sucesso');
    assert.strictEqual(parsed.type, 'multiple_choice');
    assert.ok(parsed.prompt.includes('href="https://exemplo.org/artigo"'), 'Prompt deve conter o link');
    assert.ok(parsed.prompt.includes('target="_blank"'), 'Prompt deve conter target="_blank"');
    assert.ok(parsed.options[0].isCorrect, 'Alternativa A deve ser a correta');
    assert.ok(parsed.options[0].text.includes('href="https://exemplo.org/fonte"'), 'Alternativa A deve conter o link');
  });
});
