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

    // 0. Converte entidades &nbsp; e &amp;nbsp; e caracteres de espaço não-quebrável em espaço normal
    clean = clean.replace(/&amp;nbsp;/gi, ' ');
    clean = clean.replace(/&nbsp;/gi, ' ');
    clean = clean.replace(/\u00a0/g, ' ');

    // 1. Remove comentários condicionais do Office/Word (<![if !supportLists]>...<![endif]>)
    clean = clean.replace(/<!--[\s\S]*?-->/g, '');
    clean = clean.replace(/<!\[[\s\S]*?\]>/g, '');

    // 2. Remove tags perigosas e seu conteúdo interno (script, style, xml, applet) - preservando iframe, video, audio, embed, object
    clean = clean.replace(/<(?:script|style|xml|applet)[\s\S]*?<\/(?:script|style|xml|applet)>/gi, '');
    clean = clean.replace(/<\/?(?:meta|link|o:p|font|basefont)[^>]*>/gi, '');

    // 3. Remove atributos poluídos do Word (class="Mso...", lang, etc.) mas preserva todas as classes do KaTeX, tabelas e editor
    clean = clean.replace(/\s+class="([^"]*)"/gi, (match, cls) => {
      const kept = cls.split(/\s+/).filter(c => !/^Mso/i.test(c)).join(' ');
      return kept ? ` class="${kept}"` : '';
    });
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

    // <source ...> -> <source ... />
    xhtml = xhtml.replace(/<source\s+([^>]*[^\/])>/gi, '<source $1 />');

    // <track ...> -> <track ... />
    xhtml = xhtml.replace(/<track\s+([^>]*[^\/])>/gi, '<track $1 />');

    // <embed ...> -> <embed ... />
    xhtml = xhtml.replace(/<embed\s+([^>]*[^\/])>/gi, '<embed $1 />');

    // Garante fechamento explícito de <iframe> caso venha auto-fechado <iframe .../>
    xhtml = xhtml.replace(/<iframe\s+([^>]*)\/>/gi, '<iframe $1></iframe>');

    // Converte atributos booleanos HTML (allowfullscreen, controls, etc.) para formato válido XHTML (allowfullscreen="allowfullscreen")
    xhtml = xhtml.replace(/<(iframe|video|audio|source|object|embed)\s+([^>]*?)>/gi, (match, tag, attrs) => {
      const cleanedAttrs = attrs.replace(/\b(allowfullscreen|controls|autoplay|loop|muted|playsinline|webkitallowfullscreen|mozallowfullscreen)\b(?!\s*=)/gi, '$1="$1"');
      return `<${tag} ${cleanedAttrs}>`;
    });

    // Converte & soltos em &amp; (que não sejam entidades existentes como &amp;, &lt;, &gt;, &quot;, &apos;, &#123;, &#xAB;)
    xhtml = xhtml.replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;');

    // Garante que todas as tags abertas sejam fechadas e aninhadas corretamente
    return this.balanceTags(xhtml);
  },

  /**
   * Balanceia tags HTML garantindo que todas as tags abertas sejam fechadas corretamente,
   * tags órfãs de fechamento sejam descartadas e a estrutura seja estritamente compatível com XML/QTI.
   * @param {string} html - Fragmento HTML
   * @returns {string} Fragmento HTML balanceado
   */
  balanceTags(html) {
    if (!html) return '';

    const voidElements = new Set([
      'br', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr', 'area', 'base', 'col', 'embed', 'param'
    ]);
    const inlineFormatting = new Set([
      'strong', 'em', 'b', 'i', 'u', 's', 'sub', 'sup', 'span', 'small', 'big', 'code', 'mark'
    ]);
    const blockElements = new Set([
      'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'blockquote', 'figure', 'figcaption', 'section', 'article'
    ]);

    const tagRegex = /<\/?([a-zA-Z0-9]+)(?:\s+[^>]*)?\/?>/g;
    let lastIndex = 0;
    let result = '';
    const stack = [];
    let m;

    while ((m = tagRegex.exec(html)) !== null) {
      const textBefore = html.substring(lastIndex, m.index);
      result += textBefore;
      lastIndex = tagRegex.lastIndex;

      const fullTag = m[0];
      const tagName = m[1].toLowerCase();
      const isClosing = fullTag.startsWith('</');
      const isSelfClosing = fullTag.endsWith('/>') || voidElements.has(tagName);

      if (isClosing) {
        if (voidElements.has(tagName)) {
          // </br>, </img> etc. são tags de fechamento espúrias em elementos vazios; descarta
          continue;
        }
        // Localiza a tag correspondente mais recente na pilha
        const idx = stack.map(s => s.name).lastIndexOf(tagName);
        if (idx !== -1) {
          // Fecha todas as tags que foram abertas após ela
          while (stack.length > idx) {
            const top = stack.pop();
            result += `</${top.name}>`;
          }
        }
        // Se não encontrou na pilha, é tag de fechamento órfã: é ignorada (descartada)
      } else if (isSelfClosing) {
        if (!fullTag.endsWith('/>')) {
          result += fullTag.replace(/>$/, ' />');
        } else {
          result += fullTag;
        }
      } else {
        // Tag de abertura
        // Se abrir um elemento de bloco, fecha formatações inline abertas anteriormente
        if (blockElements.has(tagName)) {
          while (stack.length > 0 && inlineFormatting.has(stack[stack.length - 1].name)) {
            const top = stack.pop();
            result += `</${top.name}>`;
          }
          // Fecha <p> anterior se abrir outro <p> sem fechamento
          if (tagName === 'p' && stack.length > 0 && stack[stack.length - 1].name === 'p') {
            const top = stack.pop();
            result += `</${top.name}>`;
          }
        }
        stack.push({ name: tagName, tag: fullTag });
        result += fullTag;
      }
    }

    result += html.substring(lastIndex);

    // Fecha quaisquer tags não-fechadas restantes na pilha em ordem inversa
    while (stack.length > 0) {
      const top = stack.pop();
      result += `</${top.name}>`;
    }

    // Limpa tags inline de formatação vazias residuais (ex: <strong></strong> ou <em> </em>)
    result = result.replace(/<(strong|em|b|i|u|s|sub|sup)(\s+[^>]*)?>\s*<\/\1>/gi, '');

    return result;
  }
};
