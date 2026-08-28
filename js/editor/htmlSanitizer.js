/**
 * htmlSanitizer.js
 * Módulo responsável por higienizar HTML (especialmente textos colados do Word/Docs)
 * e garantir que a saída seja XHTML estritamente válido para o padrão IMS QTI 2.1.
 */

export const HtmlSanitizer = {
  /**
   * Limpa formatações indesejadas e estilos proprietários (ex: Word, Google Docs).
   * @param {string} html - HTML bruto
   * @returns {string} HTML semântico limpo
   */
  cleanHtml(html) {
    if (!html) return '';

    let clean = html;

    // 1. Remove comentários condicionais do Office/Word (<![if !supportLists]>...<![endif]>)
    clean = clean.replace(/<!--[\s\S]*?-->/g, '');
    clean = clean.replace(/<!\[[\s\S]*?\]>/g, '');

    // 2. Remove tags perigosas e seu conteúdo interno (script, style, xml, iframe, applet)
    clean = clean.replace(/<(?:script|style|xml|iframe|applet)[\s\S]*?<\/(?:script|style|xml|iframe|applet)>/gi, '');
    clean = clean.replace(/<\/?(?:meta|link|o:p|font|basefont)[^>]*>/gi, '');

    // 3. Remove atributos perigosos ou poluídos (class="Mso...", lang, id, etc.)
    clean = clean.replace(/\s+class="[^"]*"/gi, '');
    clean = clean.replace(/\s+lang="[^"]*"/gi, '');
    clean = clean.replace(/\s+align="[^"]*"/gi, '');
    
    // Limpa propriedades proprietárias do Word dentro de style="..." preservando width, height, display, etc.
    clean = clean.replace(/style="([^"]*)"/gi, (match, styles) => {
      let cleanedStyle = styles
        .replace(/mso-[^;]+;?/gi, '')
        .replace(/font-family:[^;]+;?/gi, '')
        .replace(/line-height:[^;]+;?/gi, '')
        .replace(/margin-(?:top|bottom|left|right):\s*[\d\.]+(?:pt|cm);?/gi, '')
        .replace(/font-size:[^;]+;?/gi, '')
        .trim();

      // Remove ponto e vírgula soltos
      cleanedStyle = cleanedStyle.replace(/^;+|;+$/g, '').trim();

      return cleanedStyle ? `style="${cleanedStyle}"` : '';
    });

    // 4. Converte <b> e <i> para <strong> e <em> (padrão semântico)
    clean = clean.replace(/<b(\s+[^>]*)?>/gi, '<strong>').replace(/<\/b>/gi, '</strong>');
    clean = clean.replace(/<i(\s+[^>]*)?>/gi, '<em>').replace(/<\/i>/gi, '</em>');

    // 5. Remove spans vazios ou redundantes e tags </img> órfãs
    clean = clean.replace(/<\/img>/gi, '');
    clean = clean.replace(/(?:src|data)=["'](?:\.\.\/|\.\/|\/)*(data:image\/[^"']+)["']/gi, 'src="$1"');
    clean = clean.replace(/<span\s*>([\s\S]*?)<\/span>/gi, '$1');
    clean = clean.replace(/<span>([\s\S]*?)<\/span>/gi, '$1');
    clean = clean.replace(/<p\s*>([\s\S]*?)<\/p>/gi, '<p>$1</p>');

    return clean.trim();
  },

  /**
   * Converte HTML em XHTML 100% válido para XML do QTI 2.1 (fechando tags vazias).
   * @param {string} html - HTML de entrada
   * @returns {string} XHTML válido
   */
  toValidXhtml(html) {
    if (!html) return '<p></p>';

    let xhtml = this.cleanHtml(html);

    // Garante fechamento de tags auto-contidas (void elements)
    // <br> -> <br />
    xhtml = xhtml.replace(/<br\s*\/?>/gi, '<br />');

    // <hr> -> <hr />
    xhtml = xhtml.replace(/<hr\s*\/?>/gi, '<hr />');

    // <img ...> -> <img ... /> (caso não esteja fechada)
    xhtml = xhtml.replace(/<img\s+([^>]*[^\/])>/gi, '<img $1 />');

    // Converte & soltos em &amp; (que não sejam entidades existentes como &amp;, &lt;, &gt;, &quot;, &apos;)
    xhtml = xhtml.replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;');

    return xhtml;
  }
};
