import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ManifestBuilder } from '../js/qti/manifestBuilder.js';

describe('ManifestBuilder Module', () => {
  it('deve gerar o imsmanifest.xml com o schema QTIv2.1 e catálogo de recursos', () => {
    const xml = ManifestBuilder.build(2);

    assert.ok(xml.includes('<schema>QTIv2.1</schema>'));
    assert.ok(xml.includes('<schemaversion>2.0</schemaversion>'));
    
    // Resource do question bank com dependências
    assert.ok(xml.includes('<resource href="qti21/question_bank00001.xml" identifier="question_bank00001" type="imsqti_test_xmlv2p1">'));
    assert.ok(xml.includes('<dependency identifierref="assessmentItem00001"/>'));
    assert.ok(xml.includes('<dependency identifierref="assessmentItem00002"/>'));

    // Resources dos assessment items
    assert.ok(xml.includes('<resource href="qti21/assessmentItem00001.xml" identifier="assessmentItem00001" type="imsqti_item_xmlv2p1">'));
    assert.ok(xml.includes('<resource href="qti21/assessmentItem00002.xml" identifier="assessmentItem00002" type="imsqti_item_xmlv2p1">'));
  });
});
