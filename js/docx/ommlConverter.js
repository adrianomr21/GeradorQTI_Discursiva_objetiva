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
    const rawLatex = this.parseNodes(ommlXml).trim();
    return this.postProcessLatex(rawLatex);
  },

  /**
   * Pós-processa o código LaTeX para garantir a formatação semântica perfeita:
   * 1. Converte funções matemáticas sem barra (ln, sin, cos, etc.) em comandos LaTeX (\ln, \sin, etc.)
   * 2. Formata conectivos como 'logo' dentro de \text{logo} com espaçamento adequado
   * 3. Garante espaçamento tipográfico antes de diferenciais (dx, du, dt, etc.)
   */
  postProcessLatex(latex) {
    if (!latex) return '';

    // 1. Funções matemáticas padrão
    const funcRegex = /(?<![\\a-zA-Z])(ln|log|exp|sin|cos|tan|cot|sec|csc|arcsin|arccos|arctan|sen|tg|cotg|cossec|arcsen|arctg|lim|det|max|min)(?![a-zA-Z])/gi;
    latex = latex.replace(funcRegex, (match, fn) => {
      const lower = fn.toLowerCase();
      if (lower === 'sen') return '\\sin';
      if (lower === 'tg') return '\\tan';
      if (lower === 'cotg') return '\\cot';
      if (lower === 'cossec') return '\\csc';
      if (lower === 'arcsen') return '\\arcsin';
      if (lower === 'arctg') return '\\arctan';
      return '\\' + lower;
    });

    // 2. Conectivo "logo" em equações
    latex = latex.replace(/(?:\\quad\s*)?logo(?:\s*\\quad)?/gi, ' \\quad \\text{logo} \\quad ');

    // 3. Espaçamento antes de diferenciais dx, du, dt, dy, dz quando sucedem um termo ou parênteses
    latex = latex.replace(/([}\)])\s*(d[xutysvzA-Z])\b/g, '$1\\, $2');

    // 4. Limpa múltiplos espaços
    latex = latex.replace(/[ \t]{2,}/g, ' ').trim();

    return latex;
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
   * Extrai o conteúdo do elemento filho DIRETO com a tag especificada.
   * Varre estritamente no nível raiz de innerContent (profundidade 0),
   * impedindo que sub-elementos aninhados (como expoentes internos) sejam capturados indevidamente.
   * @param {string} innerContent - Conteúdo XML interno do elemento pai
   * @param {string} tagName - Nome da tag procurada (ex: 'e', 'sup', 'sub', 'num', 'den')
   * @returns {string} Conteúdo XML do filho direto
   */
  getChildInner(innerContent, tagName) {
    if (!innerContent) return '';
    let i = 0;

    while (i < innerContent.length) {
      const openIdx = innerContent.indexOf('<m:', i);
      if (openIdx === -1) break;

      const tagCloseIdx = innerContent.indexOf('>', openIdx);
      if (tagCloseIdx === -1) break;

      const tagHeader = innerContent.substring(openIdx + 3, tagCloseIdx);
      const isSelfClosing = innerContent.charAt(tagCloseIdx - 1) === '/';
      const currentTagName = tagHeader.replace(/[\s\/].*$/, '');

      if (isSelfClosing) {
        if (currentTagName === tagName) return '';
        i = tagCloseIdx + 1;
        continue;
      }

      const endTag = '</m:' + currentTagName + '>';
      let depth = 1;
      let pos = tagCloseIdx + 1;
      const childInnerStart = tagCloseIdx + 1;
      let childInnerEnd = -1;

      while (pos < innerContent.length) {
        const nextOpen = this.findNextOpenTag(innerContent, currentTagName, pos);
        const nextClose = innerContent.indexOf(endTag, pos);

        if (nextClose === -1) break;

        if (nextOpen !== -1 && nextOpen < nextClose) {
          const checkClose = innerContent.indexOf('>', nextOpen);
          if (checkClose !== -1 && innerContent.charAt(checkClose - 1) === '/') {
            pos = checkClose + 1;
            continue;
          }
          depth++;
          pos = checkClose + 1;
        } else {
          depth--;
          if (depth === 0) {
            childInnerEnd = nextClose;
            i = nextClose + endTag.length;
            break;
          }
          pos = nextClose + endTag.length;
        }
      }

      if (currentTagName === tagName && childInnerEnd !== -1) {
        return innerContent.substring(childInnerStart, childInnerEnd);
      }

      if (childInnerEnd === -1) {
        i = tagCloseIdx + 1;
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
        const numXml = this.getChildInner(innerContent, 'num');
        const denXml = this.getChildInner(innerContent, 'den');
        const num = this.parseNodes(numXml).trim();
        const den = this.parseNodes(denXml).trim();
        return `\\frac{${num}}{${den}}`;
      }

      case 'sSup': {
        const baseXml = this.getChildInner(innerContent, 'e');
        const supXml = this.getChildInner(innerContent, 'sup');
        const base = this.parseNodes(baseXml).trim();
        const sup = this.parseNodes(supXml).trim();
        return `{${base}}^{${sup}}`;
      }

      case 'sSub': {
        const baseXml = this.getChildInner(innerContent, 'e');
        const subXml = this.getChildInner(innerContent, 'sub');
        const base = this.parseNodes(baseXml).trim();
        const sub = this.parseNodes(subXml).trim();
        return `{${base}}_{${sub}}`;
      }

      case 'sSubSup': {
        const baseXml = this.getChildInner(innerContent, 'e');
        const subXml = this.getChildInner(innerContent, 'sub');
        const supXml = this.getChildInner(innerContent, 'sup');
        const base = this.parseNodes(baseXml).trim();
        const sub = this.parseNodes(subXml).trim();
        const sup = this.parseNodes(supXml).trim();
        return `{${base}}_{${sub}}^{${sup}}`;
      }

      case 'rad': {
        const degXml = this.getChildInner(innerContent, 'deg');
        const baseXml = this.getChildInner(innerContent, 'e');
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

        const subXml = isSubHide ? '' : this.getChildInner(innerContent, 'sub');
        const supXml = isSupHide ? '' : this.getChildInner(innerContent, 'sup');
        const baseXml = this.getChildInner(innerContent, 'e');

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

        const innerXml = this.getChildInner(innerContent, 'e');
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
        const fnameXml = this.getChildInner(innerContent, 'fName');
        const baseXml = this.getChildInner(innerContent, 'e');
        let fname = this.parseNodes(fnameXml).trim();
        const base = this.parseNodes(baseXml).trim();
        if (fname && !fname.startsWith('\\') && /^[a-zA-Z]+$/.test(fname)) {
          fname = '\\' + fname;
        }
        return `${fname} {${base}}`;
      }

      case 'limLow': {
        const fnameXml = this.getChildInner(innerContent, 'e');
        const limXml = this.getChildInner(innerContent, 'lim');
        const fname = this.parseNodes(fnameXml).trim();
        const lim = this.parseNodes(limXml).trim();
        return `${fname}_{${lim}}`;
      }

      case 'limUpp': {
        const fnameXml = this.getChildInner(innerContent, 'e');
        const limXml = this.getChildInner(innerContent, 'lim');
        const fname = this.parseNodes(fnameXml).trim();
        const lim = this.parseNodes(limXml).trim();
        return `${fname}^{${lim}}`;
      }

      case 'acc': {
        let chr = '^';
        const chrMatch = fullChunk.match(/<m:chr\s+m:val="([^"]*)"/i);
        if (chrMatch) chr = chrMatch[1];
        const baseXml = this.getChildInner(innerContent, 'e');
        const base = this.parseNodes(baseXml).trim();
        if (chr === '⃗' || chr === '→') return `\\vec{${base}}`;
        if (chr === '̄' || chr === '¯') return `\\bar{${base}}`;
        if (chr === '̂') return `\\hat{${base}}`;
        if (chr === '̇') return `\\dot{${base}}`;
        return `{${base}}`;
      }

      case 'groupChr': {
        let chr = '→';
        const chrMatch = fullChunk.match(/<m:chr\s+m:val="([^"]*)"/i);
        if (chrMatch) chr = chrMatch[1];

        const innerXml = this.getChildInner(innerContent, 'e');
        const inner = this.parseNodes(innerXml).trim();

        if (!inner) {
          if (chr === '→' || chr === '⟶') return ' \\longrightarrow ';
          if (chr === '←' || chr === '⟵') return ' \\longleftarrow ';
          if (chr === '↔' || chr === '⟷') return ' \\longleftrightarrow ';
          if (chr === '⇒' || chr === '⟹') return ' \\Longrightarrow ';
          if (chr === '⇐' || chr === '⟸') return ' \\Longleftarrow ';
          if (chr === '⇔' || chr === '⟺') return ' \\Longleftrightarrow ';
          return ` ${chr} `;
        }

        if (chr === '→' || chr === '⟶') return `\\overrightarrow{${inner}}`;
        if (chr === '←' || chr === '⟵') return `\\overleftarrow{${inner}}`;
        if (chr === '⏞' || chr === '⏜' || chr === '{') return `\\overbrace{${inner}}`;
        if (chr === '⏟' || chr === '⏝' || chr === '}') return `\\underbrace{${inner}}`;
        return `\\overset{${chr}}{${inner}}`;
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
      .replace(/⟶/g, ' \\longrightarrow ')
      .replace(/→/g, ' \\rightarrow ')
      .replace(/⟵/g, ' \\longleftarrow ')
      .replace(/←/g, ' \\leftarrow ')
      .replace(/⟹/g, ' \\Longrightarrow ')
      .replace(/⇒/g, ' \\Rightarrow ')
      .replace(/⟺/g, ' \\Longleftrightarrow ')
      .replace(/↔/g, ' \\leftrightarrow ')
      .replace(/↦/g, ' \\mapsto ')
      .replace(/⟼/g, ' \\longmapsto ')
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
  },

  /**
   * Tabela de símbolos e caracteres gregos para conversão de LaTeX para OMML
   */
  GREEK_AND_SYMBOLS: {
    '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ', '\\Delta': 'Δ',
    '\\epsilon': 'ε', '\\varepsilon': 'ε', '\\zeta': 'ζ', '\\eta': 'η', '\\theta': 'θ',
    '\\Theta': 'Θ', '\\iota': 'ι', '\\kappa': 'κ', '\\lambda': 'λ', '\\Lambda': 'Λ',
    '\\mu': 'μ', '\\nu': 'ν', '\\xi': 'ξ', '\\pi': 'π', '\\Pi': 'Π',
    '\\rho': 'ρ', '\\sigma': 'σ', '\\Sigma': 'Σ', '\\tau': 'τ', '\\upsilon': 'υ',
    '\\phi': 'φ', '\\Phi': 'Φ', '\\chi': 'χ', '\\psi': 'ψ', '\\Psi': 'Ψ',
    '\\omega': 'ω', '\\Omega': 'Ω', '\\cdot': '·', '\\times': '×', '\\pm': '±',
    '\\mp': '∓', '\\div': '÷', '\\neq': '≠', '\\ne': '≠', '\\leq': '≤',
    '\\le': '≤', '\\geq': '≥', '\\ge': '≥', '\\approx': '≈', '\\sim': '~',
    '\\infty': '∞',
    '\\longrightarrow': '⟶', '\\longleftarrow': '⟵',
    '\\rightarrow': '→', '\\to': '→', '\\leftarrow': '←',
    '\\Longrightarrow': '⟹', '\\Rightarrow': '⇒', '\\implies': '⟹',
    '\\Longleftarrow': '⟸', '\\Leftarrow': '⇐',
    '\\longleftrightarrow': '⟷', '\\Longleftrightarrow': '⟺',
    '\\leftrightarrow': '↔', '\\iff': '⟺',
    '\\mapsto': '↦', '\\longmapsto': '⟼',
    '\\uparrow': '↑', '\\downarrow': '↓', '\\updownarrow': '↕',
    '\\Uparrow': '⇑', '\\Downarrow': '⇓',
    '\\forall': '∀', '\\exists': '∃', '\\in': '∈', '\\notin': '∉',
    '\\subset': '⊂', '\\subseteq': '⊆', '\\cup': '∪', '\\cap': '∩',
    '\\emptyset': '∅', '\\partial': '∂', '\\nabla': '∇', '\\quad': ' ',
    '\\qquad': '  ', '\\,': ' ', '\\:': ' ', '\\;': ' ', '\\!': '',
    '\\{': '{', '\\}': '}'
  },

  /**
   * Escapa caracteres XML
   * @param {string} text
   * @returns {string}
   */
  escapeXml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  },

  /**
   * Extrai um grupo balanceado entre delimitadores (ex: '{' e '}', '[' e ']')
   */
  extractGroup(str, startIdx, openChar = '{', closeChar = '}') {
    if (str[startIdx] !== openChar) {
      if (str[startIdx] === '\\') {
        const m = str.substring(startIdx).match(/^\\[a-zA-Z]+/);
        if (m) {
          return { content: m[0], endIdx: startIdx + m[0].length };
        }
      }
      return { content: str[startIdx] || '', endIdx: startIdx + 1 };
    }

    let depth = 1;
    let i = startIdx + 1;
    let content = '';

    while (i < str.length && depth > 0) {
      if (str[i] === openChar) depth++;
      else if (str[i] === closeChar) {
        depth--;
        if (depth === 0) break;
      }
      content += str[i];
      i++;
    }

    return { content, endIdx: i + 1 };
  },

  /**
   * Converte uma expressão LaTeX completa em OMML (<m:oMath> ou <m:oMathPara>)
   * @param {string} latex - Código LaTeX da fórmula
   * @param {boolean} isDisplay - Se verdadeiro, renderiza em bloco com <m:oMathPara>
   * @returns {string} XML OMML correspondente
   */
  latexToOmml(latex, isDisplay = false) {
    if (!latex) return '';
    let clean = String(latex).trim();

    clean = clean.replace(/^\$\$([\s\S]*)\$\$$/, '$1')
                 .replace(/^\$([\s\S]*)\$$/, '$1')
                 .replace(/^\\\[([\s\S]*)\\\]$/, '$1')
                 .replace(/^\\\(([\s\S]*)\\\)$/, '$1')
                 .replace(/-{2,}>/g, ' \\longrightarrow ')
                 .replace(/<-{2,}/g, ' \\longleftarrow ')
                 .replace(/={2,}>/g, ' \\Longrightarrow ')
                 .replace(/<={2,}/g, ' \\Longleftarrow ')
                 .trim();

    const innerOmml = this.parseLatexExpression(clean);
    const oMath = `<m:oMath>${innerOmml}</m:oMath>`;
    return isDisplay ? `<m:oMathPara>${oMath}</m:oMathPara>` : oMath;
  },

  /**
   * Parser recursivo de LaTeX para elementos OMML
   * @param {string} latex
   * @returns {string}
   */
  parseLatexExpression(latex) {
    if (!latex) return '';
    let xml = '';
    let i = 0;

    const flushText = (txt) => {
      if (txt) {
        xml += `<m:r><m:t xml:space="preserve">${this.escapeXml(txt)}</m:t></m:r>`;
      }
    };

    let textBuffer = '';

    while (i < latex.length) {
      // 1. Frações: \frac{num}{den}, \dfrac, \tfrac
      if (latex.startsWith('\\frac', i) || latex.startsWith('\\dfrac', i) || latex.startsWith('\\tfrac', i)) {
        flushText(textBuffer); textBuffer = '';
        const match = latex.substring(i).match(/^\\(?:frac|dfrac|tfrac)/);
        let pos = i + match[0].length;
        while (pos < latex.length && /\s/.test(latex[pos])) pos++;

        const numGroup = this.extractGroup(latex, pos, '{', '}');
        pos = numGroup.endIdx;
        while (pos < latex.length && /\s/.test(latex[pos])) pos++;

        const denGroup = this.extractGroup(latex, pos, '{', '}');
        i = denGroup.endIdx;

        const numXml = this.parseLatexExpression(numGroup.content);
        const denXml = this.parseLatexExpression(denGroup.content);

        xml += `<m:f><m:fPr><m:type m:val="bar"/></m:fPr><m:num>${numXml}</m:num><m:den>${denXml}</m:den></m:f>`;
        continue;
      }

      // 2. Raiz / Radical: \sqrt{...} ou \sqrt[n]{...}
      if (latex.startsWith('\\sqrt', i)) {
        flushText(textBuffer); textBuffer = '';
        let pos = i + 5;
        while (pos < latex.length && /\s/.test(latex[pos])) pos++;

        let degXml = '';
        if (latex[pos] === '[') {
          const degGroup = this.extractGroup(latex, pos, '[', ']');
          degXml = this.parseLatexExpression(degGroup.content);
          pos = degGroup.endIdx;
          while (pos < latex.length && /\s/.test(latex[pos])) pos++;
        }

        const baseGroup = this.extractGroup(latex, pos, '{', '}');
        i = baseGroup.endIdx;
        const baseXml = this.parseLatexExpression(baseGroup.content);

        if (degXml) {
          xml += `<m:rad><m:deg>${degXml}</m:deg><m:e>${baseXml}</m:e></m:rad>`;
        } else {
          xml += `<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e>${baseXml}</m:e></m:rad>`;
        }
        continue;
      }

      // 3. Integrais, Somatórios e Produtórios: \int, \sum, \prod, \iint, \iiint, \oint
      const naryMatch = latex.substring(i).match(/^\\(int|iint|iiint|oint|sum|prod)\b/);
      if (naryMatch) {
        flushText(textBuffer); textBuffer = '';
        const opName = naryMatch[1];
        let pos = i + naryMatch[0].length;

        let chr = '∫';
        if (opName === 'sum') { chr = '∑'; }
        else if (opName === 'prod') { chr = '∏'; }
        else if (opName === 'iint') { chr = '∬'; }
        else if (opName === 'iiint') { chr = '∭'; }
        else if (opName === 'oint') { chr = '∮'; }

        let subXml = '';
        let supXml = '';

        for (let k = 0; k < 2; k++) {
          while (pos < latex.length && /\s/.test(latex[pos])) pos++;
          if (latex[pos] === '_') {
            pos++;
            while (pos < latex.length && /\s/.test(latex[pos])) pos++;
            const subGroup = this.extractGroup(latex, pos, '{', '}');
            subXml = this.parseLatexExpression(subGroup.content);
            pos = subGroup.endIdx;
          } else if (latex[pos] === '^') {
            pos++;
            while (pos < latex.length && /\s/.test(latex[pos])) pos++;
            const supGroup = this.extractGroup(latex, pos, '{', '}');
            supXml = this.parseLatexExpression(supGroup.content);
            pos = supGroup.endIdx;
          }
        }

        i = pos;
        const opRun = `<m:r><m:t>${chr}</m:t></m:r>`;
        if (subXml && supXml) {
          xml += `<m:sSubSup><m:e>${opRun}</m:e><m:sub>${subXml}</m:sub><m:sup>${supXml}</m:sup></m:sSubSup>`;
        } else if (subXml) {
          xml += `<m:sSub><m:e>${opRun}</m:e><m:sub>${subXml}</m:sub></m:sSub>`;
        } else if (supXml) {
          xml += `<m:sSup><m:e>${opRun}</m:e><m:sup>${supXml}</m:sup></m:sSup>`;
        } else {
          xml += opRun;
        }
        continue;
      }

      // 4. Delimitadores: \left( ... \right), \left[ ... \right], \left\{ ... \right\}, \left. ... \right|
      if (latex.startsWith('\\left', i)) {
        flushText(textBuffer); textBuffer = '';
        let pos = i + 5;
        let beg = '';
        if (latex.startsWith('\\{', pos)) { beg = '{'; pos += 2; }
        else if (latex.startsWith('\\|', pos)) { beg = '‖'; pos += 2; }
        else { beg = latex[pos] === '.' ? '' : latex[pos]; pos += 1; }

        let depth = 1;
        let innerContent = '';
        let end = '';

        while (pos < latex.length && depth > 0) {
          if (latex.startsWith('\\left', pos)) {
            depth++;
            innerContent += latex.substring(pos, pos + 5);
            pos += 5;
          } else if (latex.startsWith('\\right', pos)) {
            depth--;
            if (depth === 0) {
              pos += 6;
              if (latex.startsWith('\\}', pos)) { end = '}'; pos += 2; }
              else if (latex.startsWith('\\|', pos)) { end = '‖'; pos += 2; }
              else { end = latex[pos] === '.' ? '' : latex[pos]; pos += 1; }
              break;
            } else {
              innerContent += latex.substring(pos, pos + 6);
              pos += 6;
            }
          } else {
            innerContent += latex[pos];
            pos++;
          }
        }

        i = pos;
        const innerXml = this.parseLatexExpression(innerContent);
        xml += `<m:d><m:dPr><m:begChr m:val="${this.escapeXml(beg)}"/><m:endChr m:val="${this.escapeXml(end)}"/></m:dPr><m:e>${innerXml}</m:e></m:d>`;
        continue;
      }

      // 4.1 Texto e Operadores em modo texto: \text{...}, \mathrm{...}, \operatorname{...}
      const textMatch = latex.substring(i).match(/^\\(?:text|mathrm|operatorname)\b/);
      if (textMatch) {
        flushText(textBuffer); textBuffer = '';
        let pos = i + textMatch[0].length;
        while (pos < latex.length && /\s/.test(latex[pos])) pos++;
        const textGroup = this.extractGroup(latex, pos, '{', '}');
        i = textGroup.endIdx;
        xml += `<m:r><m:rPr><m:sty m:val="p"/></m:rPr><m:t xml:space="preserve">${this.escapeXml(textGroup.content)}</m:t></m:r>`;
        continue;
      }

      // 5. Funções trigonométricas, logarítmicas e algébricas
      const funcMatch = latex.substring(i).match(/^\\(sin|cos|tan|sec|csc|cot|sinh|cosh|tanh|arcsin|arccos|arctan|ln|log|exp|det|dim|max|min|deg)\b/);
      if (funcMatch) {
        flushText(textBuffer); textBuffer = '';
        const fname = funcMatch[1];
        i += funcMatch[0].length;
        xml += `<m:r><m:rPr><m:scr m:val="roman"/></m:rPr><m:t>${fname}</m:t></m:r>`;
        continue;
      }

      // 6. Limites: \lim_{x \to 0}
      if (latex.startsWith('\\lim', i)) {
        flushText(textBuffer); textBuffer = '';
        let pos = i + 4;
        while (pos < latex.length && /\s/.test(latex[pos])) pos++;
        let limXml = '';
        if (latex[pos] === '_') {
          pos++;
          while (pos < latex.length && /\s/.test(latex[pos])) pos++;
          const limGroup = this.extractGroup(latex, pos, '{', '}');
          limXml = this.parseLatexExpression(limGroup.content);
          pos = limGroup.endIdx;
        }
        i = pos;
        if (limXml) {
          xml += `<m:limLow><m:e><m:r><m:rPr><m:scr m:val="roman"/></m:rPr><m:t>lim</m:t></m:r></m:e><m:lim>${limXml}</m:lim></m:limLow>`;
        } else {
          xml += `<m:r><m:rPr><m:scr m:val="roman"/></m:rPr><m:t>lim</m:t></m:r>`;
        }
        continue;
      }

      // 7. Vetores e Acentos: \vec, \bar, \hat, \dot, \ddot, \overline, \tilde
      const accMatch = latex.substring(i).match(/^\\(vec|bar|hat|dot|ddot|overline|tilde)\b/);
      if (accMatch) {
        flushText(textBuffer); textBuffer = '';
        const accType = accMatch[1];
        let pos = i + accMatch[0].length;
        while (pos < latex.length && /\s/.test(latex[pos])) pos++;
        const accGroup = this.extractGroup(latex, pos, '{', '}');
        i = accGroup.endIdx;
        const innerXml = this.parseLatexExpression(accGroup.content);

        let chr = '⃗';
        if (accType === 'bar' || accType === 'overline') chr = '̄';
        else if (accType === 'hat') chr = '̂';
        else if (accType === 'dot') chr = '̇';
        else if (accType === 'ddot') chr = '̈';
        else if (accType === 'tilde') chr = '̃';

        if (accType === 'overline') {
          xml += `<m:bar><m:barPr><m:pos m:val="top"/></m:barPr><m:e>${innerXml}</m:e></m:bar>`;
        } else {
          xml += `<m:acc><m:accPr><m:chr m:val="${chr}"/></m:accPr><m:e>${innerXml}</m:e></m:acc>`;
        }
        continue;
      }

      // 8. Chaves agrupadoras {...} com expoente ou índice
      if (latex[i] === '{') {
        flushText(textBuffer); textBuffer = '';
        const grp = this.extractGroup(latex, i, '{', '}');
        let pos = grp.endIdx;
        let baseXml = this.parseLatexExpression(grp.content);

        let subXml = '';
        let supXml = '';
        for (let k = 0; k < 2; k++) {
          while (pos < latex.length && /\s/.test(latex[pos])) pos++;
          if (pos < latex.length && latex[pos] === '^') {
            pos++;
            while (pos < latex.length && /\s/.test(latex[pos])) pos++;
            const supGrp = this.extractGroup(latex, pos, '{', '}');
            supXml = this.parseLatexExpression(supGrp.content);
            pos = supGrp.endIdx;
          } else if (pos < latex.length && latex[pos] === '_') {
            pos++;
            while (pos < latex.length && /\s/.test(latex[pos])) pos++;
            const subGrp = this.extractGroup(latex, pos, '{', '}');
            subXml = this.parseLatexExpression(subGrp.content);
            pos = subGrp.endIdx;
          }
        }

        i = pos;
        if (subXml && supXml) {
          xml += `<m:sSubSup><m:e>${baseXml}</m:e><m:sub>${subXml}</m:sub><m:sup>${supXml}</m:sup></m:sSubSup>`;
        } else if (supXml) {
          xml += `<m:sSup><m:e>${baseXml}</m:e><m:sup>${supXml}</m:sup></m:sSup>`;
        } else if (subXml) {
          xml += `<m:sSub><m:e>${baseXml}</m:e><m:sub>${subXml}</m:sub></m:sSub>`;
        } else {
          xml += baseXml;
        }
        continue;
      }

      // 9. Expoente ^ ou Índice _ isolado após caractere
      if (latex[i] === '^' || latex[i] === '_') {
        let baseChar = textBuffer.length > 0 ? textBuffer.slice(-1) : '';
        if (baseChar) {
          textBuffer = textBuffer.slice(0, -1);
          flushText(textBuffer); textBuffer = '';
        }
        const baseXml = baseChar ? `<m:r><m:t>${this.escapeXml(baseChar)}</m:t></m:r>` : '<m:r><m:t></m:t></m:r>';

        let pos = i;
        let subXml = '';
        let supXml = '';

        for (let k = 0; k < 2; k++) {
          while (pos < latex.length && /\s/.test(latex[pos])) pos++;
          if (pos < latex.length && latex[pos] === '^') {
            pos++;
            while (pos < latex.length && /\s/.test(latex[pos])) pos++;
            const supGrp = this.extractGroup(latex, pos, '{', '}');
            supXml = this.parseLatexExpression(supGrp.content);
            pos = supGrp.endIdx;
          } else if (pos < latex.length && latex[pos] === '_') {
            pos++;
            while (pos < latex.length && /\s/.test(latex[pos])) pos++;
            const subGrp = this.extractGroup(latex, pos, '{', '}');
            subXml = this.parseLatexExpression(subGrp.content);
            pos = subGrp.endIdx;
          }
        }

        i = pos;
        if (subXml && supXml) {
          xml += `<m:sSubSup><m:e>${baseXml}</m:e><m:sub>${subXml}</m:sub><m:sup>${supXml}</m:sup></m:sSubSup>`;
        } else if (supXml) {
          xml += `<m:sSup><m:e>${baseXml}</m:e><m:sup>${supXml}</m:sup></m:sSup>`;
        } else if (subXml) {
          xml += `<m:sSub><m:e>${baseXml}</m:e><m:sub>${subXml}</m:sub></m:sSub>`;
        }
        continue;
      }

      // 10. Símbolos Gregos e Especiais
      let foundSymbol = false;
      for (const [texSym, unicodeChar] of Object.entries(this.GREEK_AND_SYMBOLS)) {
        if (latex.startsWith(texSym, i)) {
          const nextChar = latex[i + texSym.length];
          if (!/[a-zA-Z]/.test(nextChar || '')) {
            textBuffer += unicodeChar;
            i += texSym.length;
            foundSymbol = true;
            break;
          }
        }
      }
      if (foundSymbol) continue;

      // 11. Caractere normal
      textBuffer += latex[i];
      i++;
    }

    flushText(textBuffer);
    return xml;
  }
};
