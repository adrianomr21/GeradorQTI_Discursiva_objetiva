/**
 * qtiImporter.js
 * Módulo responsável por importar pacotes QTI 2.1 (.zip),
 * descompactar XMLs de questões, recuperar imagens embutidas (convertendo para Base64)
 * e reconstruir o modelo estruturado de dados (JSON) para inserção/adição contínua na aplicação.
 */

import { Logger } from '../logger.js';
import { HtmlSanitizer } from '../editor/htmlSanitizer.js';

export const QtiImporter = {
  /**
   * Importa e descompacta um pacote QTI 2.1 (.zip).
   * @param {File|Blob|ArrayBuffer|Buffer} zipData - Arquivo ZIP
   * @param {number} startingIndex - Índice inicial para a sequência de questões
   * @returns {Promise<{ questions: Array, title?: string }>} Questões importadas e título
   */
  async importZip(zipData, startingIndex = 1) {
    const JSZipLib = (typeof window !== 'undefined' && window.JSZip) ||
                     (typeof JSZip !== 'undefined' && JSZip) ||
                     (typeof global !== 'undefined' && global.JSZip);

    if (!JSZipLib) {
      throw new Error('Biblioteca JSZip não está disponível no ambiente.');
    }

    Logger.info('Lendo arquivo do pacote QTI (.zip)...');
    const zip = await new JSZipLib().loadAsync(zipData);

    // 1. Mapeia e converte imagens embutidas no ZIP para base64
    const imageMap = await this.extractImages(zip);

    // 2. Extrai o título da atividade (se houver)
    const activityTitle = await this.extractActivityTitle(zip);

    // 3. Localiza os arquivos de questões (assessmentItem*.xml)
    const itemFiles = await this.findAssessmentItemFiles(zip);
    if (itemFiles.length === 0) {
      throw new Error('Nenhum arquivo de questão (assessmentItem*.xml) foi encontrado no pacote.');
    }

    Logger.info(`Localizados ${itemFiles.length} arquivos de questões no pacote.`);

    // 4. Analisa cada item XML
    const questions = [];
    for (let i = 0; i < itemFiles.length; i++) {
      const fileName = itemFiles[i];
      const fileEntry = zip.files[fileName];
      if (!fileEntry) continue;

      const xmlText = await fileEntry.async('text');
      const questionIndex = startingIndex + questions.length;
      const parsedQuestion = this.parseAssessmentItem(xmlText, questionIndex, imageMap);

      if (parsedQuestion) {
        questions.push(parsedQuestion);
        const typeLabel = parsedQuestion.type === 'multiple_choice' ? 'Objetiva' : 'Discursiva';
        Logger.info(`[Importada] #${parsedQuestion.id} "${parsedQuestion.title}" [${typeLabel}]`);
      }
    }

    Logger.success(`${questions.length} questões extraídas com sucesso do pacote QTI.`);
    return {
      questions,
      title: activityTitle
    };
  },

  /**
   * Extrai todas as imagens do ZIP e retorna um mapa [caminho => DataURL base64].
   * @param {Object} zip - Instância do JSZip
   * @returns {Promise<Object>}
   */
  async extractImages(zip) {
    const imageMap = {};
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];

    const fileKeys = Object.keys(zip.files);
    for (const key of fileKeys) {
      const lowerKey = key.toLowerCase();
      const matchedExt = imageExtensions.find(ext => lowerKey.endsWith(ext));

      if (matchedExt && !zip.files[key].dir) {
        try {
          const base64Data = await zip.files[key].async('base64');
          let mime = 'image/png';
          if (matchedExt === '.jpg' || matchedExt === '.jpeg') mime = 'image/jpeg';
          else if (matchedExt === '.gif') mime = 'image/gif';
          else if (matchedExt === '.svg') mime = 'image/svg+xml';
          else if (matchedExt === '.webp') mime = 'image/webp';

          const dataUrl = `data:${mime};base64,${base64Data}`;
          const baseName = key.split('/').pop();

          // Mapeia diferentes variações de caminhos relativos
          imageMap[key] = dataUrl;
          imageMap[baseName] = dataUrl;
          imageMap[`../${baseName}`] = dataUrl;
          imageMap[`./${baseName}`] = dataUrl;
          imageMap[`csfiles/home_dir/${baseName}`] = dataUrl;
          imageMap[`../csfiles/home_dir/${baseName}`] = dataUrl;

          Logger.info(`Imagem importada do pacote: ${baseName}`);
        } catch (err) {
          console.warn(`Erro ao extrair imagem ${key}:`, err);
        }
      }
    }

    return imageMap;
  },

  /**
   * Encontra a lista ordenada de caminhos dos assessmentItem*.xml no pacote.
   * @param {Object} zip
   * @returns {Promise<Array<string>>}
   */
  async findAssessmentItemFiles(zip) {
    const itemPaths = [];

    // Tenta ler a ordem definida no imsmanifest.xml
    if (zip.files['imsmanifest.xml']) {
      try {
        const manifestXml = await zip.files['imsmanifest.xml'].async('text');
        const resourceRegex = /<resource[^>]*\btype=["']imsqti_item_xmlv2p1["'][^>]*\bhref=["']([^"']+)["']/gi;
        let match;
        while ((match = resourceRegex.exec(manifestXml)) !== null) {
          const href = match[1];
          if (zip.files[href]) {
            itemPaths.push(href);
          } else {
            // Tenta href relativo sem barra
            const altKey = Object.keys(zip.files).find(k => k.endsWith(href) || href.endsWith(k));
            if (altKey) itemPaths.push(altKey);
          }
        }
      } catch (err) {
        console.warn('Erro ao ler manifesto para listar itens:', err);
      }
    }

    // Se o manifesto não encontrou os itens, varre a árvore do zip
    if (itemPaths.length === 0) {
      const allFiles = Object.keys(zip.files).filter(k => {
        return !zip.files[k].dir && /assessmentItem[^/]*\.xml$/i.test(k);
      });

      // Ordena numericamente (00001, 00002...)
      allFiles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
      itemPaths.push(...allFiles);
    }

    return itemPaths;
  },

  /**
   * Extrai o título da atividade do question_bank ou do manifesto.
   * @param {Object} zip
   * @returns {Promise<string|null>}
   */
  async extractActivityTitle(zip) {
    // 1. Tenta do question_bank00001.xml
    const bankKey = Object.keys(zip.files).find(k => /question_bank.*\.xml$/i.test(k) || /assessmentTest.*\.xml$/i.test(k));
    if (bankKey) {
      try {
        const xml = await zip.files[bankKey].async('text');
        const titleMatch = xml.match(/<assessmentTest[^>]*\btitle=["']([^"']+)["']/i);
        if (titleMatch && titleMatch[1].trim()) {
          return titleMatch[1].trim();
        }
      } catch (e) {}
    }

    // 2. Tenta do imsmanifest.xml
    if (zip.files['imsmanifest.xml']) {
      try {
        const manifest = await zip.files['imsmanifest.xml'].async('text');
        const titleMatch = manifest.match(/<lom:string[^>]*>([^<]+)<\/lom:string>/i);
        if (titleMatch && titleMatch[1].trim()) {
          return titleMatch[1].trim();
        }
      } catch (e) {}
    }

    return null;
  },

  /**
   * Analisa o XML de um assessmentItem e retorna o objeto de questão padronizado.
   * @param {string} xmlText - Conteúdo XML do assessmentItem
   * @param {number} questionIndex - Número da questão
   * @param {Object} imageMap - Mapa de substituição de imagens
   * @returns {Object|null}
   */
  parseAssessmentItem(xmlText, questionIndex = 1, imageMap = {}) {
    if (!xmlText) return null;

    let xml = xmlText;

    // Substitui caminhos de imagem por seus respectivos Data URLs em Base64
    for (const [imgPath, dataUrl] of Object.entries(imageMap)) {
      xml = xml.split(imgPath).join(dataUrl);
    }

    const isMultipleChoice = xml.includes('<choiceInteraction');
    const isDiscursive = xml.includes('<extendedTextInteraction') || !isMultipleChoice;

    // 1. Extração do Título da Questão
    const titleAttrMatch = xml.match(/<assessmentItem[^>]*\btitle=["']([^"']+)["']/i);
    const idAttrMatch = xml.match(/<assessmentItem[^>]*\bidentifier=["']([^"']+)["']/i);
    let title = (titleAttrMatch && titleAttrMatch[1].trim()) ? titleAttrMatch[1].trim() : '';

    if (!title) {
      if (idAttrMatch && idAttrMatch[1]) {
        const rawId = idAttrMatch[1];
        if (rawId.startsWith('QUE__')) {
          title = `Questão ${questionIndex}`;
        } else {
          title = rawId;
        }
      } else {
        title = `Questão ${questionIndex}`;
      }
    }

    if (isMultipleChoice) {
      // -------------------------------------------------------------
      // QUESTÃO DE MÚLTIPLA ESCOLHA (OBJETIVA)
      // -------------------------------------------------------------

      // 2. Enunciado (Prompt)
      const promptMatch = xml.match(/<itemBody>([\s\S]*?)<choiceInteraction/i);
      let prompt = promptMatch ? this.cleanXmlSnippet(promptMatch[1]) : '';

      // 3. Alternativa Correta
      const correctMatch = xml.match(/<responseDeclaration[^>]*\bidentifier=["']RESPONSE["'][^>]*>[\s\S]*?<correctResponse>[\s\S]*?<value>([\s\S]*?)<\/value>/i);
      const correctId = correctMatch ? correctMatch[1].trim() : 'answer_1';

      // 4. Alternativas (<simpleChoice>)
      const options = [];
      const choiceRegex = /<simpleChoice\s+[^>]*\bidentifier=["']([^"']+)["'][^>]*>([\s\S]*?)<\/simpleChoice>/gi;
      let match;
      let optIndex = 0;

      while ((match = choiceRegex.exec(xml)) !== null) {
        const optId = match[1];
        const optHtml = this.cleanXmlSnippet(match[2]);
        const letter = String.fromCharCode(97 + optIndex);

        options.push({
          id: optId,
          letter: letter,
          text: optHtml,
          isCorrect: (optId === correctId)
        });
        optIndex++;
      }

      // 5. Feedback
      const fbMatch = xml.match(/<modalFeedback[^>]*\bidentifier=["'](?:correct_fb|modal_feedback)["'][^>]*>([\s\S]*?)<\/modalFeedback>/i) ||
                      xml.match(/<modalFeedback[^>]*>([\s\S]*?)<\/modalFeedback>/i);
      const feedback = fbMatch ? this.cleanXmlSnippet(fbMatch[1]) : '';

      return {
        id: questionIndex,
        type: 'multiple_choice',
        title: title,
        prompt: prompt,
        options: options,
        feedback: feedback
      };

    } else {
      // -------------------------------------------------------------
      // QUESTÃO DISCURSIVA (RESPOSTA ABERTA)
      // -------------------------------------------------------------

      // 2. Enunciado (Prompt)
      const promptMatch = xml.match(/<itemBody>([\s\S]*?)<extendedTextInteraction/i) ||
                          xml.match(/<itemBody>([\s\S]*?)<\/itemBody>/i);
      let prompt = promptMatch ? this.cleanXmlSnippet(promptMatch[1]) : '';

      // 3. Padrão de Resposta (RubricBlock view="scorer" ou CorrectResponse)
      const rubricMatch = xml.match(/<rubricBlock[^>]*\bview=["']scorer["'][^>]*>([\s\S]*?)<\/rubricBlock>/i);
      let modelAnswer = rubricMatch ? this.cleanXmlSnippet(rubricMatch[1]) : '';

      if (!modelAnswer) {
        const valMatch = xml.match(/<responseDeclaration[^>]*\bidentifier=["']RESPONSE["'][^>]*>[\s\S]*?<correctResponse>[\s\S]*?<value>([\s\S]*?)<\/value>/i);
        if (valMatch) modelAnswer = this.cleanXmlSnippet(valMatch[1]);
      }

      // 4. Feedback
      const fbMatch = xml.match(/<modalFeedback[^>]*\bidentifier=["'](?:correct_fb|modal_feedback)["'][^>]*>([\s\S]*?)<\/modalFeedback>/i) ||
                      xml.match(/<modalFeedback[^>]*>([\s\S]*?)<\/modalFeedback>/i);
      const feedback = fbMatch ? this.cleanXmlSnippet(fbMatch[1]) : '';

      return {
        id: questionIndex,
        type: 'discursive',
        title: title,
        prompt: prompt,
        options: [],
        modelAnswer: modelAnswer,
        feedback: feedback
      };
    }
  },

  /**
   * Limpa entidades XML e formatações de snippet importadas.
   * @param {string} html
   * @returns {string}
   */
  cleanXmlSnippet(html) {
    if (!html) return '';
    let clean = html.trim();

    // Se estiver envolto em <div> único externo, remove a tag div externa
    clean = clean.replace(/^<div>([\s\S]*)<\/div>$/i, '$1').trim();

    // Substitui entidades comuns do QTI
    clean = clean.replace(/&#xa0;/gi, ' ');
    clean = clean.replace(/&apos;/g, "'");

    return HtmlSanitizer.cleanHtml(clean);
  }
};
