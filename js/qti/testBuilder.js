/**
 * testBuilder.js
 * Módulo responsável por gerar o XML do banco de questões / teste (qti21/question_bank00001.xml).
 * Ele agrupa e sequencia todas as questões contidas no pacote.
 */

import { XmlHelpers } from './xmlHelpers.js';

export const TestBuilder = {
  /**
   * Gera o XML do assessmentTest.
   * @param {string} testTitle - Título da atividade ou pool
   * @param {number} totalQuestions - Quantidade total de questões no pacote
   * @returns {string} XML do question_bank00001.xml
   */
  build(testTitle = 'Banco de Questões QTI', totalQuestions = 1) {
    const escapedTitle = XmlHelpers.escapeXml(testTitle);
    
    // Cria as tags <assessmentItemRef> para cada questão do pacote
    const itemRefs = [];
    for (let i = 1; i <= totalQuestions; i++) {
      const itemId = XmlHelpers.formatItemIdentifier(i);
      itemRefs.push(`<assessmentItemRef identifier="${itemId}" href="${itemId}.xml" />`);
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v2p1 http://www.imsglobal.org/xsd/qti/qtiv2p1/imsqti_v2p1.xsd" 
  identifier="question_bank00001" 
  title="${escapedTitle}">
  
  <testPart identifier="question_bank00001_1" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSection identifier="question_bank00001_1_1" visible="false" title="Section 1">
      ${itemRefs.join('\n      ')}
    </assessmentSection>
  </testPart>
</assessmentTest>`;
  }
};
