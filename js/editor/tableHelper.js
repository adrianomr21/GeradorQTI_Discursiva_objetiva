/**
 * tableHelper.js
 * Módulo para manipulação de tabelas no editor de texto:
 * - Adicionar linha acima / abaixo
 * - Adicionar coluna à esquerda / direita
 * - Excluir linha atual
 * - Excluir coluna atual
 * - Excluir tabela inteira
 * - Converter tabela em imagem fixa
 */

import { Logger } from '../logger.js';

export const TableHelper = {
  /**
   * Encontra a célula (td/th) mais próxima a partir de um elemento ou seleção.
   * @param {Node|Element} node
   * @returns {HTMLTableCellElement|null}
   */
  getClosestCell(node) {
    if (!node) return null;
    if (node.nodeType === Node.TEXT_NODE) {
      node = node.parentElement;
    }
    return node ? node.closest('td, th') : null;
  },

  /**
   * Encontra a tabela mais próxima.
   * @param {Node|Element} node
   * @returns {HTMLTableElement|null}
   */
  getClosestTable(node) {
    if (!node) return null;
    if (node.nodeType === Node.TEXT_NODE) {
      node = node.parentElement;
    }
    return node ? node.closest('table') : null;
  },

  /**
   * Obtém a contagem de colunas de uma tabela.
   * @param {HTMLTableElement} table
   * @returns {number}
   */
  getTableColumnCount(table) {
    if (!table) return 0;
    const firstRow = table.querySelector('tr');
    return firstRow ? firstRow.children.length : 0;
  },

  /**
   * Adiciona uma nova linha acima da linha da célula selecionada.
   * @param {HTMLTableCellElement} cell
   * @returns {HTMLTableRowElement|null}
   */
  addRowAbove(cell) {
    if (!cell) return null;
    const row = cell.closest('tr');
    const table = cell.closest('table');
    if (!row || !table) return null;

    const colCount = row.children.length;
    const isHead = row.parentElement && row.parentElement.tagName.toLowerCase() === 'thead';
    const tag = isHead ? 'th' : 'td';

    const newRow = document.createElement('tr');
    for (let i = 0; i < colCount; i++) {
      const newCell = document.createElement(tag);
      newCell.style.border = '1px solid #cbd5e1';
      newCell.style.padding = '6px 10px';
      if (isHead) newCell.style.backgroundColor = '#f1f5f9';
      newCell.innerHTML = '&nbsp;';
      newRow.appendChild(newCell);
    }

    row.parentElement.insertBefore(newRow, row);
    return newRow;
  },

  /**
   * Adiciona uma nova linha abaixo da linha da célula selecionada.
   * @param {HTMLTableCellElement} cell
   * @returns {HTMLTableRowElement|null}
   */
  addRowBelow(cell) {
    if (!cell) return null;
    const row = cell.closest('tr');
    const table = cell.closest('table');
    if (!row || !table) return null;

    const colCount = row.children.length;
    const newRow = document.createElement('tr');

    for (let i = 0; i < colCount; i++) {
      const newCell = document.createElement('td');
      newCell.style.border = '1px solid #cbd5e1';
      newCell.style.padding = '6px 10px';
      newCell.innerHTML = '&nbsp;';
      newRow.appendChild(newCell);
    }

    // Se estiver no thead, insere no início do tbody (se existir)
    if (row.parentElement && row.parentElement.tagName.toLowerCase() === 'thead') {
      const tbody = table.querySelector('tbody');
      if (tbody) {
        tbody.insertBefore(newRow, tbody.firstChild);
      } else {
        row.insertAdjacentElement('afterend', newRow);
      }
    } else {
      row.insertAdjacentElement('afterend', newRow);
    }

    return newRow;
  },

  /**
   * Adiciona uma nova coluna à esquerda da coluna selecionada.
   * @param {HTMLTableCellElement} cell
   */
  addColumnLeft(cell) {
    if (!cell) return;
    const table = cell.closest('table');
    if (!table) return;

    const colIndex = cell.cellIndex;
    const rows = table.querySelectorAll('tr');

    rows.forEach(row => {
      const isHeader = row.parentElement && row.parentElement.tagName.toLowerCase() === 'thead';
      const newCell = document.createElement(isHeader ? 'th' : 'td');
      newCell.style.border = '1px solid #cbd5e1';
      newCell.style.padding = '6px 10px';
      if (isHeader) newCell.style.backgroundColor = '#f1f5f9';
      newCell.innerHTML = '&nbsp;';

      const targetCell = row.children[colIndex];
      if (targetCell) {
        row.insertBefore(newCell, targetCell);
      } else {
        row.appendChild(newCell);
      }
    });
  },

  /**
   * Adiciona uma nova coluna à direita da coluna selecionada.
   * @param {HTMLTableCellElement} cell
   */
  addColumnRight(cell) {
    if (!cell) return;
    const table = cell.closest('table');
    if (!table) return;

    const colIndex = cell.cellIndex;
    const rows = table.querySelectorAll('tr');

    rows.forEach(row => {
      const isHeader = row.parentElement && row.parentElement.tagName.toLowerCase() === 'thead';
      const newCell = document.createElement(isHeader ? 'th' : 'td');
      newCell.style.border = '1px solid #cbd5e1';
      newCell.style.padding = '6px 10px';
      if (isHeader) newCell.style.backgroundColor = '#f1f5f9';
      newCell.innerHTML = '&nbsp;';

      const targetCell = row.children[colIndex];
      if (targetCell) {
        targetCell.insertAdjacentElement('afterend', newCell);
      } else {
        row.appendChild(newCell);
      }
    });
  },

  /**
   * Exclui a linha atual. Se for a única linha da tabela, exclui a tabela.
   * @param {HTMLTableCellElement} cell
   */
  deleteRow(cell) {
    if (!cell) return;
    const row = cell.closest('tr');
    const table = cell.closest('table');
    if (!row || !table) return;

    const totalRows = table.querySelectorAll('tr').length;
    if (totalRows <= 1) {
      table.remove();
    } else {
      row.remove();
    }
  },

  /**
   * Exclui a coluna atual em todas as linhas. Se for a única coluna, exclui a tabela.
   * @param {HTMLTableCellElement} cell
   */
  deleteColumn(cell) {
    if (!cell) return;
    const table = cell.closest('table');
    if (!table) return;

    const colIndex = cell.cellIndex;
    const rows = table.querySelectorAll('tr');
    const totalCols = rows[0] ? rows[0].children.length : 0;

    if (totalCols <= 1) {
      table.remove();
      return;
    }

    rows.forEach(row => {
      if (row.children[colIndex]) {
        row.children[colIndex].remove();
      }
    });
  },

  /**
   * Exclui a tabela inteira.
   * @param {HTMLTableCellElement|HTMLTableElement} cellOrTable
   */
  deleteTable(cellOrTable) {
    if (!cellOrTable) return;
    const table = cellOrTable.tagName.toLowerCase() === 'table' ? cellOrTable : cellOrTable.closest('table');
    if (table) {
      table.remove();
    }
  },

  /**
   * Converte a tabela selecionada em imagem PNG (DataURL) preservando layout e dimensões exatas.
   * @param {HTMLTableCellElement|HTMLTableElement} cellOrTable
   * @returns {Promise<HTMLImageElement|null>}
   */
  async convertTableToImage(cellOrTable) {
    if (!cellOrTable) return null;
    const table = (cellOrTable.tagName && cellOrTable.tagName.toLowerCase() === 'table')
      ? cellOrTable
      : (typeof cellOrTable.closest === 'function' ? cellOrTable.closest('table') : null);
    if (!table) return null;

    try {
      // Remove foco e seleções de texto para não capturar cursor ou realces visuais
      if (typeof window !== 'undefined') {
        window.getSelection()?.removeAllRanges();
      }
      if (typeof document !== 'undefined' && document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }

      // Largura exata renderizada na tela
      const rect = table.getBoundingClientRect ? table.getBoundingClientRect() : { width: table.offsetWidth || 500 };
      const tableWidth = Math.round(rect.width || table.offsetWidth || 500);

      let dataUrl = null;
      if (typeof window !== 'undefined' && typeof window.html2canvas === 'function') {
        const canvas = await window.html2canvas(table, {
          scale: 2, // Resolução 2x para nitidez cristalina
          backgroundColor: '#ffffff',
          logging: false,
          useCORS: true
        });
        dataUrl = canvas.toDataURL('image/png');
      } else {
        dataUrl = await this.tableToImageNative(table);
      }

      if (!dataUrl) {
        throw new Error('Falha ao gerar o Data URL da imagem.');
      }

      if (typeof document !== 'undefined') {
        const img = document.createElement('img');
        img.src = dataUrl;
        img.alt = 'Tabela da questão';
        img.style.maxWidth = '100%';
        img.style.width = `${tableWidth}px`;
        img.style.height = 'auto';
        img.style.margin = '10px 0';
        img.style.display = 'block';
        img.style.borderRadius = '4px';

        if (table.parentNode) {
          table.parentNode.replaceChild(img, table);
        }
        return img;
      }

      return null;
    } catch (err) {
      if (typeof Logger !== 'undefined') {
        Logger.error(`Erro ao converter tabela em imagem: ${err.message}`);
      }
      return null;
    }
  },

  /**
   * Fallback nativo usando SVG foreignObject e Canvas caso html2canvas não esteja disponível.
   * @param {HTMLTableElement} table
   * @returns {Promise<string>}
   */
  async tableToImageNative(table) {
    if (typeof window === 'undefined' || typeof document === 'undefined') return '';
    const rect = table.getBoundingClientRect ? table.getBoundingClientRect() : { width: 500, height: 150 };
    const width = Math.max(Math.round(rect.width || table.offsetWidth || 500), 200);
    const height = Math.max(Math.round(rect.height || table.offsetHeight || 150), 50);

    const cloned = table.cloneNode(true);
    cloned.style.borderCollapse = 'collapse';
    cloned.style.backgroundColor = '#ffffff';
    cloned.style.width = '100%';
    cloned.style.margin = '0';

    const serialized = new XMLSerializer().serializeToString(cloned);
    const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml" style="background:#ffffff; font-family: Inter, system-ui, -apple-system, sans-serif; font-size: 14px; color: #1e293b; padding: 4px;">
          ${serialized}
        </div>
      </foreignObject>
    </svg>`;

    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = 2;
        const canvas = document.createElement('canvas');
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = (err) => {
        URL.revokeObjectURL(url);
        reject(err);
      };
      img.src = url;
    });
  }
};
