/**
 * tableHelper.js
 * Módulo para manipulação de tabelas no editor de texto:
 * - Adicionar linha acima / abaixo
 * - Adicionar coluna à esquerda / direita
 * - Excluir linha atual
 * - Excluir coluna atual
 * - Excluir tabela inteira
 */

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
  }
};
