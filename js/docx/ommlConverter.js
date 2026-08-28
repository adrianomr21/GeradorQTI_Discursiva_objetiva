/**
 * ommlConverter.js
 * Módulo responsável por converter equações do Microsoft Word (OMML - Office Math Markup Language)
 * em LaTeX e HTML semântico com KaTeX para importação de documentos .docx.
 * 
 * Utiliza um parser balanceado com correspondência estrita de delimitadores de tag XML para suportar
 * aninhamento arbitrário de estruturas (frações dentro de integrais, potências, limites e parênteses múltiplos).
 */

import { LatexHelper } from '../editor/latexHelper.js';

export const OmmlConverter = {
  /**
   * Converte uma string ou nó de equação OMML (<m:oMath> ou <m:oMathPara>) em LaTeX.
   * @param {string} ommlXml
   * @returns {string} Código LaTeX
   */
  toLatex(ommlXml) {
    if (!ommlXml) return '';
    return this.parseNodes(ommlXml).trim();
  },

  /**
   * Converte uma equação OMML diretamente para a tag <span class="qti-math" data-latex="...">...</span> do editor.
   * @param {string} ommlXml
   * @param {boolean} isDisplay
   * @returns {string} HTML renderizado da fórmula
   */
  toHtml(ommlXml, isDisplay = false) {
    const latex = this.toLatex(ommlXml);
    if (!latex) return '';
    const rendered = LatexHelper.renderFormula(latex, isDisplay);
    return `<span class="qti-math" data-latex="${latex.replace(/"/g, '&quot;')}" data-display="${isDisplay}" contenteditable="false" title="Clique duas vezes para editar a fórmula (LaTeX)">${rendered}</span>`;
  },

  /**
   * Encontra a próxima ocorrência da tag de abertura exata <m:tagName ...> ou <m:tagName> ou <m:tagName/>
   * garantindo que não case com prefixos parciais (ex: <m:e não casa com <m:endChr ou <m:eqArr).
   * @param {string} xml
   * @param {string} tagName
   * @param {number} fromIndex
   * @returns {number}
   */
  findNextOpenTag(xml, tagName, fromIndex = 0) {
    const reg = new RegExp('<m:' + tagName + '(?:[\\s>/])', 'g');
    reg.lastIndex = fromIndex;
    const match = reg.exec(xml);
    return match ? match.index : -1;
  },

  /**
   * Varre e analisa nós OMML balanceados de nível superior.
   * @param {string} xml
   * @returns {string}
   */
  parseNodes(xml) {
    if (!xml) return '';
    let result = '';
    let i = 0;

    while (i < xml.length) {
      // Procura tag de abertura <m:tagName ...>
      const match = xml.substring(i).match(/^<m:([a-zA-Z0-9]+)(?:[\s>/])/);
      if (!match) {
        i++;
        continue;
      }

      const tagName = match[1];
      const startIdx = i;
      const endTag = '</m:' + tagName + '>';

      // Verifica se é auto-fechada
      const tagCloseIdx = xml.indexOf('>', startIdx);
      if (tagCloseIdx === -1) {
        i++;
        continue;
      }

      if (xml.charAt(tagCloseIdx - 1) === '/') {
        // Tag auto-fechada
        const fullChunk = xml.substring(startIdx, tagCloseIdx + 1);
        result += this.handleTag(tagName, fullChunk, '');
        i = tagCloseIdx + 1;
        continue;
      }

      // Procura fechamento balanceado
      let depth = 1;
      let pos = tagCloseIdx + 1;
      const innerStart = tagCloseIdx + 1;
      let endPos = -1;

      while (pos < xml.length) {
        const nextOpen = this.findNextOpenTag(xml, tagName, pos);
        const nextClose = xml.indexOf(endTag, pos);

        if (nextClose === -1) break;

        if (nextOpen !== -1 && nextOpen < nextClose) {
          // Verifica se a abertura é auto-fechada
          const checkClose = xml.indexOf('>', nextOpen);
          if (checkClose !== -1 && xml.charAt(checkClose - 1) === '/') {
            pos = checkClose + 1;
            continue;
          }
          depth++;
          pos = checkClose + 1;
        } else {
          depth--;
          if (depth === 0) {
            endPos = nextClose + endTag.length;
            const fullChunk = xml.substring(startIdx, endPos);
            const innerContent = xml.substring(innerStart, nextClose);
            result += this.handleTag(tagName, fullChunk, innerContent);
            i = endPos;
            break;
          }
          pos = nextClose + endTag.length;
        }
      }

      if (endPos === -1) {
        i = tagCloseIdx + 1;
      }
    }

    return result;
  },

  /**
   * Extrai o conteúdo do primeiro elemento filho com a tag especificada.
   * @param {string} xml
   * @param {string} tagName
   * @returns {string}
   */
  getChildInner(xml, tagName) {
    if (!xml) return '';
    const startIdx = this.findNextOpenTag(xml, tagName, 0);
    if (startIdx === -1) return '';

    const openTagEnd = xml.indexOf('>', startIdx);
    if (openTagEnd === -1) return '';
    if (xml.charAt(openTagEnd - 1) === '/') return ''; // auto-fechada

    const endTag = '</m:' + tagName + '>';
    let depth = 1;
    let pos = openTagEnd + 1;
    const innerStart = openTagEnd + 1;

    while (pos < xml.length) {
      const nextOpen = this.findNextOpenTag(xml, tagName, pos);
      const nextClose = xml.indexOf(endTag, pos);

      if (nextClose === -1) break;

      if (nextOpen !== -1 && nextOpen < nextClose) {
        const checkClose = xml.indexOf('>', nextOpen);
        if (checkClose !== -1 && xml.charAt(checkClose - 1) === '/') {
          pos = checkClose + 1;
          continue;
        }
        depth++;
        pos = checkClose + 1;
      } else {
        depth--;
        if (depth === 0) {
          return xml.substring(innerStart, nextClose);
        }
        pos = nextClose + endTag.length;
      }
    }

    return '';
  },

  /**
   * Trata uma tag OMML individual e a converte recursivamente para LaTeX.
   */
  handleTag(type, fullChunk, innerContent) {
    switch (type) {
      case 'oMath':
      case 'oMathPara':
      case 'box':
      case 'e':
        return this.parseNodes(innerContent);

      case 'r': {
        const tMatches = fullChunk.match(/<m:t(?:\s[^>]*)?>([\s\S]*?)<\/m:t>/gi);
        if (!tMatches) return '';
        let text = '';
        for (const tm of tMatches) {
          text += tm.replace(/<[^>]+>/g, '');
        }
        return this.cleanMathText(text);
      }

      case 'f': {
        const numXml = this.getChildInner(fullChunk, 'num');
        const denXml = this.getChildInner(fullChunk, 'den');
        const num = this.parseNodes(numXml).trim();
        const den = this.parseNodes(denXml).trim();
        return `\\frac{${num}}{${den}}`;
      }

      case 'sSup': {
        const baseXml = this.getChildInner(fullChunk, 'e');
        const supXml = this.getChildInner(fullChunk, 'sup');
        const base = this.parseNodes(baseXml).trim();
        const sup = this.parseNodes(supXml).trim();
        return `{${base}}^{${sup}}`;
      }

      case 'sSub': {
        const baseXml = this.getChildInner(fullChunk, 'e');
        const subXml = this.getChildInner(fullChunk, 'sub');
        const base = this.parseNodes(baseXml).trim();
        const sub = this.parseNodes(subXml).trim();
        return `{${base}}_{${sub}}`;
      }

      case 'sSubSup': {
        const baseXml = this.getChildInner(fullChunk, 'e');
        const subXml = this.getChildInner(fullChunk, 'sub');
        const supXml = this.getChildInner(fullChunk, 'sup');
        const base = this.parseNodes(baseXml).trim();
        const sub = this.parseNodes(subXml).trim();
        const sup = this.parseNodes(supXml).trim();
        return `{${base}}_{${sub}}^{${sup}}`;
      }

      case 'rad': {
        const degXml = this.getChildInner(fullChunk, 'deg');
        const baseXml = this.getChildInner(fullChunk, 'e');
        const deg = this.parseNodes(degXml).trim();
        const base = this.parseNodes(baseXml).trim();
        return deg ? `\\sqrt[${deg}]{${base}}` : `\\sqrt{${base}}`;
      }

      case 'nary': {
        let chr = '∫';
        const chrMatch = fullChunk.match(/<m:chr\s+m:val="([^"]*)"/i);
        if (chrMatch) chr = chrMatch[1];

        const isSubHide = /<m:subHide\s+m:val="(?:1|true)"/i.test(fullChunk);
        const isSupHide = /<m:supHide\s+m:val="(?:1|true)"/i.test(fullChunk);

        const subXml = isSubHide ? '' : this.getChildInner(fullChunk, 'sub');
        const supXml = isSupHide ? '' : this.getChildInner(fullChunk, 'sup');
        const baseXml = this.getChildInner(fullChunk, 'e');

        const sub = this.parseNodes(subXml).trim();
        const sup = this.parseNodes(supXml).trim();
        const base = this.parseNodes(baseXml).trim();

        let op = '\\int';
        if (chr === '∑') op = '\\sum';
        else if (chr === '∏') op = '\\prod';
        else if (chr === '∬') op = '\\iint';
        else if (chr === '∭') op = '\\iiint';
        else if (chr === '∮') op = '\\oint';

        let limits = '';
        if (sub && sup) limits = `_{${sub}}^{${sup}}`;
        else if (sub) limits = `_{${sub}}`;
        else if (sup) limits = `^{${sup}}`;

        return `${op}${limits} {${base}}`;
      }

      case 'd': {
        let beg = '(';
        let end = ')';
        const begMatch = fullChunk.match(/<m:begChr\s+m:val="([^"]*)"/i);
        if (begMatch) beg = begMatch[1];
        const endMatch = fullChunk.match(/<m:endChr\s+m:val="([^"]*)"/i);
        if (endMatch) end = endMatch[1];

        const innerXml = this.getChildInner(fullChunk, 'e');
        const inner = this.parseNodes(innerXml).trim();

        if (!beg && end === '|') {
          return `\\left. {${inner}} \\right|`;
        }
        if (beg === '|' && end === '|') {
          return `\\left| {${inner}} \\right|`;
        }
        if (beg === '[' && end === ']') {
          return `\\left[ {${inner}} \\right]`;
        }
        if (beg === '{' && end === '}') {
          return `\\left\\{ {${inner}} \\right\\}`;
        }
        if (!beg && !end) {
          return inner;
        }
        return `\\left${beg || '.'} {${inner}} \\right${end || '.'}`;
      }

      case 'func': {
        const fnameXml = this.getChildInner(fullChunk, 'fName');
        const baseXml = this.getChildInner(fullChunk, 'e');
        const fname = this.parseNodes(fnameXml).trim();
        const base = this.parseNodes(baseXml).trim();
        return `${fname} {${base}}`;
      }

      case 'limLow': {
        const fnameXml = this.getChildInner(fullChunk, 'e');
        const limXml = this.getChildInner(fullChunk, 'lim');
        const fname = this.parseNodes(fnameXml).trim();
        const lim = this.parseNodes(limXml).trim();
        return `${fname}_{${lim}}`;
      }

      case 'limUpp': {
        const fnameXml = this.getChildInner(fullChunk, 'e');
        const limXml = this.getChildInner(fullChunk, 'lim');
        const fname = this.parseNodes(fnameXml).trim();
        const lim = this.parseNodes(limXml).trim();
        return `${fname}^{${lim}}`;
      }

      case 'acc': {
        let chr = '^';
        const chrMatch = fullChunk.match(/<m:chr\s+m:val="([^"]*)"/i);
        if (chrMatch) chr = chrMatch[1];
        const baseXml = this.getChildInner(fullChunk, 'e');
        const base = this.parseNodes(baseXml).trim();
        if (chr === '⃗' || chr === '→') return `\\vec{${base}}`;
        if (chr === '̄' || chr === '¯') return `\\bar{${base}}`;
        if (chr === '̂') return `\\hat{${base}}`;
        if (chr === '̇') return `\\dot{${base}}`;
        return `{${base}}`;
      }

      case 'bar': {
        const baseXml = this.getChildInner(fullChunk, 'e');
        const base = this.parseNodes(baseXml).trim();
        return `\\overline{${base}}`;
      }

      default:
        return this.parseNodes(innerContent);
    }
  },

  /**
   * Converte caracteres matemáticos e símbolos especiais para macros LaTeX equivalentes.
   */
  cleanMathText(text) {
    if (!text) return '';
    return text
      .replace(/\u2061/g, '') // remove caractere invisível de aplicação de função
      .replace(/∙|·/g, ' \\cdot ')
      .replace(/∫/g, ' \\int ')
      .replace(/±/g, ' \\pm ')
      .replace(/∓/g, ' \\mp ')
      .replace(/×/g, ' \\times ')
      .replace(/÷/g, ' \\div ')
      .replace(/≈/g, ' \\approx ')
      .replace(/≠/g, ' \\neq ')
      .replace(/≤/g, ' \\leq ')
      .replace(/≥/g, ' \\geq ')
      .replace(/∞/g, ' \\infty ')
      .replace(/α/g, ' \\alpha ')
      .replace(/β/g, ' \\beta ')
      .replace(/γ/g, ' \\gamma ')
      .replace(/δ/g, ' \\delta ')
      .replace(/θ/g, ' \\theta ')
      .replace(/λ/g, ' \\lambda ')
      .replace(/μ/g, ' \\mu ')
      .replace(/π/g, ' \\pi ')
      .replace(/σ/g, ' \\sigma ')
      .replace(/φ/g, ' \\phi ')
      .replace(/ω/g, ' \\omega ')
      .replace(/Δ/g, ' \\Delta ');
  }
};
