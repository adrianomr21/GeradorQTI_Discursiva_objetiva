import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import { createRequire } from 'module';
import { QtiImporter } from '../js/qti/qtiImporter.js';

// Carrega JSZip no ambiente Node para os testes
const require = createRequire(import.meta.url);
require('../lib/jszip.min.js');

describe('QtiImporter Module', () => {
  it('deve parsear assessmentItem XML de questão objetiva (Múltipla Escolha)', () => {
    const objectiveXml = `<?xml version='1.0' encoding='UTF-8'?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1" 
  title="Questão 1" 
  identifier="QUE__00001">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>answer_2</value>
    </correctResponse>
  </responseDeclaration>
  <itemBody>
    <div>
      <p>Qual a principal linguagem de estilos da Web?</p>
    </div>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1" shuffle="false">
      <simpleChoice identifier="answer_1" fixed="true"><p>HTML</p></simpleChoice>
      <simpleChoice identifier="answer_2" fixed="true"><p>CSS</p></simpleChoice>
      <simpleChoice identifier="answer_3" fixed="true"><p>JavaScript</p></simpleChoice>
    </choiceInteraction>
  </itemBody>
  <modalFeedback identifier="correct_fb" outcomeIdentifier="FEEDBACKBASIC">
    <div>
      <p>CSS define as propriedades visuais da página.</p>
    </div>
  </modalFeedback>
</assessmentItem>`;

    const parsed = QtiImporter.parseAssessmentItem(objectiveXml, 1);
    assert.ok(parsed);
    assert.strictEqual(parsed.id, 1);
    assert.strictEqual(parsed.type, 'multiple_choice');
    assert.strictEqual(parsed.title, 'Questão 1');
    assert.ok(parsed.prompt.includes('Qual a principal linguagem'));
    assert.strictEqual(parsed.options.length, 3);
    assert.strictEqual(parsed.options[0].isCorrect, false);
    assert.strictEqual(parsed.options[1].isCorrect, true);
    assert.strictEqual(parsed.options[1].letter, 'b');
    assert.ok(parsed.options[1].text.includes('CSS'));
    assert.ok(parsed.feedback.includes('CSS define as propriedades'));
  });

  it('deve parsear assessmentItem XML de questão discursiva com Padrão de Resposta e Feedback', () => {
    const discursiveXml = `<?xml version='1.0' encoding='UTF-8'?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1" 
  title="Questão 2 — Roteiro 1" 
  identifier="QUE__00002">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string">
    <correctResponse>
      <value>Padrão: Normalização reduz anomalias de dados.</value>
    </correctResponse>
  </responseDeclaration>
  <itemBody>
    <div>
      <p>Explique o objetivo da normalização.</p>
    </div>
    <extendedTextInteraction responseIdentifier="RESPONSE"/>
    <rubricBlock view="scorer" use="scoring">
      <div>
        <p>Padrão do Professor: Eliminar redundâncias e inconsistências.</p>
      </div>
    </rubricBlock>
  </itemBody>
  <modalFeedback identifier="correct_fb" outcomeIdentifier="FEEDBACKBASIC">
    <div>
      <p>Feedback do Aluno: Excelente resposta sobre formas normais.</p>
    </div>
  </modalFeedback>
</assessmentItem>`;

    const parsed = QtiImporter.parseAssessmentItem(discursiveXml, 2);
    assert.ok(parsed);
    assert.strictEqual(parsed.id, 2);
    assert.strictEqual(parsed.type, 'discursive');
    assert.strictEqual(parsed.title, 'Questão 2 — Roteiro 1');
    assert.ok(parsed.prompt.includes('Explique o objetivo'));
    assert.ok(parsed.modelAnswer.includes('Eliminar redundâncias e inconsistências.'));
    assert.ok(parsed.feedback.includes('Excelente resposta sobre formas normais.'));
  });

  it('deve substituir referências relativas de imagens por Data URLs em Base64', () => {
    const xmlWithImg = `
      <assessmentItem identifier="QUE__00003">
        <itemBody>
          <p>Analise a figura: <img src="../img_q1_1.png" alt="Figura" /></p>
          <extendedTextInteraction />
        </itemBody>
      </assessmentItem>
    `;

    const imageMap = {
      '../img_q1_1.png': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    };

    const parsed = QtiImporter.parseAssessmentItem(xmlWithImg, 3, imageMap);
    assert.ok(parsed);
    assert.ok(parsed.prompt.includes('data:image/png;base64,iVBORw0KGgo'));
  });

  it('deve importar com sucesso um arquivo ZIP de exemplo da pasta ExemplosQti', async () => {
    const sampleZipPath = 'ExemplosQti/Pool_ExportFile_Pool_ExportFile_FUNDAMENTOS_DA_INTELIGENCIA_ARTIFICIAL_PARA_A_GESTAO___avaliacao_discursiva_presencial_vs2.zip';
    if (fs.existsSync(sampleZipPath)) {
      const zipBuffer = fs.readFileSync(sampleZipPath);
      const result = await QtiImporter.importZip(zipBuffer, 1);
      assert.ok(result);
      assert.strictEqual(Array.isArray(result.questions), true);
      assert.strictEqual(result.questions.length, 5);
      assert.strictEqual(result.questions[0].type, 'discursive');
      assert.ok(result.questions[0].prompt.includes('Inteligência Artificial'));
      assert.ok(result.questions[0].modelAnswer.includes('abordagem simbólica'));
    }
  });
});
