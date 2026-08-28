/**
 * xmlHelpers.js
 * Funções utilitárias para formatação, escape e tratamento de XML compatível com QTI 2.1.
 */

export const XmlHelpers = {
  /**
   * Faz o escape seguro de caracteres especiais do XML.
   * @param {string} str - Texto de entrada
   * @returns {string} Texto com entidades XML
   */
  escapeXml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  },

  /**
   * Converte fórmulas matemáticas KaTeX em elementos MathML puros (<math>...</math>),
   * removendo a camada visual paralela (.katex-html) para evitar duplicação de fórmulas em LMSs (Blackboard/Canvas).
   * @param {string} html - HTML contendo fórmulas
   * @returns {string} HTML com MathML estrito
   */
  cleanMathForQti(html) {
    if (!html) return '';
    if (!html.includes('<math') && !html.includes('qti-math') && !html.includes('katex')) {
      return html;
    }

    let result = '';
    let i = 0;
    while (i < html.length) {
      const mathIdx = html.indexOf('<span class="qti-math', i);
      const mathIdx2 = html.indexOf("<span class='qti-math", i);
      const katexIdx = html.indexOf('<span class="katex"', i);
      
      let startIdx = -1;
      const candidates = [mathIdx, mathIdx2, katexIdx].filter(idx => idx !== -1);
      if (candidates.length > 0) {
        startIdx = Math.min(...candidates);
      }

      if (startIdx === -1) {
        result += html.substring(i);
        break;
      }

      result += html.substring(i, startIdx);

      // Encontra o fechamento balanceado do span
      let depth = 0;
      let pos = startIdx;
      let endPos = -1;
      while (pos < html.length) {
        const openSpan = html.indexOf('<span', pos);
        const closeSpan = html.indexOf('</span>', pos);
        if (closeSpan === -1) break;
        if (openSpan !== -1 && openSpan < closeSpan) {
          depth++;
          pos = openSpan + 5;
        } else {
          depth--;
          pos = closeSpan + 7;
          if (depth === 0) {
            endPos = pos;
            break;
          }
        }
      }

      if (endPos !== -1) {
        const fullSpan = html.substring(startIdx, endPos);
        const mathMatch = fullSpan.match(/<math[\s\S]*?<\/math>/i);
        if (mathMatch) {
          result += mathMatch[0];
        } else {
          result += fullSpan;
        }
        i = endPos;
      } else {
        result += html.substring(startIdx, startIdx + 5);
        i = startIdx + 5;
      }
    }

    return result;
  },

  /**
   * Converte texto simples (com quebras de linha) em blocos de parágrafos <p>...</p>
   * ou preserva tags se já for HTML formatado.
   * @param {string} text - Texto ou HTML
   * @returns {string} Conteúdo encapsulado em parágrafos
   */
  formatContent(text) {
    if (!text) return '<p></p>';
    
    // Limpa representações visuais duplicadas de KaTeX deixando MathML puro para o QTI
    const cleanText = this.cleanMathForQti(text);

    // Se o texto já contiver tags de bloco HTML (<p>, <div>, <table>, <ul>, <ol>, <blockquote>), apenas retorna
    if (/<(?:p|div|table|ul|ol|blockquote|h[1-6])[\s>]/i.test(cleanText)) {
      return cleanText;
    }

    // Caso contrário, divide por quebras de linha e cria tags <p>
    const paragraphs = cleanText
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => `<p>${this.escapeXml(line)}</p>`);

    return paragraphs.length > 0 ? paragraphs.join('\n') : '<p></p>';
  },

  /**
   * Formata número sequencial para o padrão assessmentItem00001
   * @param {number} num - Número da questão
   * @returns {string} String formatada (ex: assessmentItem00001)
   */
  formatItemIdentifier(num) {
    const padded = String(num).padStart(5, '0');
    return `assessmentItem${padded}`;
  },

  /**
   * Formata número sequencial para o identificador da questão no padrão QUE__00001
   * @param {number} num - Número da questão
   * @returns {string} String formatada (ex: QUE__00001)
   */
  formatQuestionIdentifier(num) {
    const padded = String(num).padStart(5, '0');
    return `QUE__${padded}`;
  }
};
