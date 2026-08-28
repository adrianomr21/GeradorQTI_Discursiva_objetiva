/**
 * emfConverter.js
 * Módulo responsável por converter arquivos vetoriais EMF (Enhanced Metafile) e WMF
 * gerados pelo Microsoft Word em gráficos vetoriais SVG compatíveis nativamente com navegadores e pacotes QTI.
 */

export const EmfConverter = {
  /**
   * Verifica se o buffer contém cabeçalho de um arquivo EMF.
   * @param {Uint8Array|Buffer} data
   * @returns {boolean}
   */
  isEmf(data) {
    if (!data || data.length < 44) return false;
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    // Assinatura ' EMF' em offset 40 (0x20 0x45 0x4D 0x46 / 0x28646D65)
    return bytes[40] === 0x20 && bytes[41] === 0x45 && bytes[42] === 0x4D && bytes[43] === 0x46;
  },

  /**
   * Converte um arquivo EMF em uma string SVG completa.
   * @param {Uint8Array|Buffer|ArrayBuffer} data
   * @returns {string} Código SVG
   */
  toSvg(data) {
    if (!data) return '';
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data.buffer || data);
    if (bytes.length < 88) return '';

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    // Lê Header bounds
    const boundsLeft = view.getInt32(8, true);
    const boundsTop = view.getInt32(12, true);
    const boundsRight = view.getInt32(16, true);
    const boundsBottom = view.getInt32(20, true);

    const devWidth = view.getInt32(72, true) || 800;
    const devHeight = view.getInt32(76, true) || 600;

    let width = boundsRight - boundsLeft;
    let height = boundsBottom - boundsTop;
    let minX = boundsLeft;
    let minY = boundsTop;

    if (width <= 0 || height <= 0) {
      width = devWidth;
      height = devHeight;
      minX = 0;
      minY = 0;
    }

    const objects = {};
    let currentPen = { color: '#000000', width: 1, style: 0 };
    let currentBrush = { color: 'none', style: 1 };
    let currentTextColor = '#000000';
    let currentPos = { x: 0, y: 0 };
    let currentPath = '';

    const svgElements = [];

    const flushPath = () => {
      if (currentPath) {
        const strokeColor = currentPen.style === 5 ? 'none' : currentPen.color; // 5 = PS_NULL
        const strokeWidth = Math.max(currentPen.width, 1);
        const fillColor = currentBrush.style === 1 ? 'none' : currentBrush.color; // 1 = BS_NULL
        svgElements.push(`<path d="${currentPath}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill="${fillColor}" stroke-linecap="round" stroke-linejoin="round" />`);
        currentPath = '';
      }
    };

    let offset = 0;
    while (offset + 8 <= bytes.length) {
      const type = view.getUint32(offset, true);
      const size = view.getUint32(offset + 4, true);
      if (size <= 0 || offset + size > bytes.length) break;

      switch (type) {
        case 14: // EMR_EOF
          offset = bytes.length;
          break;

        case 38: { // EMR_CREATEPEN
          if (offset + 28 <= bytes.length) {
            const id = view.getUint32(offset + 8, true);
            const style = view.getUint32(offset + 12, true);
            const w = view.getInt32(offset + 16, true);
            const r = bytes[offset + 24];
            const g = bytes[offset + 25];
            const b = bytes[offset + 26];
            const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
            objects[id] = { type: 'pen', color: hex, width: Math.max(w, 1), style };
          }
          break;
        }

        case 39: { // EMR_CREATEBRUSHINDIRECT
          if (offset + 20 <= bytes.length) {
            const id = view.getUint32(offset + 8, true);
            const style = view.getUint32(offset + 12, true);
            const r = bytes[offset + 16];
            const g = bytes[offset + 17];
            const b = bytes[offset + 18];
            const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
            objects[id] = { type: 'brush', color: style === 1 ? 'none' : hex, style };
          }
          break;
        }

        case 37: { // EMR_SELECTOBJECT
          if (offset + 12 <= bytes.length) {
            const id = view.getUint32(offset + 8, true);
            if (objects[id]) {
              flushPath();
              if (objects[id].type === 'pen') currentPen = objects[id];
              else if (objects[id].type === 'brush') currentBrush = objects[id];
            }
          }
          break;
        }

        case 40: { // EMR_DELETEOBJECT
          if (offset + 12 <= bytes.length) {
            const id = view.getUint32(offset + 8, true);
            delete objects[id];
          }
          break;
        }

        case 22: { // EMR_SETTEXTCOLOR
          if (offset + 12 <= bytes.length) {
            const r = bytes[offset + 8];
            const g = bytes[offset + 9];
            const b = bytes[offset + 10];
            currentTextColor = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
          }
          break;
        }

        case 27: { // EMR_MOVETOEX
          if (offset + 16 <= bytes.length) {
            const x = view.getInt32(offset + 8, true);
            const y = view.getInt32(offset + 12, true);
            currentPos = { x, y };
            currentPath += ` M ${x} ${y}`;
          }
          break;
        }

        case 54: { // EMR_LINETO
          if (offset + 16 <= bytes.length) {
            const x = view.getInt32(offset + 8, true);
            const y = view.getInt32(offset + 12, true);
            if (!currentPath) {
              currentPath = `M ${currentPos.x} ${currentPos.y}`;
            }
            currentPath += ` L ${x} ${y}`;
            currentPos = { x, y };
          }
          break;
        }

        case 4: // EMR_POLYLINE
        case 87: { // EMR_POLYLINE16
          flushPath();
          const is16 = type === 87;
          const count = view.getUint32(offset + 24, true);
          let pOff = offset + 28;
          let polyPath = '';
          for (let p = 0; p < count && pOff + (is16 ? 4 : 8) <= bytes.length; p++) {
            const px = is16 ? view.getInt16(pOff, true) : view.getInt32(pOff, true);
            const py = is16 ? view.getInt16(pOff + 2, true) : view.getInt32(pOff + 4, true);
            polyPath += p === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`;
            pOff += is16 ? 4 : 8;
          }
          if (polyPath) {
            const strokeColor = currentPen.style === 5 ? 'none' : currentPen.color;
            svgElements.push(`<path d="${polyPath}" stroke="${strokeColor}" stroke-width="${Math.max(currentPen.width, 1)}" fill="none" stroke-linecap="round" stroke-linejoin="round" />`);
          }
          break;
        }

        case 3: // EMR_POLYGON
        case 86: { // EMR_POLYGON16
          flushPath();
          const is16 = type === 86;
          const count = view.getUint32(offset + 24, true);
          let pOff = offset + 28;
          let polyPath = '';
          for (let p = 0; p < count && pOff + (is16 ? 4 : 8) <= bytes.length; p++) {
            const px = is16 ? view.getInt16(pOff, true) : view.getInt32(pOff, true);
            const py = is16 ? view.getInt16(pOff + 2, true) : view.getInt32(pOff + 4, true);
            polyPath += p === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`;
            pOff += is16 ? 4 : 8;
          }
          if (polyPath) {
            polyPath += ' Z';
            const strokeColor = currentPen.style === 5 ? 'none' : currentPen.color;
            const fillColor = currentBrush.style === 1 ? 'none' : currentBrush.color;
            svgElements.push(`<path d="${polyPath}" stroke="${strokeColor}" stroke-width="${Math.max(currentPen.width, 1)}" fill="${fillColor}" stroke-linecap="round" stroke-linejoin="round" />`);
          }
          break;
        }

        case 42: { // EMR_ELLIPSE
          flushPath();
          const left = view.getInt32(offset + 8, true);
          const top = view.getInt32(offset + 12, true);
          const right = view.getInt32(offset + 16, true);
          const bottom = view.getInt32(offset + 20, true);
          const cx = (left + right) / 2;
          const cy = (top + bottom) / 2;
          const rx = Math.abs(right - left) / 2;
          const ry = Math.abs(bottom - top) / 2;
          const strokeColor = currentPen.style === 5 ? 'none' : currentPen.color;
          const fillColor = currentBrush.style === 1 ? 'none' : currentBrush.color;
          svgElements.push(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" stroke="${strokeColor}" stroke-width="${Math.max(currentPen.width, 1)}" fill="${fillColor}" />`);
          break;
        }

        case 43: { // EMR_RECTANGLE
          flushPath();
          const left = view.getInt32(offset + 8, true);
          const top = view.getInt32(offset + 12, true);
          const right = view.getInt32(offset + 16, true);
          const bottom = view.getInt32(offset + 20, true);
          const rectW = Math.abs(right - left);
          const rectH = Math.abs(bottom - top);
          const strokeColor = currentPen.style === 5 ? 'none' : currentPen.color;
          const fillColor = currentBrush.style === 1 ? 'none' : currentBrush.color;
          svgElements.push(`<rect x="${Math.min(left, right)}" y="${Math.min(top, bottom)}" width="${rectW}" height="${rectH}" stroke="${strokeColor}" stroke-width="${Math.max(currentPen.width, 1)}" fill="${fillColor}" />`);
          break;
        }

        case 84: { // EMR_EXTTEXTOUTW
          flushPath();
          if (offset + 52 <= bytes.length) {
            const refX = view.getInt32(offset + 36, true);
            const refY = view.getInt32(offset + 40, true);
            const nChars = view.getUint32(offset + 44, true);
            const offString = view.getUint32(offset + 48, true);

            if (offString > 0 && nChars > 0 && offset + offString + nChars * 2 <= bytes.length) {
              let text = '';
              for (let c = 0; c < nChars * 2; c += 2) {
                text += String.fromCharCode(view.getUint16(offset + offString + c, true));
              }
              const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
              svgElements.push(`<text x="${refX}" y="${refY}" fill="${currentTextColor}" font-family="Arial, sans-serif" font-size="12">${escaped}</text>`);
            }
          }
          break;
        }
      }

      offset += size;
    }

    flushPath();

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" width="${width}" height="${height}" style="max-width: 100%; height: auto;">\n${svgElements.join('\n')}\n</svg>`;
  }
};
