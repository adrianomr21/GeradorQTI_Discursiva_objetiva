import { Logger } from '../logger.js';
import { OmmlConverter } from './ommlConverter.js';

export const DocxExporter = {
  escapeXml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  },

  htmlToOpenXml(html, context) {
    if (!html) return '';
    const clean = html.trim();
    if (!clean) return '';

    if (typeof DOMParser !== 'undefined') {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<body>${clean}</body>`, 'text/html');
        if (doc && doc.body && doc.body.childNodes && doc.body.childNodes.length > 0) {
          return this.domNodesToOpenXml(doc.body.childNodes, context);
        }
      } catch (e) {
        // Fallback
      }
    }

    return this.universalHtmlToOpenXml(clean, context);
  },

  universalHtmlToOpenXml(html, context) {
    let output = '';
    let text = html;

    text = text.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (match, tableBody) => {
      let tblXml = '<w:tbl>';
      tblXml += '<w:tblPr>';
      tblXml += '<w:tblW w:w="0" w:type="auto"/>';
      tblXml += '<w:tblBorders>';
      tblXml += '<w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>';
      tblXml += '<w:left w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>';
      tblXml += '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>';
      tblXml += '<w:right w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>';
      tblXml += '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>';
      tblXml += '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>';
      tblXml += '</w:tblBorders>';
      tblXml += '</w:tblPr>';

      const rowMatches = tableBody.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
      rowMatches.forEach(rowHtml => {
        tblXml += '<w:tr>';
        const cellMatches = rowHtml.match(/<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi) || [];
        cellMatches.forEach(cellHtml => {
          const isTh = /^<th/i.test(cellHtml);
          const cellContent = cellHtml.replace(/^<(td|th)[^>]*>|<\/(td|th)>$/gi, '');
          tblXml += '<w:tc>';
          tblXml += '<w:tcPr>';
          tblXml += '<w:tcW w:w="2400" w:type="dxa"/>';
          if (isTh) {
            tblXml += '<w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/>';
          }
          tblXml += '</w:tcPr>';
          const parsedCell = this.parseInlineRuns(cellContent, context);
          tblXml += `<w:p><w:pPr><w:spacing w:after="0"/></w:pPr>${parsedCell || '<w:r><w:t></w:t></w:r>'}</w:p>`;
          tblXml += '</w:tc>';
        });
        tblXml += '</w:tr>';
      });

      tblXml += '</w:tbl>';
      return `\n%%BLOCK_XML_${tblXml}%%BLOCK_XML_END%\n`;
    });

    text = text.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (match, listBody) => {
      const liMatches = listBody.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
      const listXml = liMatches.map(liHtml => {
        const liContent = liHtml.replace(/^<li[^>]*>|<\/li>$/gi, '');
        const pPr = '<w:pPr><w:ind w:left="720" w:hanging="360"/><w:spacing w:after="80"/></w:pPr>';
        const prefixRun = '<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">• </w:t></w:r>';
        const inner = this.parseInlineRuns(liContent, context);
        return `<w:p>${pPr}${prefixRun}${inner}</w:p>`;
      }).join('');
      return `\n%%BLOCK_XML_${listXml}%%BLOCK_XML_END%\n`;
    });

    text = text.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (match, listBody) => {
      const liMatches = listBody.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
      const listXml = liMatches.map((liHtml, idx) => {
        const liContent = liHtml.replace(/^<li[^>]*>|<\/li>$/gi, '');
        const pPr = '<w:pPr><w:ind w:left="720" w:hanging="360"/><w:spacing w:after="80"/></w:pPr>';
        const prefixRun = `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${idx + 1}. </w:t></w:r>`;
        const inner = this.parseInlineRuns(liContent, context);
        return `<w:p>${pPr}${prefixRun}${inner}</w:p>`;
      }).join('');
      return `\n%%BLOCK_XML_${listXml}%%BLOCK_XML_END%\n`;
    });

    text = text.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (match, qBody) => {
      const pPr = '<w:pPr><w:ind w:left="720"/><w:spacing w:after="120"/><w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="CBD5E1"/></w:pBdr></w:pPr>';
      const inner = this.parseInlineRuns(qBody, context);
      const bqXml = `<w:p>${pPr}${inner}</w:p>`;
      return `\n%%BLOCK_XML_${bqXml}%%BLOCK_XML_END%\n`;
    });

    const blocks = text.split(/\n+/);
    blocks.forEach(block => {
      const trimmed = block.trim();
      if (!trimmed) return;

      if (trimmed.startsWith('%%BLOCK_XML_') && trimmed.endsWith('%%BLOCK_XML_END%')) {
        const cleanBlockXml = trimmed.replace(/^%%BLOCK_XML_/, '').replace(/%%BLOCK_XML_END%$/, '');
        output += cleanBlockXml;
        return;
      }

      const pPr = '<w:pPr><w:spacing w:after="120" w:line="240" w:lineRule="auto"/></w:pPr>';
      const runs = this.parseInlineRuns(trimmed, context);
      if (runs) {
        output += `<w:p>${pPr}${runs}</w:p>`;
      }
    });

    return output;
  },

  domNodesToOpenXml(nodes, context) {
    let xml = '';
    const inlineBuffer = [];

    const flushInlineBuffer = (pPr = '') => {
      if (inlineBuffer.length > 0) {
        xml += `<w:p>${pPr}${inlineBuffer.join('')}</w:p>`;
        inlineBuffer.length = 0;
      }
    };

    Array.from(nodes).forEach(node => {
      if (node.nodeType === 3) {
        const text = node.textContent;
        if (text && text.trim()) {
          inlineBuffer.push(`<w:r><w:t xml:space="preserve">${this.escapeXml(text)}</w:t></w:r>`);
        }
      } else if (node.nodeType === 1) {
        const tag = node.tagName.toLowerCase();

        if (tag === 'p' || tag === 'div' || /^h[1-6]$/.test(tag)) {
          flushInlineBuffer();
          let pPr = '<w:pPr><w:spacing w:after="120" w:line="240" w:lineRule="auto"/></w:pPr>';
          if (/^h[1-6]$/.test(tag)) {
            pPr = '<w:pPr><w:spacing w:before="200" w:after="120"/><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:pPr>';
          }
          const innerXml = this.domInlineToOpenXml(node.childNodes, context);
          if (innerXml) {
            xml += `<w:p>${pPr}${innerXml}</w:p>`;
          }
        } else if (tag === 'table') {
          flushInlineBuffer();
          xml += this.domTableToOpenXml(node, context);
        } else if (tag === 'ul' || tag === 'ol') {
          flushInlineBuffer();
          Array.from(node.children).forEach((li, idx) => {
            if (li.tagName && li.tagName.toLowerCase() === 'li') {
              const bullet = tag === 'ul' ? '• ' : `${idx + 1}. `;
              const pPr = '<w:pPr><w:ind w:left="720" w:hanging="360"/><w:spacing w:after="80"/></w:pPr>';
              const prefixRun = `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${this.escapeXml(bullet)}</w:t></w:r>`;
              const innerXml = this.domInlineToOpenXml(li.childNodes, context);
              xml += `<w:p>${pPr}${prefixRun}${innerXml}</w:p>`;
            }
          });
        } else if (tag === 'blockquote') {
          flushInlineBuffer();
          const pPr = '<w:pPr><w:ind w:left="720"/><w:spacing w:after="120"/><w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="CBD5E1"/></w:pBdr></w:pPr>';
          const innerXml = this.domInlineToOpenXml(node.childNodes, context);
          xml += `<w:p>${pPr}${innerXml}</w:p>`;
        } else {
          inlineBuffer.push(this.domSingleInlineToOpenXml(node, context));
        }
      }
    });

    flushInlineBuffer();
    return xml;
  },

  domInlineToOpenXml(nodes, context, activeStyles = {}) {
    let runs = '';
    Array.from(nodes).forEach(node => {
      runs += this.domSingleInlineToOpenXml(node, context, activeStyles);
    });
    return runs;
  },

  domSingleInlineToOpenXml(node, context, activeStyles = {}) {
    if (node.nodeType === 3) {
      const text = node.textContent;
      if (!text) return '';
      if (/\\(?:frac|dfrac|tfrac|sqrt|int|iint|iiint|oint|sum|prod|lim|left|vec|bar|hat|dot|ddot|overline|cdot|pm|mp|div|neq|leq|geq|alpha|beta|gamma|delta|theta|lambda|pi|sigma|phi|omega|sin|cos|tan|ln|log)\b|\^\{[^\}]+\}|_\{[^\}]+\}/.test(text)) {
        return OmmlConverter.latexToOmml(text, false);
      }
      const rPr = this.buildRPr(activeStyles);
      return `<w:r>${rPr}<w:t xml:space="preserve">${this.escapeXml(text)}</w:t></w:r>`;
    }

    if (node.nodeType !== 1) return '';

    const tag = node.tagName.toLowerCase();
    const newStyles = { ...activeStyles };

    if (tag === 'b' || tag === 'strong') newStyles.bold = true;
    if (tag === 'i' || tag === 'em') newStyles.italic = true;
    if (tag === 'u') newStyles.underline = true;
    if (tag === 's' || tag === 'strike') newStyles.strike = true;
    if (tag === 'sup') newStyles.superscript = true;
    if (tag === 'sub') newStyles.subscript = true;

    if (tag === 'br') {
      return '<w:r><w:br/></w:r>';
    }

    if (tag === 'a') {
      const href = node.getAttribute('href') || '';
      if (href) {
        const rId = `rIdLink_${context.links.length + 1}`;
        context.links.push({ id: rId, target: href });
        const linkStyles = { ...newStyles, underline: true, color: '2563EB' };
        const innerText = this.domInlineToOpenXml(node.childNodes, context, linkStyles);
        return `<w:hyperlink r:id="${rId}">${innerText}</w:hyperlink>`;
      }
    }

    if (tag === 'img') {
      const src = node.getAttribute('src') || '';
      return this.processImageSrc(src, context);
    }

    if (node.classList && (node.classList.contains('qti-math') || node.classList.contains('math-tex') || node.classList.contains('katex'))) {
      const latex = node.getAttribute('data-latex') || node.getAttribute('data-expr') || node.textContent || '';
      const isDisplay = node.getAttribute('data-display') === 'true' || node.classList.contains('qti-math-display');
      if (latex) {
        return OmmlConverter.latexToOmml(latex, isDisplay);
      }
    }

    return this.domInlineToOpenXml(node.childNodes, context, newStyles);
  },

  domTableToOpenXml(tableEl, context) {
    let tblXml = '<w:tbl>';
    tblXml += '<w:tblPr>';
    tblXml += '<w:tblW w:w="0" w:type="auto"/>';
    tblXml += '<w:tblBorders>';
    tblXml += '<w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>';
    tblXml += '<w:left w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>';
    tblXml += '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>';
    tblXml += '<w:right w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>';
    tblXml += '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>';
    tblXml += '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>';
    tblXml += '</w:tblBorders>';
    tblXml += '</w:tblPr>';

    const rows = tableEl.querySelectorAll('tr');
    rows.forEach(tr => {
      tblXml += '<w:tr>';
      const cells = tr.querySelectorAll('th, td');
      cells.forEach(tc => {
        const isTh = tc.tagName.toLowerCase() === 'th';
        tblXml += '<w:tc>';
        tblXml += '<w:tcPr>';
        tblXml += '<w:tcW w:w="2400" w:type="dxa"/>';
        if (isTh) {
          tblXml += '<w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/>';
        }
        tblXml += '</w:tcPr>';

        const cellNodes = tc.childNodes;
        let cellContent = this.domNodesToOpenXml(cellNodes, context);
        if (!cellContent) {
          cellContent = '<w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:t></w:t></w:r></w:p>';
        }
        tblXml += cellContent;
        tblXml += '</w:tc>';
      });
      tblXml += '</w:tr>';
    });

    tblXml += '</w:tbl>';
    return tblXml;
  },

  parseInlineRuns(rawHtml, context) {
    if (!rawHtml) return '';
    let runs = '';

    let html = rawHtml.replace(/^<(?:p|div)[^>]*>|<\/(?:p|div)>$/gi, '');

    // 1. Processa tags de imagem <img>
    html = html.replace(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi, (match, src) => {
      const imgXml = this.processImageSrc(src, context);
      return `%%INLINE_${imgXml}%%END_INLINE%`;
    });

    // 2. Processa fórmulas matemáticas LaTeX .qti-math, .math-tex, .katex
    html = html.replace(/<span[^>]*class=["'][^"']*(?:qti-math|math-tex|katex)[^"']*["'][^>]*data-latex=["']([^"']+)["'][^>]*>[\s\S]*?<\/span>/gi, (match, latex) => {
      const isDisplay = /qti-math-display|data-display=["']true["']/i.test(match);
      const mathXml = OmmlConverter.latexToOmml(latex, isDisplay);
      return `%%INLINE_${mathXml}%%END_INLINE%`;
    });

    // 3. Processa delimitadores TeX: \[...\] ou $$...$$ ou \(...\)
    html = html.replace(/\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$/g, (match, tex1, tex2) => {
      const latex = tex1 || tex2;
      const mathXml = OmmlConverter.latexToOmml(latex, true);
      return `%%INLINE_${mathXml}%%END_INLINE%`;
    });

    html = html.replace(/\\\(([\s\S]*?)\\\)/g, (match, latex) => {
      const mathXml = OmmlConverter.latexToOmml(latex, false);
      return `%%INLINE_${mathXml}%%END_INLINE%`;
    });

    // 4. Processa links <a>
    html = html.replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (match, href, linkText) => {
      const rId = `rIdLink_${context.links.length + 1}`;
      context.links.push({ id: rId, target: href });
      const cleanText = linkText.replace(/<[^>]+>/g, '');
      const linkXml = `<w:hyperlink r:id="${rId}"><w:r><w:rPr><w:color w:val="2563EB"/><w:u w:val="single"/></w:rPr><w:t xml:space="preserve">${this.escapeXml(cleanText)}</w:t></w:r></w:hyperlink>`;
      return `%%INLINE_${linkXml}%%END_INLINE%`;
    });

    const parts = html.split(/(%%INLINE_[\s\S]*?%%END_INLINE%|<[^>]+>)/g);
    const styles = { bold: false, italic: false, underline: false, strike: false, sup: false, sub: false };

    parts.forEach(part => {
      if (!part) return;

      if (part.startsWith('%%INLINE_') && part.endsWith('%%END_INLINE%')) {
        const inlineXml = part.replace(/^%%INLINE_/, '').replace(/%%END_INLINE%$/, '');
        runs += inlineXml;
        return;
      }

      if (part.startsWith('<') && part.endsWith('>')) {
        const tag = part.replace(/[<>\/]/g, '').toLowerCase().trim();
        const isClosing = part.startsWith('</');

        if (tag === 'b' || tag === 'strong') styles.bold = !isClosing;
        if (tag === 'i' || tag === 'em') styles.italic = !isClosing;
        if (tag === 'u') styles.underline = !isClosing;
        if (tag === 's' || tag === 'strike') styles.strike = !isClosing;
        if (tag === 'sup') styles.sup = !isClosing;
        if (tag === 'sub') styles.sub = !isClosing;
        if (tag === 'br') runs += '<w:r><w:br/></w:r>';
        return;
      }

      const text = part;
      if (text) {
        if (/\\(?:frac|dfrac|tfrac|sqrt|int|iint|iiint|oint|sum|prod|lim|left|vec|bar|hat|dot|ddot|overline|cdot|pm|mp|div|neq|leq|geq|alpha|beta|gamma|delta|theta|lambda|pi|sigma|phi|omega|sin|cos|tan|ln|log)\b|\^\{[^\}]+\}|_\{[^\}]+\}/.test(text)) {
          runs += OmmlConverter.latexToOmml(text, false);
          return;
        }

        let rPr = '<w:rPr>';
        if (styles.bold) rPr += '<w:b/>';
        if (styles.italic) rPr += '<w:i/>';
        if (styles.underline) rPr += '<w:u w:val="single"/>';
        if (styles.strike) rPr += '<w:strike/>';
        if (styles.sup) rPr += '<w:vertAlign w:val="superscript"/>';
        if (styles.sub) rPr += '<w:vertAlign w:val="subscript"/>';
        rPr += '</w:rPr>';

        if (rPr === '<w:rPr></w:rPr>') rPr = '';
        runs += `<w:r>${rPr}<w:t xml:space="preserve">${this.escapeXml(text)}</w:t></w:r>`;
      }
    });

    return runs;
  },

  processImageSrc(src, context) {
    if (!src || !src.startsWith('data:image/')) return '';

    const match = src.match(/^data:image\/([a-zA-Z0-9\+\-\.]+);base64,(.+)$/);
    if (!match) return '';

    let ext = match[1].toLowerCase();
    if (ext === 'svg+xml') ext = 'svg';
    if (ext === 'jpeg') ext = 'jpg';

    const base64Data = match[2];
    const imageIndex = context.images.length + 1;
    const rId = `rIdImg_${imageIndex}`;
    const filename = `image_${imageIndex}.${ext === 'svg' ? 'png' : ext}`;

    context.images.push({
      id: rId,
      filename: filename,
      base64: base64Data,
      ext: ext
    });

    const cx = 3600000;
    const cy = 2700000;

    return `
      <w:r>
        <w:drawing>
          <wp:inline distT="0" distB="0" distL="0" distR="0">
            <wp:extent cx="${cx}" cy="${cy}"/>
            <wp:effectExtent l="0" t="0" r="0" b="0"/>
            <wp:docPr id="${imageIndex}" name="Imagem ${imageIndex}"/>
            <wp:cNvGraphicFramePr>
              <a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>
            </wp:cNvGraphicFramePr>
            <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
              <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                  <pic:nvPicPr>
                    <pic:cNvPr id="${imageIndex}" name="${filename}"/>
                    <pic:cNvPicPr/>
                  </pic:nvPicPr>
                  <pic:blipFill>
                    <a:blip r:embed="${rId}"/>
                    <a:stretch><a:fillRect/></a:stretch>
                  </pic:blipFill>
                  <pic:spPr>
                    <a:xfrm>
                      <a:off x="0" y="0"/>
                      <a:ext cx="${cx}" cy="${cy}"/>
                    </a:xfrm>
                    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                  </pic:spPr>
                </pic:pic>
              </a:graphicData>
            </a:graphic>
          </wp:inline>
        </w:drawing>
      </w:r>
    `;
  },

  buildRPr(styles) {
    if (!styles || Object.keys(styles).length === 0) return '';
    let xml = '<w:rPr>';
    if (styles.bold) xml += '<w:b/>';
    if (styles.italic) xml += '<w:i/>';
    if (styles.underline) xml += '<w:u w:val="single"/>';
    if (styles.strike) xml += '<w:strike/>';
    if (styles.superscript) xml += '<w:vertAlign w:val="superscript"/>';
    if (styles.subscript) xml += '<w:vertAlign w:val="subscript"/>';
    if (styles.color) xml += `<w:color w:val="${styles.color}"/>`;
    xml += '</w:rPr>';
    return xml;
  },

  generateDocumentXml(questions, title, context) {
    let bodyXml = '';

    bodyXml += `
      <w:p>
        <w:pPr>
          <w:spacing w:before="0" w:after="240"/>
          <w:jc w:val="center"/>
        </w:pPr>
        <w:r>
          <w:rPr>
            <w:b/>
            <w:sz w:val="36"/>
            <w:szCs w:val="36"/>
            <w:color w:val="1E293B"/>
          </w:rPr>
          <w:t xml:space="preserve">${this.escapeXml(title || 'Atividade Avaliativa')}</w:t>
        </w:r>
      </w:p>
    `;

    questions.forEach((q, index) => {
      const qNum = index + 1;
      const qTitle = q.title || `Questão ${qNum}`;

      bodyXml += `
        <w:p>
          <w:pPr>
            <w:spacing w:before="240" w:after="120"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:b/>
              <w:sz w:val="26"/>
              <w:szCs w:val="26"/>
              <w:color w:val="0F172A"/>
            </w:rPr>
            <w:t xml:space="preserve">${this.escapeXml(qTitle)}</w:t>
          </w:r>
        </w:p>
      `;

      if (q.prompt) {
        bodyXml += this.htmlToOpenXml(q.prompt, context);
      }

      if (q.type === 'multiple_choice' && q.options && q.options.length > 0) {
        q.options.forEach(opt => {
          const prefix = opt.isCorrect ? `*${opt.letter.toUpperCase()}) ` : `${opt.letter.toUpperCase()}) `;
          const pPr = '<w:pPr><w:spacing w:after="80" w:line="240" w:lineRule="auto"/><w:ind w:left="360"/></w:pPr>';
          const prefixRun = `<w:r><w:rPr><w:b/><w:color w:val="${opt.isCorrect ? '059669' : '334155'}"/></w:rPr><w:t xml:space="preserve">${this.escapeXml(prefix)}</w:t></w:r>`;
          
          let optContent = this.htmlToOpenXml(opt.text, context);
          if (optContent.startsWith('<w:p>')) {
            optContent = optContent.replace(/^<w:p>(?:<w:pPr>.*?<\/w:pPr>)?/i, '').replace(/<\/w:p>$/i, '');
          }

          bodyXml += `<w:p>${pPr}${prefixRun}${optContent}</w:p>`;
        });
      }

      if (q.type === 'discursive' && q.modelAnswer) {
        bodyXml += `
          <w:p>
            <w:pPr>
              <w:spacing w:before="120" w:after="60"/>
            </w:pPr>
            <w:r>
              <w:rPr>
                <w:b/>
                <w:color w:val="2563EB"/>
              </w:rPr>
              <w:t xml:space="preserve">Padrão de Resposta:</w:t>
            </w:r>
          </w:p>
        `;
        bodyXml += this.htmlToOpenXml(q.modelAnswer, context);
      }

      if (q.feedback) {
        bodyXml += `
          <w:p>
            <w:pPr>
              <w:spacing w:before="120" w:after="60"/>
            </w:pPr>
            <w:r>
              <w:rPr>
                <w:b/>
                <w:color w:val="475569"/>
              </w:rPr>
              <w:t xml:space="preserve">Feedback:</w:t>
            </w:r>
          </w:p>
        `;
        bodyXml += this.htmlToOpenXml(q.feedback, context);
      }

      if (index < questions.length - 1) {
        bodyXml += `
          <w:p>
            <w:pPr>
              <w:spacing w:before="180" w:after="180"/>
              <w:pBdr>
                <w:bottom w:val="single" w:sz="6" w:space="1" w:color="CBD5E1"/>
              </w:pBdr>
            </w:pPr>
            <w:r><w:t></w:t></w:r>
          </w:p>
        `;
      }
    });

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
                  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
                  xmlns:o="urn:schemas-microsoft-com:office:office"
                  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
                  xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
                  xmlns:v="urn:schemas-microsoft-com:vml"
                  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
                  xmlns:w10="urn:schemas-microsoft-com:office:word"
                  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
                  xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
                  xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml"
                  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
                  xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
        <w:body>
          ${bodyXml}
          <w:sectPr>
            <w:pgSz w:w="11906" w:h="16838"/>
            <w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1417" w:header="708" w:footer="708" w:gutter="0"/>
            <w:cols w:space="708"/>
            <w:docGrid w:linePitch="360"/>
          </w:sectPr>
        </w:body>
      </w:document>
    `;
  },

  async generateDocx(questions, title = 'Atividade Avaliativa') {
    if (!questions || questions.length === 0) {
      Logger.error('Não há questões para exportar para o Word.');
      return false;
    }

    if (typeof JSZip === 'undefined' && typeof window.JSZip === 'undefined' && typeof global.JSZip === 'undefined') {
      Logger.error('Biblioteca JSZip não encontrada para exportar o Word (.docx).');
      return false;
    }

    const JSZipLib = (typeof window !== 'undefined' && window.JSZip) ? window.JSZip : (typeof JSZip !== 'undefined' ? JSZip : global.JSZip);
    const zip = new JSZipLib();

    Logger.info(`Iniciando exportação para Word (.docx) de "${title}" (${questions.length} questões)...`);

    try {
      const context = {
        images: [],
        links: []
      };

      const documentXml = this.generateDocumentXml(questions, title, context);
      zip.file('word/document.xml', documentXml);

      context.images.forEach(img => {
        zip.file(`word/media/${img.filename}`, img.base64, { base64: true });
      });

      let relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
          <Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
          <Relationship Id="rIdWebSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/webSettings" Target="webSettings.xml"/>
          <Relationship Id="rIdFontTable" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable" Target="fontTable.xml"/>
      `;

      context.images.forEach(img => {
        relsXml += `<Relationship Id="${img.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${img.filename}"/>`;
      });

      context.links.forEach(link => {
        relsXml += `<Relationship Id="${link.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${this.escapeXml(link.target)}" TargetMode="External"/>`;
      });

      relsXml += '</Relationships>';
      zip.file('word/_rels/document.xml.rels', relsXml);

      zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
          <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
          <Default Extension="xml" ContentType="application/xml"/>
          <Default Extension="png" ContentType="image/png"/>
          <Default Extension="jpeg" ContentType="image/jpeg"/>
          <Default Extension="jpg" ContentType="image/jpeg"/>
          <Default Extension="gif" ContentType="image/gif"/>
          <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
          <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
          <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
          <Override PartName="/word/webSettings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.webSettings+xml"/>
          <Override PartName="/word/fontTable.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/>
          <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
          <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
        </Types>
      `);

      zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
          <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
          <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
        </Relationships>
      `);

      zip.file('word/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
                  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
          <w:docDefaults>
            <w:rPrDefault>
              <w:rPr>
                <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/>
                <w:sz w:val="22"/>
                <w:szCs w:val="22"/>
                <w:lang w:val="pt-BR" w:eastAsia="pt-BR" w:bidi="ar-SA"/>
              </w:rPr>
            </w:rPrDefault>
            <w:pPrDefault>
              <w:pPr>
                <w:spacing w:after="160" w:line="240" w:lineRule="auto"/>
              </w:pPr>
            </w:pPrDefault>
          </w:docDefaults>
          <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
            <w:name w:val="Normal"/>
            <w:qFormat/>
            <w:pPr>
              <w:spacing w:after="120" w:line="240" w:lineRule="auto"/>
            </w:pPr>
            <w:rPr>
              <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
              <w:sz w:val="22"/>
              <w:szCs w:val="22"/>
              <w:color w:val="0F172A"/>
            </w:rPr>
          </w:style>
          <w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont">
            <w:name w:val="Default Paragraph Font"/>
            <w:uiPriority w:val="1"/>
            <w:semiHidden/>
            <w:unhideWhenUsed/>
          </w:style>
          <w:style w:type="table" w:default="1" w:styleId="TableNormal">
            <w:name w:val="Normal Table"/>
            <w:uiPriority w:val="99"/>
            <w:semiHidden/>
            <w:unhideWhenUsed/>
            <w:tblPr>
              <w:tblInd w:w="0" w:type="dxa"/>
              <w:tblCellMar>
                <w:top w:w="0" w:type="dxa"/>
                <w:left w:w="108" w:type="dxa"/>
                <w:bottom w:w="0" w:type="dxa"/>
                <w:right w:w="108" w:type="dxa"/>
              </w:tblCellMar>
            </w:tblPr>
          </w:style>
        </w:styles>
      `);

      zip.file('word/settings.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
          <w:zoom w:percent="100"/>
          <w:defaultTabStop w:val="708"/>
          <w:characterSpacingControl w:val="doNotCompress"/>
          <w:compat>
            <w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/>
          </w:compat>
        </w:settings>
      `);

      zip.file('word/webSettings.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <w:webSettings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
          <w:allowPNG/>
          <w:doNotSaveAsSingleFile/>
        </w:webSettings>
      `);

      zip.file('word/fontTable.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <w:fonts xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
                 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
          <w:font w:name="Calibri">
            <w:panose1 w:val="020F0502020204030204"/>
            <w:charset w:val="00"/>
            <w:family w:val="swiss"/>
            <w:pitch w:val="variable"/>
          </w:font>
          <w:font w:name="Times New Roman">
            <w:panose1 w:val="02020603050405020304"/>
            <w:charset w:val="00"/>
            <w:family w:val="roman"/>
            <w:pitch w:val="variable"/>
          </w:font>
          <w:font w:name="Arial">
            <w:panose1 w:val="020B0604020202020204"/>
            <w:charset w:val="00"/>
            <w:family w:val="swiss"/>
            <w:pitch w:val="variable"/>
          </w:font>
        </w:fonts>
      `);

      const now = new Date().toISOString();
      zip.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
                           xmlns:dc="http://purl.org/dc/elements/1.1/"
                           xmlns:dcterms="http://purl.org/dc/terms/"
                           xmlns:dcmitype="http://purl.org/dc/dcmitype/"
                           xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
          <dc:title>${this.escapeXml(title || 'Atividade Avaliativa')}</dc:title>
          <dc:creator>TaskFlow Gerador QTI</dc:creator>
          <cp:lastModifiedBy>TaskFlow Gerador QTI</cp:lastModifiedBy>
          <cp:revision>1</cp:revision>
          <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
          <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
        </cp:coreProperties>
      `);

      zip.file('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
                    xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
          <Application>Microsoft Office Word</Application>
          <DocSecurity>0</DocSecurity>
          <ScaleCrop>false</ScaleCrop>
          <HeadingPairs>
            <vt:vector size="2" baseType="variant">
              <vt:variant><vt:lpstr>Título</vt:lpstr></vt:variant>
              <vt:variant><vt:i4>1</vt:i4></vt:variant>
            </vt:vector>
          </HeadingPairs>
          <TitlesOfParts>
            <vt:vector size="1" baseType="lpstr">
              <vt:lpstr>${this.escapeXml(title || 'Atividade Avaliativa')}</vt:lpstr>
            </vt:vector>
          </TitlesOfParts>
          <Company></Company>
          <LinksUpToDate>false</LinksUpToDate>
          <SharedDoc>false</SharedDoc>
          <HyperlinksChanged>false</HyperlinksChanged>
          <AppVersion>16.0000</AppVersion>
        </Properties>
      `);

      const blob = await zip.generateAsync({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      const sanitizedName = (title || 'Atividade_Avaliativa').replace(/[^a-zA-Z0-9_\-]/g, '_');
      const filename = `${sanitizedName}.docx`;

      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
      }

      Logger.success(`Documento Word "${filename}" exportado com sucesso! (${(blob.size / 1024).toFixed(2)} KB)`);
      return true;

    } catch (err) {
      Logger.error(`Erro ao exportar documento Word: ${err.message}`);
      console.error(err);
      return false;
    }
  }
};
