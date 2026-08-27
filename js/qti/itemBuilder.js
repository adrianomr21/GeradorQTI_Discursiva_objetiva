/**
 * itemBuilder.js
 * Módulo responsável por gerar o XML de cada questão (assessmentItem0000X.xml),
 * suportando tanto Múltipla Escolha quanto Discursiva no padrão QTI 2.1.
 */

import { XmlHelpers } from './xmlHelpers.js';

export const ItemBuilder = {
  /**
   * Constrói o XML completo de um item de avaliação.
   * @param {Object} question - Objeto com os dados da questão
   * @param {number} index - Índice sequencial (1, 2, 3...)
   * @returns {string} XML do assessmentItem
   */
  build(question, index) {
    if (question.type === 'multiple_choice') {
      return this.buildMultipleChoice(question, index);
    } else {
      return this.buildDiscursive(question, index);
    }
  },

  /**
   * Constrói o XML para uma questão de Múltipla Escolha (Objetiva).
   */
  buildMultipleChoice(question, index) {
    const questionId = `QUE__${index * 1000 + 1}_1`;
    const formattedPrompt = XmlHelpers.formatContent(question.prompt);
    
    // Identifica qual alternativa é a correta
    const correctOpt = question.options.find(opt => opt.isCorrect) || question.options[0];
    const correctValue = correctOpt ? correctOpt.id : 'answer_1';

    // Monta as tags <simpleChoice>
    const choicesXml = question.options.map(opt => {
      const escapedText = XmlHelpers.escapeXml(opt.text);
      return `<simpleChoice identifier="${opt.id}" fixed="true"><p>${escapedText}</p></simpleChoice>`;
    }).join('');

    // Formata o Feedback / Gabarito Comentado
    const feedbackText = question.feedback ? question.feedback : 'Gabarito oficial';
    const formattedFeedback = XmlHelpers.formatContent(feedbackText);

    return `<?xml version='1.0' encoding='UTF-8'?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1" 
  xmlns:ns9="http://www.imsglobal.org/xsd/apip/apipv1p0/imsapip_qtiv1p0" 
  xmlns:ns8="http://www.w3.org/1999/xlink" 
  title="" 
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v2p1 http://www.imsglobal.org/xsd/qti/qtiv2p1/imsqti_v2p1.xsd" 
  adaptive="false" 
  timeDependent="false" 
  identifier="${questionId}">

  <!-- Declaração da resposta esperada -->
  <responseDeclaration cardinality="single" baseType="identifier" identifier="RESPONSE">
    <correctResponse>
      <value>${correctValue}</value>
    </correctResponse>
  </responseDeclaration>

  <!-- Declarações de pontuação e feedback -->
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <outcomeDeclaration identifier="FEEDBACKBASIC" cardinality="single" baseType="identifier"/>
  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>

  <!-- Corpo da questão: Enunciado e Alternativas -->
  <itemBody>
    <div>
      ${formattedPrompt}
    </div>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1" shuffle="false">
      ${choicesXml}
    </choiceInteraction>
  </itemBody>

  <!-- Processamento de resposta (cálculo de nota e escolha de feedback) -->
  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match>
          <variable identifier="RESPONSE"/>
          <correct identifier="RESPONSE"/>
        </match>
        <setOutcomeValue identifier="SCORE">
          <variable identifier="MAXSCORE"/>
        </setOutcomeValue>
        <setOutcomeValue identifier="FEEDBACKBASIC">
          <baseValue baseType="identifier">correct_fb</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="FEEDBACKBASIC">
          <baseValue baseType="identifier">incorrect_fb</baseValue>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>

  <!-- Feedbacks modais para acerto e erro -->
  <modalFeedback showHide="show" outcomeIdentifier="FEEDBACKBASIC" identifier="correct_fb">
    <div>${formattedFeedback}</div>
  </modalFeedback>
  <modalFeedback showHide="show" outcomeIdentifier="FEEDBACKBASIC" identifier="incorrect_fb">
    <div>${formattedFeedback}</div>
  </modalFeedback>
</assessmentItem>`;
  },

  /**
   * Constrói o XML para uma questão Discursiva.
   */
  buildDiscursive(question, index) {
    const questionId = `QUE__${index * 1000 + 1}_1`;
    const formattedPrompt = XmlHelpers.formatContent(question.prompt);

    // 1. Declaração do Padrão de Resposta (correctResponse e rubricBlock)
    let correctResponseXml = '';
    let rubricBlockXml = '';
    if (question.modelAnswer && question.modelAnswer.trim()) {
      const escapedModelAnswer = XmlHelpers.escapeXml(question.modelAnswer.trim());
      correctResponseXml = `\n    <correctResponse>\n      <value>${escapedModelAnswer}</value>\n    </correctResponse>`;
      
      const formattedModelAnswer = XmlHelpers.formatContent(question.modelAnswer.trim());
      rubricBlockXml = `\n    <rubricBlock view="scorer" use="scoring">\n      <div>\n        ${formattedModelAnswer}\n      </div>\n    </rubricBlock>`;
    }

    // 2. Formata o Feedback / Gabarito Comentado (modalFeedback - visível ao aluno)
    let feedbackContent = question.feedback ? question.feedback.trim() : '';
    let feedbackXml = '';
    if (feedbackContent) {
      const formattedFeedback = XmlHelpers.formatContent(feedbackContent);
      feedbackXml = `\n\n  <!-- Feedback / Comentários da Questão (visível ao aluno) -->
  <modalFeedback showHide="show" outcomeIdentifier="FEEDBACKBASIC" identifier="correct_fb">
    <div>
      ${formattedFeedback}
    </div>
  </modalFeedback>
  <modalFeedback showHide="show" outcomeIdentifier="FEEDBACKBASIC" identifier="incorrect_fb">
    <div>
      ${formattedFeedback}
    </div>
  </modalFeedback>`;
    }

    return `<?xml version='1.0' encoding='UTF-8'?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1" 
  xmlns:ns9="http://www.imsglobal.org/xsd/apip/apipv1p0/imsapip_qtiv1p0" 
  xmlns:ns8="http://www.w3.org/1999/xlink" 
  title="" 
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v2p1 http://www.imsglobal.org/xsd/qti/qtiv2p1/imsqti_v2p1.xsd" 
  adaptive="false" 
  timeDependent="false" 
  identifier="${questionId}">

  <!-- Declaração de resposta em texto livre (string) com Padrão de Resposta -->
  <responseDeclaration cardinality="single" baseType="string" identifier="RESPONSE">${correctResponseXml}
  </responseDeclaration>

  <!-- Declarações de pontuação -->
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <outcomeDeclaration identifier="FEEDBACKBASIC" cardinality="single" baseType="identifier"/>
  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>

  <!-- Corpo da questão: Enunciado, Campo de Digitação e Padrão de Resposta (Exclusivo do Professor) -->
  <itemBody>
    <div>
      ${formattedPrompt}
    </div>
    <extendedTextInteraction responseIdentifier="RESPONSE"/>${rubricBlockXml}
  </itemBody>${feedbackXml}
</assessmentItem>`;
  }
};
