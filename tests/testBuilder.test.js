import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TestBuilder } from '../js/qti/testBuilder.js';

describe('TestBuilder Module', () => {
  it('deve gerar o XML question_bank00001.xml com o título e referências corretas', () => {
    const xml = TestBuilder.build('Avaliação Bimestral - Banco de Dados', 3);

    assert.ok(xml.includes('identifier="question_bank00001"'));
    assert.ok(xml.includes('title="Avaliação Bimestral - Banco de Dados"'));
    assert.ok(xml.includes('<assessmentItemRef identifier="assessmentItem00001" href="assessmentItem00001.xml" />'));
    assert.ok(xml.includes('<assessmentItemRef identifier="assessmentItem00002" href="assessmentItem00002.xml" />'));
    assert.ok(xml.includes('<assessmentItemRef identifier="assessmentItem00003" href="assessmentItem00003.xml" />'));
  });

  it('deve escapar caracteres especiais no título do teste', () => {
    const xml = TestBuilder.build('Avaliação <1> & "2"', 1);
    assert.ok(xml.includes('title="Avaliação &lt;1&gt; &amp; &quot;2&quot;"'));
  });
});
