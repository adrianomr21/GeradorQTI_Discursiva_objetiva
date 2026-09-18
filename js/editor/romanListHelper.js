/**
 * romanListHelper.js
 * Módulo responsável por transformar listas e linhas selecionadas no editor
 * em itens numerados com algarismos romanos em texto simples (sem formatação <ol>/<li>).
 * Exemplo:
 *   1. Débito em Lucros Acumulados...
 *   2. Débito em Dividendos a Pagar...
 * Transforma em:
 *   <p>I. Débito em Lucros Acumulados...</p>
 *   <p>II. Débito em Dividendos a Pagar...</p>
 */

import { Logger } from '../logger.js';

export const RomanListHelper = {
  /**
   * Converte um número inteiro positivo em algarismo romano em maiúsculas (1..3999).
   * @param {number} num
   * @returns {string}
   */
  toRoman(num) {
    if (!num || num < 1) return '';
    const romanMap = [
      [1000, 'M'],
      [900, 'CM'],
      [500, 'D'],
      [400, 'CD'],
      [100, 'C'],
      [90, 'XC'],
      [50, 'L'],
      [40, 'XL'],
      [10, 'X'],
      [9, 'IX'],
      [5, 'V'],
      [4, 'IV'],
      [1, 'I']
    ];
    let roman = '';
    let n = Math.floor(num);
    for (const [val, str] of romanMap) {
      while (n >= val) {
        roman += str;
        n -= val;
      }
    }
    return roman;
  },

  /**
   * Remove prefixos numéricos, alfabéticos, romanos ou marcadores do início de uma linha/texto.
   * Preserva tags HTML internas (como <strong>, <em>, <span>).
   * @param {string} text
   * @returns {string}
   */
  stripListPrefix(text) {
    if (!text) return '';
    let str = text.trim();

    // Remove tags <li> e </li> se envolverem a linha inteira
    str = str.replace(/^<li[^>]*>([\s\S]*)<\/li>$/i, '$1').trim();

    // Padrão de prefixo comum:
    // - (1), (a), (I), [1], [a], [I]
    // - 1., 1), 1-, 1–, 1—, 1:, 1º., 1ª., 1°, 1 - , 1 – , 1º -
    // - a., a), a-, a–, a—, a:, a - , A., A), A-, A–, A:, etc.
    // - I., I), I-, I–, I—, I - , II., III., IV., V., etc.
    // - -, –, —, •, *, ·, >
    const prefixPattern = /^(?:(?:\((?:\d+|[a-zA-Z]|[ivxlcdmIVXLCDM]+)\)|\[(?:\d+|[a-zA-Z]|[ivxlcdmIVXLCDM]+)\]|\d+[ºª°]?\s*[\.\)\-\–\—\:\/]|\b[a-zA-Z]\s*[\.\)\-\–\—\:]|(?:[ivxlcdmIVXLCDM]+)\s*[\.\)\-\–\—\:]|[\-\–\—\•\*\·\>]))\s*/i;

    // Se inicia diretamente com o prefixo
    if (prefixPattern.test(str)) {
      return str.replace(prefixPattern, '').trimStart();
    }

    // Se inicia com tags que envolvem apenas o prefixo: ex: <strong>1.</strong> Débito...
    const wrappedMatch = str.match(/^((?:<[a-z0-9]+[^>]*>\s*)+)(.*?)(<\/([a-z0-9]+)>\s*)+(.*)$/is);
    if (wrappedMatch) {
      const insideTags = wrappedMatch[2];
      const rest = wrappedMatch[5];
      if (insideTags && prefixPattern.test(insideTags.trim())) {
        const cleanInside = insideTags.trim().replace(prefixPattern, '').trim();
        if (!cleanInside) {
          // Tag envolvia somente o número do prefixo, descarta a tag do prefixo
          return rest.trimStart();
        } else {
          return wrappedMatch[1] + cleanInside + wrappedMatch[3] + rest;
        }
      }
    }

    // Se inicia com tag inline contendo prefixo no texto interno
    const tagStartMatch = str.match(/^<([a-z0-9]+)([^>]*)>([\s\S]*)<\/\1>$/i);
    if (tagStartMatch) {
      const tag = tagStartMatch[1];
      const attrs = tagStartMatch[2];
      const inner = tagStartMatch[3];
      if (tag.toLowerCase() !== 'p' && tag.toLowerCase() !== 'div') {
        const strippedInner = this.stripListPrefix(inner);
        if (strippedInner !== inner) {
          return `<${tag}${attrs}>${strippedInner}</${tag}>`;
        }
      }
    }

    return str;
  },

  /**
   * Converte um array de linhas de texto em linhas com numeração romana sequencial (I., II., III., etc.).
   * @param {Array<string>} lines
   * @returns {Array<string>}
   */
  convertLinesToRoman(lines) {
    let index = 1;
    return lines.map(line => {
      const trimmed = line ? line.trim() : '';
      if (!trimmed) return line;
      const clean = this.stripListPrefix(trimmed);
      const roman = this.toRoman(index++);
      return `${roman}. ${clean}`;
    });
  },

  /**
   * Converte HTML ou texto em parágrafos semânticos <p> com numeração romana (I., II., III., etc.).
   * Remove quaisquer tags <ol> e <li>.
   * @param {string} html
   * @returns {string}
   */
  convertHtmlToRomanParagraphs(html) {
    if (!html) return '';
    let content = html.trim();

    // 1. Caso contenha lista <ol> ou <ul>
    const listMatch = content.match(/<(?:ol|ul)[^>]*>([\s\S]*?)<\/(?:ol|ul)>/gi);
    if (listMatch) {
      let result = content;
      for (const listBlock of listMatch) {
        const liMatches = listBlock.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
        let index = 1;
        const paragraphs = liMatches.map(li => {
          const inner = li.replace(/^<li[^>]*>([\s\S]*?)<\/li>$/i, '$1').trim();
          if (!inner || inner === '<br>' || inner === '<br/>' || inner === '<br />') return '';
          const clean = this.stripListPrefix(inner);
          const roman = this.toRoman(index++);
          return `<p>${roman}. ${clean}</p>`;
        }).filter(Boolean).join('');
        result = result.replace(listBlock, paragraphs);
      }
      return result;
    }

    // 2. Caso contenha blocos <p> ou <div>
    const blockMatches = content.match(/<(?:p|div)[^>]*>([\s\S]*?)<\/(?:p|div)>/gi);
    if (blockMatches && blockMatches.length > 0) {
      let index = 1;
      const paragraphs = [];
      for (const block of blockMatches) {
        const inner = block.replace(/^<(?:p|div)[^>]*>([\s\S]*?)<\/(?:p|div)>$/i, '$1').trim();
        if (!inner || inner === '<br>' || inner === '<br/>' || inner === '<br />') {
          continue;
        }
        if (/<br\s*\/?>/i.test(inner)) {
          const subLines = inner.split(/<br\s*\/?>/i);
          for (const sub of subLines) {
            const s = sub.trim();
            if (!s) continue;
            const clean = this.stripListPrefix(s);
            const roman = this.toRoman(index++);
            paragraphs.push(`<p>${roman}. ${clean}</p>`);
          }
        } else {
          const clean = this.stripListPrefix(inner);
          const roman = this.toRoman(index++);
          paragraphs.push(`<p>${roman}. ${clean}</p>`);
        }
      }
      return paragraphs.join('');
    }

    // 3. Texto simples ou com <br> / \n
    const lines = content
      .split(/(?:<br\s*\/?>|\r?\n)/i)
      .map(l => l.trim())
      .filter(l => l.length > 0);

    let index = 1;
    return lines.map(line => {
      const clean = this.stripListPrefix(line);
      const roman = this.toRoman(index++);
      return `<p>${roman}. ${clean}</p>`;
    }).join('');
  },

  /**
   * Converte a seleção atual no editor (ou textarea) para itens em algarismos romanos.
   * @param {HTMLElement} editorElement
   * @param {HTMLTextAreaElement} sourceElement
   * @param {boolean} isSourceMode
   */
  convertEditorSelection(editorElement, sourceElement, isSourceMode = false) {
    // Caso 1: Modo Código Fonte (Textarea)
    if (isSourceMode && sourceElement) {
      const textarea = sourceElement;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const fullText = textarea.value;

      if (start === end) {
        // Sem seleção: identifica linha atual
        const lineStart = fullText.lastIndexOf('\n', start - 1) + 1;
        let lineEnd = fullText.indexOf('\n', end);
        if (lineEnd === -1) lineEnd = fullText.length;
        const currentLine = fullText.substring(lineStart, lineEnd);

        if (!currentLine.trim()) {
          textarea.setRangeText('I. ', start, end, 'end');
        } else {
          const isHtml = /<[a-z0-9]+/i.test(currentLine);
          if (isHtml) {
            const clean = this.convertHtmlToRomanParagraphs(currentLine);
            textarea.setSelectionRange(lineStart, lineEnd);
            textarea.setRangeText(clean, lineStart, lineEnd, 'select');
          } else {
            const clean = this.stripListPrefix(currentLine.trim());
            const newLine = `I. ${clean}`;
            textarea.setSelectionRange(lineStart, lineEnd);
            textarea.setRangeText(newLine, lineStart, lineEnd, 'select');
          }
        }
      } else {
        // Com seleção de texto
        const selected = fullText.substring(start, end);
        const isHtml = /<[a-z0-9]+/i.test(selected);

        if (isHtml) {
          const converted = this.convertHtmlToRomanParagraphs(selected);
          textarea.setRangeText(converted, start, end, 'select');
        } else {
          const lines = selected.split(/\r?\n/);
          const convertedLines = this.convertLinesToRoman(lines);
          textarea.setRangeText(convertedLines.join('\n'), start, end, 'select');
        }
      }

      textarea.dispatchEvent(new Event('input'));
      if (editorElement) {
        editorElement.innerHTML = textarea.value;
      }
      Logger.success('Texto convertido para algarismos romanos no código fonte.');
      return;
    }

    // Caso 2: Modo Visual (contenteditable)
    if (!editorElement) return;
    editorElement.focus();

    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);

    // 2.1. Verifica se está dentro de uma tag <ol> ou <ul>
    let listEl = range.commonAncestorContainer;
    if (listEl.nodeType === Node.TEXT_NODE) listEl = listEl.parentElement;
    listEl = listEl ? listEl.closest('ol, ul') : null;

    if (listEl && editorElement.contains(listEl)) {
      const lis = Array.from(listEl.querySelectorAll('li'));
      if (lis.length > 0) {
        let idx = 1;
        const frag = document.createDocumentFragment();
        for (const li of lis) {
          const inner = li.innerHTML.trim();
          if (!inner || inner === '<br>' || inner === '<br/>' || inner === '<br />') continue;
          const clean = this.stripListPrefix(inner);
          const p = document.createElement('p');
          p.innerHTML = `${this.toRoman(idx++)}. ${clean}`;
          frag.appendChild(p);
        }
        listEl.parentNode.replaceChild(frag, listEl);
        Logger.success('Lista convertida para algarismos romanos em texto simples.');
        return;
      }
    }

    // 2.2. Cursor colapsado (sem seleção de texto)
    if (range.collapsed) {
      let block = range.startContainer;
      if (block.nodeType === Node.TEXT_NODE) block = block.parentElement;
      const closestP = block ? block.closest('p, div, li') : null;

      if (closestP && editorElement.contains(closestP) && closestP !== editorElement) {
        if (closestP.querySelector('br')) {
          const html = closestP.innerHTML;
          const converted = this.convertHtmlToRomanParagraphs(html);
          const temp = document.createElement('div');
          temp.innerHTML = converted;
          const frag = document.createDocumentFragment();
          while (temp.firstChild) {
            frag.appendChild(temp.firstChild);
          }
          if (frag.childNodes.length > 0) {
            closestP.parentNode.replaceChild(frag, closestP);
            Logger.success('Linhas convertidas para algarismos romanos.');
            return;
          }
        } else {
          const clean = this.stripListPrefix(closestP.innerHTML.trim());
          closestP.innerHTML = `I. ${clean}`;
          Logger.success('Linha convertida para algarismo romano (I.).');
          return;
        }
      }

      // Caso geral: insere "I. " na posição do cursor
      const textNode = document.createTextNode('I. ');
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      Logger.success('Algarismo romano inserido.');
      return;
    }

    // 2.3. Usuário selecionou blocos ou texto
    const div = document.createElement('div');
    div.appendChild(range.cloneContents());
    const selectedHtml = div.innerHTML;

    const convertedHtml = this.convertHtmlToRomanParagraphs(selectedHtml || range.toString());

    range.deleteContents();

    const temp = document.createElement('div');
    temp.innerHTML = convertedHtml;
    const frag = document.createDocumentFragment();
    let firstInserted = null;
    let lastInserted = null;
    while (temp.firstChild) {
      const node = temp.firstChild;
      if (!firstInserted) firstInserted = node;
      lastInserted = node;
      frag.appendChild(node);
    }

    range.insertNode(frag);

    // Se o elemento pai for um <p> ou <div> que agora contém apenas outros blocos <p>, desempacota
    if (firstInserted && firstInserted.parentElement) {
      const parent = firstInserted.parentElement;
      if (parent !== editorElement && (parent.tagName === 'P' || parent.tagName === 'DIV')) {
        const parentChildren = Array.from(parent.children);
        const isAllBlocks = parentChildren.length > 0 && parentChildren.every(c => c.tagName === 'P' || c.tagName === 'DIV');
        if (isAllBlocks) {
          while (parent.firstChild) {
            parent.parentNode.insertBefore(parent.firstChild, parent);
          }
          parent.parentNode.removeChild(parent);
        }
      }
    }

    if (lastInserted) {
      const newRange = document.createRange();
      newRange.selectNodeContents(lastInserted);
      newRange.collapse(false);
      sel.removeAllRanges();
      sel.addRange(newRange);
    }

    Logger.success('Itens selecionados convertidos para algarismos romanos.');
  }
};
