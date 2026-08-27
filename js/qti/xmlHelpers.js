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
   * Converte texto simples (com quebras de linha) em blocos de parágrafos <p>...</p>
   * ou preserva tags se já for HTML formatado.
   * @param {string} text - Texto ou HTML
   * @returns {string} Conteúdo encapsulado em parágrafos
   */
  formatContent(text) {
    if (!text) return '<p></p>';
    
    // Se o texto já contiver tags <p>, apenas retorna
    if (text.includes('<p>') || text.includes('<div>')) {
      return text;
    }

    // Caso contrário, divide por quebras de linha e cria tags <p>
    const paragraphs = text
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
