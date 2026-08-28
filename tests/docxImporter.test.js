import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import { createRequire } from 'module';
import { DocxImporter } from '../js/docx/docxImporter.js';

// Carrega JSZip no ambiente Node
const require = createRequire(import.meta.url);
require('../lib/jszip.min.js');

describe('DocxImporter Module', () => {
  it('deve converter parágrafo OpenXML com formatações ricas (negrito, itálico, sobrescrito)', () => {
    const pXml = `
      <w:p xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:r><w:t>Texto normal, </w:t></w:r>
        <w:r><w:rPr><w:b/></w:rPr><w:t>texto em negrito</w:t></w:r>
        <w:r><w:t> e </w:t></w:r>
        <w:r><w:rPr><w:vertAlign w:val="superscript"/></w:rPr><w:t>x2</w:t></w:r>
      </w:p>
    `;

    const html = DocxImporter.parseParagraph(pXml);
    assert.ok(html);
    assert.ok(html.includes('Texto normal,'));
    assert.ok(html.includes('<strong>texto em negrito</strong>'));
    assert.ok(html.includes('<sup>x2</sup>'));
  });

  it('deve converter tabela OpenXML (<w:tbl>) para <table> HTML', () => {
    const tblXml = `
      <w:tbl xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:tr>
          <w:tc><w:p><w:r><w:t>Coluna 1</w:t></w:r></w:p></w:tc>
          <w:tc><w:p><w:r><w:t>Coluna 2</w:t></w:r></w:p></w:tc>
        </w:tr>
        <w:tr>
          <w:tc><w:p><w:r><w:t>Dado A</w:t></w:r></w:p></w:tc>
          <w:tc><w:p><w:r><w:t>Dado B</w:t></w:r></w:p></w:tc>
        </w:tr>
      </w:tbl>
    `;

    const tableHtml = DocxImporter.parseTable(tblXml);
    assert.ok(tableHtml);
    assert.ok(tableHtml.includes('<table'));
    assert.ok(tableHtml.includes('Coluna 1'));
    assert.ok(tableHtml.includes('Dado B'));
  });

  it('deve importar com sucesso o banco completo de 20 questões do arquivo Word .docx real', async () => {
    const docxPath = 'ExemplosQti/Avaliacao_Final_IA_Gestao_R1aR6_feedback_geral_VALIDADO.docx';
    if (!fs.existsSync(docxPath)) return;

    const buffer = fs.readFileSync(docxPath);
    const result = await DocxImporter.importDocx(buffer, 1);

    assert.ok(result);
    assert.strictEqual(Array.isArray(result.questions), true);
    assert.strictEqual(result.questions.length, 20);

    // 15 primeiras são Objetivas
    for (let i = 0; i < 15; i++) {
      const q = result.questions[i];
      assert.strictEqual(q.type, 'multiple_choice');
      assert.strictEqual(q.options.length, 5);
      assert.ok(q.options.some(o => o.isCorrect), `Questão ${i + 1} deve ter alternativa correta`);
      assert.ok(q.feedback.length > 0, `Questão ${i + 1} deve conter feedback`);
    }

    // Últimas 5 são Dissertativas / Discursivas
    for (let i = 15; i < 20; i++) {
      const q = result.questions[i];
      assert.strictEqual(q.type, 'discursive');
      assert.ok(q.modelAnswer && q.modelAnswer.length > 0, `Questão ${i + 1} deve conter padrão de resposta`);
    }

    // Validação específica da Questão 1
    const q1 = result.questions[0];
    assert.ok(q1.prompt.includes('A Inteligência Artificial é mais bem descrita como'));
    assert.strictEqual(q1.options[0].isCorrect, true); // *A)
    assert.ok(q1.feedback.includes('campo da ciência da computação'));

    // Validação específica da Questão 16 (Dissertativa 1)
    const q16 = result.questions[15];
    assert.ok(q16.prompt.includes('abordagem simbólica'));
    assert.ok(q16.modelAnswer.includes('abordagem simbólica, o conhecimento é codificado'));
  });
});
