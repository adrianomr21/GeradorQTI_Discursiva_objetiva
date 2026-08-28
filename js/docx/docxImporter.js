/**
 * docxImporter.js
 * Módulo responsável por importar bancos de questões em arquivos Microsoft Word (.docx),
 * extrair imagens embutidas, preservar estilos ricos (negrito, itálico, tabelas, sobrescrito)
 * e segmentar as questões objetivas e discursivas automaticamente.
 */

import { Logger } from '../logger.js';
import { QuestionParser } from '../parser.js';
import { HtmlSanitizer } from '../editor/htmlSanitizer.js';
import { OmmlConverter } from './ommlConverter.js';
import { EmfConverter } from './emfConverter.js';

export const DocxImporter = {
  /**
   * Importa um arquivo Word (.docx) e extrai todas as questões cadastradas.
   * @param {File|Blob|ArrayBuffer|Buffer} docxData - Arquivo ou buffer do .docx
   * @param {number} startingIndex - Índice inicial para numeração das questões
   * @returns {Promise<{ questions: Array, title?: string }>}
   */
  async importDocx(docxData, startingIndex = 1) {
    const JSZipLib = (typeof window !== 'undefined' && window.JSZip) ||
                     (typeof JSZip !== 'undefined' && JSZip) ||
                     (typeof global !== 'undefined' && global.JSZip);

    if (!JSZipLib) {
      throw new Error('Biblioteca JSZip não está disponível no ambiente.');
    }

    Logger.info('Lendo estrutura do arquivo Word (.docx)...');
    const zip = await new JSZipLib().loadAsync(docxData);

    if (!zip.files['word/document.xml']) {
      throw new Error('Arquivo Word inválido: "word/document.xml" não foi encontrado no arquivo .docx.');
    }

    // 1. Extrai mapa de mídias/imagens (Relationships -> Base64 Data URLs)
    const mediaMap = await this.extractMediaMap(zip);

    // 2. Extrai o conteúdo XML do documento
    const docXml = await zip.files['word/document.xml'].async('text');

    // 3. Converte a árvore OpenXML em blocos HTML
    const htmlBlocks = this.convertOpenXmlToHtmlBlocks(docXml, mediaMap);

    // 4. Extrai o título do documento se presente nos primeiros blocos
    const docTitle = this.detectDocumentTitle(htmlBlocks);

    // 5. Segmenta os blocos em questões individuais
    const questionHtmlList = this.segmentQuestions(htmlBlocks);
    if (questionHtmlList.length === 0) {
      throw new Error('Nenhuma questão identificada no documento Word. Certifique-se de que as questões iniciam com "Questão 1", "Questão 2", etc.');
    }

    Logger.info(`Foram identificadas ${questionHtmlList.length} questões no arquivo Word.`);

    // 6. Analisa cada questão com o QuestionParser
    const questions = [];
    for (let i = 0; i < questionHtmlList.length; i++) {
      const qHtml = questionHtmlList[i];
      const qNumber = startingIndex + questions.length;

      const parsed = QuestionParser.parse(qHtml, qNumber);
      if (parsed) {
        questions.push(parsed);
        const typeLabel = parsed.type === 'multiple_choice' ? 'Objetiva' : 'Discursiva';
        Logger.info(`[Importada do Word] #${parsed.id} "${parsed.title}" [${typeLabel}]`);
      } else {
        Logger.warn(`Não foi possível analisar a questão #${qNumber} do Word.`);
      }
    }

    Logger.success(`${questions.length} questões importadas com sucesso do documento Word!`);
    return {
      questions,
      title: docTitle
    };
  },

  /**
   * Extrai o mapa de relacionamentos de mídias e converte imagens em Base64 Data URLs.
   * @param {Object} zip
   * @returns {Promise<Object>} Mapa [rId => data:image/...;base64,...]
   */
  async extractMediaMap(zip) {
    const mediaMap = {};
    const relsPath = 'word/_rels/document.xml.rels';

    if (zip.files[relsPath]) {
      try {
        const relsXml = await zip.files[relsPath].async('text');
        const relRegex = /<Relationship[^>]*\bId=["']([^"']+)["'][^>]*\bTarget=["']([^"']+)["']/gi;
        let match;

        while ((match = relRegex.exec(relsXml)) !== null) {
          const rId = match[1];
          let target = match[2];

          // Corrige caminhos relativos de media
          if (target.startsWith('media/')) target = `word/${target}`;
          else if (!target.startsWith('word/') && zip.files[`word/${target}`]) target = `word/${target}`;

          const fileEntry = zip.files[target];
          if (fileEntry && !fileEntry.dir) {
            const ext = target.split('.').pop().toLowerCase();
            
            // Se for imagem EMF ou WMF, converte para SVG para renderização nativa em todos os navegadores
            if (ext === 'emf' || ext === 'wmf') {
              try {
                const rawBuffer = await fileEntry.async('uint8array');
                if (EmfConverter.isEmf(rawBuffer)) {
                  const svgXml = EmfConverter.toSvg(rawBuffer);
                  if (svgXml) {
                    const base64Svg = (typeof btoa !== 'undefined')
                      ? btoa(unescape(encodeURIComponent(svgXml)))
                      : Buffer.from(svgXml).toString('base64');
                    mediaMap[rId] = `data:image/svg+xml;base64,${base64Svg}`;
                    continue;
                  }
                }
              } catch (emfErr) {
                console.warn('Falha ao converter EMF para SVG:', emfErr);
              }
            }

            const base64Data = await fileEntry.async('base64');
            let mime = 'image/png';
            if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
            else if (ext === 'gif') mime = 'image/gif';
            else if (ext === 'svg') mime = 'image/svg+xml';
            else if (ext === 'webp') mime = 'image/webp';

            mediaMap[rId] = `data:${mime};base64,${base64Data}`;
          }
        }
      } catch (err) {
        console.warn('Erro ao processar relacionamentos de imagens do Word:', err);
      }
    }

    return mediaMap;
  },

  /**
   * Converte o XML OpenXML do Word (<w:p>, <w:tbl>) em uma lista sequencial de blocos HTML.
   * @param {string} docXml
   * @param {Object} mediaMap
   * @returns {Array<string>} Lista de blocos HTML
   */
  convertOpenXmlToHtmlBlocks(docXml, mediaMap = {}) {
    const blocks = [];

    // Captura parágrafos (<w:p>) e tabelas (<w:tbl>) no corpo (<w:body>)
    const bodyMatch = docXml.match(/<w:body[\s>]([\s\S]*?)<\/w:body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : docXml;

    const blockRegex = /<w:p[\s>][\s\S]*?<\/w:p>|<w:tbl[\s>][\s\S]*?<\/w:tbl>/gi;
    let match;

    while ((match = blockRegex.exec(bodyContent)) !== null) {
      const xmlChunk = match[0];
      if (xmlChunk.startsWith('<w:tbl')) {
        const tableHtml = this.parseTable(xmlChunk, mediaMap);
        if (tableHtml) blocks.push(tableHtml);
      } else {
        const paragraphHtml = this.parseParagraph(xmlChunk, mediaMap);
        if (paragraphHtml) blocks.push(paragraphHtml);
      }
    }

    return blocks;
  },

  /**
   * Converte um parágrafo (<w:p>) OpenXML em HTML formatado.
   * @param {string} pXml
   * @param {Object} mediaMap
   * @returns {string}
   */
  parseParagraph(pXml, mediaMap = {}) {
    let pContent = '';

    // Varre runs (<w:r>), equações (<m:oMathPara>, <m:oMath>), quebras (<w:br/>), desenhos (<w:drawing>) e VML (<w:pict>)
    const runRegex = /<m:oMathPara[\s>][\s\S]*?<\/m:oMathPara>|<m:oMath[\s>][\s\S]*?<\/m:oMath>|<w:r[\s>][\s\S]*?<\/w:r>|<w:drawing[\s>][\s\S]*?<\/w:drawing>|<w:pict[\s>][\s\S]*?<\/w:pict>|<w:br(?:\s[^>]*)?\/>/gi;
    let match;

    while ((match = runRegex.exec(pXml)) !== null) {
      const chunk = match[0];

      if (chunk.startsWith('<w:br')) {
        pContent += '<br />';
        continue;
      }

      if (chunk.startsWith('<m:oMath')) {
        const isDisplay = chunk.startsWith('<m:oMathPara');
        const mathHtml = OmmlConverter.toHtml(chunk, isDisplay);
        if (mathHtml) {
          pContent += (pContent ? ' ' : '') + mathHtml;
        }
        continue;
      }

      // Verifica imagens embutidas (DrawingML ou VML) dentro ou fora de <w:r>
      const blipMatch = chunk.match(/r:embed=["']([^"']+)["']|r:id=["']([^"']+)["']|o:relid=["']([^"']+)["']/i);
      if (blipMatch) {
        const rId = blipMatch[1] || blipMatch[2] || blipMatch[3];
        if (rId && mediaMap[rId]) {
          const extentMatch = chunk.match(/<wp:extent\s+cx=["'](\d+)["']\s+cy=["'](\d+)["']/i);
          let dimStyle = 'max-width: 100%; height: auto;';
          if (extentMatch) {
            const widthPx = Math.round(parseInt(extentMatch[1], 10) / 9525);
            if (widthPx > 0) dimStyle = `max-width: 100%; width: ${widthPx}px; height: auto;`;
          }
          pContent += `<img src="${mediaMap[rId]}" style="${dimStyle}" />`;
        }
      }

      // Run de texto <w:t>
      const tMatches = chunk.match(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/gi);
      if (tMatches) {
        let runText = '';
        for (const tMatch of tMatches) {
          const innerText = tMatch.replace(/<[^>]+>/g, '');
          runText += innerText;
        }

        if (runText) {
          // Escapa caracteres especiais básicos
          let formatted = runText
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

          // Aplica estilos de caractere
          const hasBold = /<w:b(?:\s|\/|>)/i.test(chunk) && !/<w:b\s+w:val=["'](?:0|false|none)["']/i.test(chunk);
          const hasItalic = /<w:i(?:\s|\/|>)/i.test(chunk) && !/<w:i\s+w:val=["'](?:0|false|none)["']/i.test(chunk);
          const hasUnderline = /<w:u\s+[^>]*w:val=["'](?!none)/i.test(chunk);
          const hasStrike = /<w:strike(?:\s|\/|>)/i.test(chunk);
          const isSup = /<w:vertAlign\s+[^>]*w:val=["']superscript["']/i.test(chunk);
          const isSub = /<w:vertAlign\s+[^>]*w:val=["']subscript["']/i.test(chunk);

          if (hasBold) formatted = `<strong>${formatted}</strong>`;
          if (hasItalic) formatted = `<em>${formatted}</em>`;
          if (hasUnderline) formatted = `<u>${formatted}</u>`;
          if (hasStrike) formatted = `<s>${formatted}</s>`;
          if (isSup) formatted = `<sup>${formatted}</sup>`;
          if (isSub) formatted = `<sub>${formatted}</sub>`;

          pContent += formatted;
        }
      }
    }

    const trimmed = pContent.trim();
    if (!trimmed) return '';

    return `<p>${trimmed}</p>`;
  },

  /**
   * Converte uma tabela (<w:tbl>) OpenXML em <table> HTML.
   * @param {string} tblXml
   * @param {Object} mediaMap
   * @returns {string}
   */
  parseTable(tblXml, mediaMap = {}) {
    let rowsHtml = '';
    const trRegex = /<w:tr[\s>][\s\S]*?<\/w:tr>/gi;
    let trMatch;

    while ((trMatch = trRegex.exec(tblXml)) !== null) {
      let cellsHtml = '';
      const tcRegex = /<w:tc[\s>][\s\S]*?<\/w:tc>/gi;
      let tcMatch;

      while ((tcMatch = tcRegex.exec(trMatch[0])) !== null) {
        const pRegex = /<w:p[\s>][\s\S]*?<\/w:p>/gi;
        let cellText = '';
        let pMatch;
        while ((pMatch = pRegex.exec(tcMatch[0])) !== null) {
          const parsedP = this.parseParagraph(pMatch[0], mediaMap);
          if (parsedP) {
            cellText += (cellText ? ' ' : '') + parsedP.replace(/^<p>([\s\S]*)<\/p>$/i, '$1');
          }
        }
        cellsHtml += `<td style="border: 1px solid #ccc; padding: 6px 10px;">${cellText || '&nbsp;'}</td>`;
      }

      if (cellsHtml) {
        rowsHtml += `<tr>${cellsHtml}</tr>\n`;
      }
    }

    if (!rowsHtml) return '';
    return `<table style="width: 100%; border-collapse: collapse; margin: 10px 0;">\n<tbody>\n${rowsHtml}</tbody>\n</table>`;
  },

  /**
   * Detecta o título principal do documento caso esteja no início do Word.
   * @param {Array<string>} blocks
   * @returns {string|null}
   */
  detectDocumentTitle(blocks) {
    if (!blocks || blocks.length === 0) return null;

    for (let i = 0; i < Math.min(blocks.length, 3); i++) {
      const text = blocks[i].replace(/<[^>]+>/g, '').trim();
      if (!text) continue;
      // Se encontrar uma questão logo no início, não há título geral antes das questões
      if (/^Quest[ãa]o\s*\d+/i.test(text)) {
        return null;
      }
      // Se for um título curto (não um parágrafo longo de enunciado)
      if (!/^Parte\s+[I|V|X]+/i.test(text) && text.length < 100) {
        return text;
      }
    }

    return null;
  },

  /**
   * Agrupa a sequência de blocos HTML em questões individuais separadas por "Questão X".
   * @param {Array<string>} blocks
   * @returns {Array<string>}
   */
  segmentQuestions(blocks) {
    const questionChunks = [];
    let currentChunk = [];

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const plainText = block.replace(/<[^>]+>/g, '').trim();

      // Verifica se é divisor de seção/cabeçalho geral
      if (/^Parte\s+[I|V|X]+/i.test(plainText) || /^Banco de Quest[õo]es/i.test(plainText)) {
        continue;
      }

      // Verifica se é o início de uma nova questão (ex: "Questão 1", "Questão 2 - Roteiro 1")
      if (/^Quest[ãa]o\s*\d+/i.test(plainText)) {
        if (currentChunk.length > 0) {
          questionChunks.push(currentChunk.join('\n'));
          currentChunk = [];
        }
      }

      if (currentChunk.length > 0 || /^Quest[ãa]o\s*\d+/i.test(plainText)) {
        currentChunk.push(block);
      }
    }

    if (currentChunk.length > 0) {
      questionChunks.push(currentChunk.join('\n'));
    }

    return questionChunks;
  }
};
