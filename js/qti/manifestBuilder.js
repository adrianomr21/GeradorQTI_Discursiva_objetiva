/**
 * manifestBuilder.js
 * Módulo responsável por gerar o arquivo imsmanifest.xml raiz.
 * Ele define o schema QTIv2.1 e cataloga todos os recursos e dependências do pacote.
 */

import { XmlHelpers } from './xmlHelpers.js';

export const ManifestBuilder = {
  /**
   * Gera o conteúdo do imsmanifest.xml.
   * @param {number} totalQuestions - Quantidade total de questões no pacote
   * @returns {string} XML do imsmanifest.xml
   */
  build(totalQuestions = 1) {
    const dependencies = [];
    const itemResources = [];

    for (let i = 1; i <= totalQuestions; i++) {
      const itemId = XmlHelpers.formatItemIdentifier(i);
      
      // Dependência listada no question_bank
      dependencies.push(`      <dependency identifierref="${itemId}"/>`);

      // Recurso individual do assessmentItem
      itemResources.push(`    <resource href="qti21/${itemId}.xml" identifier="${itemId}" type="imsqti_item_xmlv2p1">
      <file href="qti21/${itemId}.xml"/>
    </resource>`);
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="man00001" 
  xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  xmlns:csm="http://www.imsglobal.org/xsd/imsccv1p2/imscsmd_v1p0" 
  xmlns:imsmd="http://ltsc.ieee.org/xsd/LOM"
  xmlns:imsqti="http://www.imsglobal.org/xsd/imsqti_metadata_v2p1" 
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 http://www.imsglobal.org/xsd/imscp_v1p2.xsd http://ltsc.ieee.org/xsd/LOM imsmd_loose_v1p3.xsd http://www.imsglobal.org/xsd/imsqti_metadata_v2p1 http://www.imsglobal.org/xsd/qti/qtiv2p1/imsqti_metadata_v2p1.xsd http://www.imsglobal.org/xsd/imsccv1p2/imscsmd_v1p0 http://www.imsglobal.org/profile/cc/ccv1p2/ccv1p2_imscsmd_v1p0.xsd">
  
  <metadata>
    <schema>QTIv2.1</schema>
    <schemaversion>2.0</schemaversion>
  </metadata>
  
  <organizations/>
  
  <resources>
    <!-- Recurso do Teste / Question Bank -->
    <resource href="qti21/question_bank00001.xml" identifier="question_bank00001" type="imsqti_test_xmlv2p1">
      <file href="qti21/question_bank00001.xml"/>
${dependencies.join('\n')}
    </resource>

    <!-- Recursos de cada Questão -->
${itemResources.join('\n')}
  </resources>
</manifest>`;
  }
};
