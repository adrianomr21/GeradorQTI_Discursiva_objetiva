import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'module';
import { DocxExporter } from '../js/docx/docxExporter.js';
import { DocxImporter } from '../js/docx/docxImporter.js';

// Carrega JSZip no ambiente Node
const require = createRequire(import.meta.url);
require('../lib/jszip.min.js');

describe('DocxExporter Module', () => {
  it('deve escapar caracteres especiais XML e filtrar caracteres de controle', () => {
    const raw = 'Texto & <teste> "aspas" \'simples\' \x00\x08';
    const escaped = DocxExporter.escapeXml(raw);
    assert.strictEqual(escaped, 'Texto &amp; &lt;teste&gt; &quot;aspas&quot; &apos;simples&apos; ');
  });

  it('deve gerar XML do Word para questão de Múltipla Escolha com alternativa correta assinalada por asterisco (*)', () => {
    const questions = [
      {
        id: 1,
        type: 'multiple_choice',
        title: 'Questão 1 - Banco de Dados',
        prompt: '<p>Qual das linguagens é utilizada para consultas relacionais?</p>',
        options: [
          { letter: 'a', text: '<strong>SQL</strong> (Structured Query Language)', isCorrect: true },
          { letter: 'b', text: 'HTML', isCorrect: false },
          { letter: 'c', text: 'CSS', isCorrect: false }
        ],
        feedback: '<p>SQL é a linguagem declarativa padrão.</p>'
      }
    ];

    const context = { images: [], links: [] };
    const docXml = DocxExporter.generateDocumentXml(questions, 'Prova Bimestral', context);

    assert.ok(docXml.includes('Prova Bimestral'), 'Deve incluir o título da atividade');
    assert.ok(docXml.includes('Questão 1 - Banco de Dados'), 'Deve incluir o título da questão');
    assert.ok(docXml.includes('Qual das linguagens é utilizada'), 'Deve incluir o enunciado');
    assert.ok(docXml.includes('*A)'), 'Alternativa correta deve ter prefixo *A)');
    assert.ok(docXml.includes('B)'), 'Alternativa incorreta deve ter prefixo B)');
    assert.ok(docXml.includes('Feedback:'), 'Deve incluir a seção de feedback');
    assert.ok(docXml.includes('SQL é a linguagem declarativa padrão.'), 'Deve incluir o texto do feedback');
  });

  it('deve gerar XML do Word para questão Discursiva com Padrão de Resposta e Feedback', () => {
    const questions = [
      {
        id: 2,
        type: 'discursive',
        title: 'Questão 2 - Dissertativa',
        prompt: '<p>Explique o conceito de <em>polimorfismo</em> em POO.</p>',
        modelAnswer: '<p>Polimorfismo é a capacidade de objetos de diferentes classes responderem à mesma mensagem.</p>',
        feedback: '<p>Lembre-se de citar sobreescrita e sobrecarga de métodos.</p>'
      }
    ];

    const context = { images: [], links: [] };
    const docXml = DocxExporter.generateDocumentXml(questions, 'Avaliação POO', context);

    assert.ok(docXml.includes('Questão 2 - Dissertativa'), 'Deve incluir o título da discursiva');
    assert.ok(docXml.includes('polimorfismo'), 'Deve incluir o texto em itálico');
    assert.ok(docXml.includes('Padrão de Resposta:'), 'Deve incluir o rótulo de padrão de resposta');
    assert.ok(docXml.includes('Polimorfismo é a capacidade'), 'Deve incluir o texto do padrão de resposta');
    assert.ok(docXml.includes('Feedback:'), 'Deve incluir o rótulo de feedback');
  });

  it('deve processar tabelas HTML convertendo em tags OpenXML w:tbl, w:tr e w:tc', () => {
    const questions = [
      {
        id: 3,
        type: 'multiple_choice',
        title: 'Questão com Tabela',
        prompt: '<p>Analise a tabela abaixo:</p><table><tr><th>ID</th><th>Nome</th></tr><tr><td>1</td><td>Admin</td></tr></table>',
        options: [
          { letter: 'a', text: 'Opção 1', isCorrect: true }
        ]
      }
    ];

    const context = { images: [], links: [] };
    const docXml = DocxExporter.generateDocumentXml(questions, 'Teste Tabelas', context);

    assert.ok(docXml.includes('<w:tbl>'), 'Deve conter abertura de tabela w:tbl');
    assert.ok(docXml.includes('<w:tr>'), 'Deve conter linhas w:tr');
    assert.ok(docXml.includes('<w:tc>'), 'Deve conter células w:tc');
    assert.ok(docXml.includes('Admin'), 'Deve conter o conteúdo da célula');
  });

  it('deve extrair imagens base64 e registrar nos relacionamentos e w:drawing', () => {
    const questions = [
      {
        id: 4,
        type: 'discursive',
        title: 'Questão com Imagem',
        prompt: '<p>Observe o gráfico:</p><p><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" /></p>',
        modelAnswer: '<p>Resposta descrita.</p>'
      }
    ];

    const context = { images: [], links: [] };
    const docXml = DocxExporter.generateDocumentXml(questions, 'Teste Imagens', context);

    assert.strictEqual(context.images.length, 1, 'Deve extrair 1 imagem para o contexto');
    assert.strictEqual(context.images[0].filename, 'image_1.png');
    assert.ok(docXml.includes('<w:drawing>'), 'Deve conter elemento de desenho w:drawing');
    assert.ok(docXml.includes('rIdImg_1'), 'Deve referenciar o relacionamento rIdImg_1');
  });

  it('deve processar hiperlinks registrando nos relacionamentos e w:hyperlink', () => {
    const questions = [
      {
        id: 5,
        type: 'multiple_choice',
        title: 'Questão com Link',
        prompt: '<p>Consulte a <a href="https://exemplo.com/docs">Documentação Oficial</a> para responder.</p>',
        options: [
          { letter: 'a', text: 'Opção A', isCorrect: true }
        ]
      }
    ];

    const context = { images: [], links: [] };
    const docXml = DocxExporter.generateDocumentXml(questions, 'Teste Links', context);

    assert.strictEqual(context.links.length, 1, 'Deve registrar 1 link no contexto');
    assert.strictEqual(context.links[0].target, 'https://exemplo.com/docs');
    assert.ok(docXml.includes('<w:hyperlink'), 'Deve conter elemento w:hyperlink');
    assert.ok(docXml.includes('Documentação Oficial'), 'Deve conter o texto do link');
  });

  it('deve formatar fórmulas matemáticas com data-latex em OMML nativo', () => {
    const questions = [
      {
        id: 6,
        type: 'multiple_choice',
        title: 'Questão com Fórmula',
        prompt: '<p>Dada a equação <span class="qti-math" data-latex="f(x) = x^2 + 2x + 1">f(x)</span>, determine a raiz.</p>',
        options: [
          { letter: 'a', text: '<span class="qti-math" data-latex="x = -1">x = -1</span>', isCorrect: true }
        ]
      }
    ];

    const context = { images: [], links: [] };
    const docXml = DocxExporter.generateDocumentXml(questions, 'Teste Math', context);

    assert.ok(docXml.includes('<m:oMath>'), 'Deve conter elemento de equação OMML');
    assert.ok(docXml.includes('<m:sSup>'), 'Deve conter elemento de expoente OMML para x^2');
    assert.ok(docXml.includes('x = -1'), 'Deve incluir a fórmula da alternativa');
  });

  it('deve realizar roundtrip exportando para docx ZIP e reimportando com DocxImporter', async () => {
    const questions = [
      {
        id: 1,
        type: 'multiple_choice',
        title: 'Questão 1',
        prompt: '<p>Qual é a velocidade da luz no vácuo?</p>',
        options: [
          { letter: 'a', text: '300.000 km/s', isCorrect: true },
          { letter: 'b', text: '150.000 km/s', isCorrect: false }
        ],
        feedback: '<p>Aproximadamente 3 x 10^8 m/s.</p>'
      },
      {
        id: 2,
        type: 'discursive',
        title: 'Questão 2',
        prompt: '<p>Defina o princípio da conservação da energia.</p>',
        modelAnswer: '<p>A energia não pode ser criada nem destruída, apenas transformada.</p>',
        feedback: '<p>Primeira Lei da Termodinâmica.</p>'
      }
    ];

    const context = { images: [], links: [] };
    const docXml = DocxExporter.generateDocumentXml(questions, 'Atividade de Física', context);

    const zip = new global.JSZip();
    zip.file('word/document.xml', docXml);
    zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
      </Relationships>
    `);

    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    const imported = await DocxImporter.importDocx(buffer, 1);

    assert.ok(imported.questions, 'Deve reimportar questões');
    assert.strictEqual(imported.questions.length, 2, 'Deve conter 2 questões reimportadas');
    assert.strictEqual(imported.questions[0].type, 'multiple_choice');
    assert.strictEqual(imported.questions[0].options[0].isCorrect, true);
    assert.strictEqual(imported.questions[1].type, 'discursive');
    assert.ok(imported.questions[1].modelAnswer.includes('A energia não pode ser criada'));
  });
});
