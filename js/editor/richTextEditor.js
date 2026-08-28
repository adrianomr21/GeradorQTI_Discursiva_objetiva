import { Logger } from '../logger.js';
import { HtmlSanitizer } from './htmlSanitizer.js';
import { AssetManager } from './assetManager.js';
import { TableHelper } from './tableHelper.js';
import { ImageHelper } from './imageHelper.js';

export const RichTextEditor = {
  editorElement: null,
  sourceElement: null,
  imageInput: null,
  tableToolbar: null,
  imageToolbar: null,
  activeCell: null,
  isSourceMode: false,

  /**
   * Inicializa o editor associando os elementos do DOM e ouvintes de eventos.
   * @param {Object} config - IDs dos elementos DOM
   */
  init(config = {}) {
    this.editorElement = document.getElementById(config.editorId || 'editor-content');
    this.sourceElement = document.getElementById(config.sourceId || 'editor-source');
    this.imageInput = document.getElementById(config.imageInputId || 'editor-image-input');
    this.tableToolbar = document.getElementById('table-floating-toolbar');
    this.imageToolbar = document.getElementById('image-floating-toolbar');

    if (!this.editorElement) {
      console.warn('Elemento do editor não encontrado.');
      return;
    }

    this.bindEvents();
    this.bindContextualToolbars();
    Logger.info('Editor de Texto Rico inicializado com suporte a mídias e tabelas.');
  },

  /**
   * Registra os eventos de paste, drag & drop, atalhos e seleção.
   */
  bindEvents() {
    // 1. Suporte a Colar Imagens da Área de Transferência (Ctrl + V)
    this.editorElement.addEventListener('paste', async (e) => {
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      let hasImage = false;

      for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
          hasImage = true;
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            await this.insertImageFile(file);
            Logger.success('Imagem colada diretamente da área de transferência.');
          }
        }
      }

      if (!hasImage) {
        // Se for texto/HTML colado do Word/Docs, executa limpeza automática leve
        setTimeout(() => {
          this.editorElement.innerHTML = HtmlSanitizer.cleanHtml(this.editorElement.innerHTML);
        }, 10);
      }
    });

    // 2. Suporte a Arrastar e Soltar Imagens (Drag & Drop)
    this.editorElement.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.editorElement.classList.add('drag-over');
    });

    this.editorElement.addEventListener('dragleave', () => {
      this.editorElement.classList.remove('drag-over');
    });

    this.editorElement.addEventListener('drop', async (e) => {
      e.preventDefault();
      this.editorElement.classList.remove('drag-over');

      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        for (const file of e.dataTransfer.files) {
          if (file.type.startsWith('image/')) {
            await this.insertImageFile(file);
            Logger.success(`Imagem "${file.name}" inserida por arrastar e soltar.`);
          }
        }
      }
    });

    // 3. Ouvinte do Input de Arquivo de Imagem
    if (this.imageInput) {
      this.imageInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
          await this.insertImageFile(file);
          Logger.success(`Imagem "${file.name}" carregada no editor.`);
          this.imageInput.value = ''; // Reseta input
        }
      });
    }

    // 4. Sincronização ao digitar no modo código fonte
    if (this.sourceElement) {
      this.sourceElement.addEventListener('input', () => {
        this.editorElement.innerHTML = this.sourceElement.value;
      });
    }

    // 5. Monitoramento de clique para ativação das barras contextuais
    this.editorElement.addEventListener('click', (e) => {
      this.handleEditorClick(e);
    });

    this.editorElement.addEventListener('keyup', (e) => {
      this.handleEditorSelection();
    });

    // Fecha barras contextuais ao clicar fora do container do editor
    document.addEventListener('click', (e) => {
      const isInside = e.target.closest('.editor-container');
      if (!isInside) {
        this.hideContextToolbars();
      }
    });
  },

  /**
   * Monitora cliques no editor para abrir barra de tabela ou de imagem.
   */
  handleEditorClick(e) {
    const target = e.target;

    // Caso 1: Clicou em uma Imagem
    if (target.tagName && target.tagName.toLowerCase() === 'img') {
      ImageHelper.setSelectedImage(target);
      this.showImageToolbar();
      this.hideTableToolbar();
      return;
    } else {
      ImageHelper.setSelectedImage(null);
      this.hideImageToolbar();
    }

    // Caso 2: Clicou dentro de uma Tabela
    const cell = TableHelper.getClosestCell(target);
    if (cell) {
      this.activeCell = cell;
      this.showTableToolbar();
      this.hideImageToolbar();
      return;
    } else {
      this.activeCell = null;
      this.hideTableToolbar();
    }
  },

  /**
   * Monitora mudanças de seleção via teclado para detectar tabela.
   */
  handleEditorSelection() {
    const sel = window.getSelection();
    if (!sel || !sel.anchorNode) return;

    const cell = TableHelper.getClosestCell(sel.anchorNode);
    if (cell) {
      this.activeCell = cell;
      this.showTableToolbar();
    } else {
      this.activeCell = null;
      this.hideTableToolbar();
    }
  },

  /**
   * Conecta as ações dos botões das barras contextuais.
   */
  bindContextualToolbars() {
    // --- Ações de Tabela ---
    document.getElementById('btn-tbl-add-row-above')?.addEventListener('click', () => {
      if (this.activeCell) {
        TableHelper.addRowAbove(this.activeCell);
        Logger.info('Linha adicionada acima.');
      }
    });

    document.getElementById('btn-tbl-add-row-below')?.addEventListener('click', () => {
      if (this.activeCell) {
        TableHelper.addRowBelow(this.activeCell);
        Logger.info('Linha adicionada abaixo.');
      }
    });

    document.getElementById('btn-tbl-add-col-left')?.addEventListener('click', () => {
      if (this.activeCell) {
        TableHelper.addColumnLeft(this.activeCell);
        Logger.info('Coluna adicionada à esquerda.');
      }
    });

    document.getElementById('btn-tbl-add-col-right')?.addEventListener('click', () => {
      if (this.activeCell) {
        TableHelper.addColumnRight(this.activeCell);
        Logger.info('Coluna adicionada à direita.');
      }
    });

    document.getElementById('btn-tbl-del-row')?.addEventListener('click', () => {
      if (this.activeCell) {
        TableHelper.deleteRow(this.activeCell);
        this.hideTableToolbar();
        Logger.info('Linha excluída.');
      }
    });

    document.getElementById('btn-tbl-del-col')?.addEventListener('click', () => {
      if (this.activeCell) {
        TableHelper.deleteColumn(this.activeCell);
        this.hideTableToolbar();
        Logger.info('Coluna excluída.');
      }
    });

    document.getElementById('btn-tbl-del-table')?.addEventListener('click', () => {
      if (this.activeCell) {
        TableHelper.deleteTable(this.activeCell);
        this.hideTableToolbar();
        Logger.info('Tabela excluída.');
      }
    });

    // --- Ações de Imagem ---
    document.getElementById('btn-img-size-25')?.addEventListener('click', () => {
      ImageHelper.setSize('25%');
      Logger.info('Tamanho da imagem ajustado para 25%.');
    });

    document.getElementById('btn-img-size-50')?.addEventListener('click', () => {
      ImageHelper.setSize('50%');
      Logger.info('Tamanho da imagem ajustado para 50%.');
    });

    document.getElementById('btn-img-size-75')?.addEventListener('click', () => {
      ImageHelper.setSize('75%');
      Logger.info('Tamanho da imagem ajustado para 75%.');
    });

    document.getElementById('btn-img-size-100')?.addEventListener('click', () => {
      ImageHelper.setSize('100%');
      Logger.info('Tamanho da imagem ajustado para 100%.');
    });

    document.getElementById('btn-img-size-custom')?.addEventListener('click', () => {
      ImageHelper.promptCustomSize();
    });

    document.getElementById('btn-img-align-left')?.addEventListener('click', () => {
      ImageHelper.setAlignment('left');
      Logger.info('Imagem alinhada à esquerda.');
    });

    document.getElementById('btn-img-align-center')?.addEventListener('click', () => {
      ImageHelper.setAlignment('center');
      Logger.info('Imagem centralizada.');
    });

    document.getElementById('btn-img-align-right')?.addEventListener('click', () => {
      ImageHelper.setAlignment('right');
      Logger.info('Imagem alinhada à direita.');
    });

    document.getElementById('btn-img-delete')?.addEventListener('click', () => {
      ImageHelper.deleteImage();
      this.hideImageToolbar();
      Logger.info('Imagem removida.');
    });
  },

  showTableToolbar() {
    if (this.tableToolbar) this.tableToolbar.style.display = 'flex';
  },

  hideTableToolbar() {
    if (this.tableToolbar) this.tableToolbar.style.display = 'none';
  },

  showImageToolbar() {
    if (this.imageToolbar) this.imageToolbar.style.display = 'flex';
  },

  hideImageToolbar() {
    if (this.imageToolbar) this.imageToolbar.style.display = 'none';
  },

  hideContextToolbars() {
    this.hideTableToolbar();
    this.hideImageToolbar();
    ImageHelper.setSelectedImage(null);
    this.activeCell = null;
  },

  /**
   * Executa comandos de formatação no editor (bold, italic, etc.)
   * @param {string} command - Nome do comando execCommand
   * @param {string|null} value - Valor opcional do comando
   */
  execCmd(command, value = null) {
    if (this.isSourceMode) {
      Logger.warn('Alterne para o modo visual para usar as ferramentas de formatação.');
      return;
    }
    this.editorElement.focus();
    document.execCommand(command, false, value);
  },

  /**
   * Insere um link no texto selecionado.
   */
  insertLink() {
    if (this.isSourceMode) return;
    const url = prompt('Digite a URL do link (ex: https://exemplo.com):');
    if (url && url.trim()) {
      this.execCmd('createLink', url.trim());
      Logger.info(`Link inserido: ${url}`);
    }
  },

  /**
   * Insere uma tabela estruturada no editor.
   * @param {number} rows - Número de linhas
   * @param {number} cols - Número de colunas
   */
  insertTable(rows = 3, cols = 3) {
    if (this.isSourceMode) return;

    let tableHtml = '<table class="qti-table" border="1" style="border-collapse: collapse; width: 100%; margin: 10px 0;">\n<thead>\n<tr>';
    for (let c = 1; c <= cols; c++) {
      tableHtml += `<th style="border: 1px solid #cbd5e1; padding: 6px 10px; background-color: #f1f5f9;">Coluna ${c}</th>`;
    }
    tableHtml += '</tr>\n</thead>\n<tbody>\n';

    for (let r = 1; r <= rows; r++) {
      tableHtml += '<tr>';
      for (let c = 1; c <= cols; c++) {
        tableHtml += `<td style="border: 1px solid #cbd5e1; padding: 6px 10px;">Dado ${r}.${c}</td>`;
      }
      tableHtml += '</tr>\n';
    }
    tableHtml += '</tbody>\n</table><p><br /></p>';

    this.insertHtmlAtCursor(tableHtml);
    Logger.success(`Tabela (${rows}x${cols}) inserida. Clique nas células para adicionar ou excluir linhas e colunas.`);
  },

  /**
   * Dispara o seletor de arquivo para upload de imagem.
   */
  triggerImageUpload() {
    if (this.imageInput) {
      this.imageInput.click();
    }
  },

  /**
   * Converte um arquivo de imagem em DataURL e insere como tag <img> com tamanho inicial equilibrado.
   * @param {File} file
   */
  async insertImageFile(file) {
    try {
      const dataUrl = await AssetManager.fileToDataUrl(file);
      const imgHtml = `<img src="${dataUrl}" alt="${file.name || 'Imagem da questão'}" style="max-width: 100%; width: 420px; height: auto; margin: 8px 0; border-radius: 4px; display: block;" />`;
      this.insertHtmlAtCursor(imgHtml);
      Logger.info('Imagem inserida com largura padrão de 420px. Clique nela para redimensionar ou alinhar.');
    } catch (err) {
      Logger.error(`Erro ao carregar imagem: ${err.message}`);
    }
  },

  /**
   * Insere HTML arbitrário na posição atual do cursor no editor contenteditable.
   * @param {string} html
   */
  insertHtmlAtCursor(html) {
    this.editorElement.focus();
    const sel = window.getSelection();
    if (sel.getRangeAt && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      
      const el = document.createElement('div');
      el.innerHTML = html;
      const frag = document.createDocumentFragment();
      let node;
      let lastNode;
      while ((node = el.firstChild)) {
        lastNode = frag.appendChild(node);
      }
      range.insertNode(frag);
      
      if (lastNode) {
        range.setStartAfter(lastNode);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } else {
      this.editorElement.innerHTML += html;
    }
  },

  /**
   * Limpa formatações indesejadas mantendo apenas o HTML semântico limpo.
   */
  clearFormatting() {
    const raw = this.getHtml();
    const cleaned = HtmlSanitizer.cleanHtml(raw);
    this.setHtml(cleaned);
    Logger.success('Formatação limpa e tags semânticas preservadas.');
  },

  /**
   * Alterna entre visualização Visual WYSIWYG e Código Fonte HTML.
   */
  toggleSourceMode() {
    this.isSourceMode = !this.isSourceMode;
    const btnSource = document.getElementById('btn-tool-source');

    if (this.isSourceMode) {
      this.hideContextToolbars();
      this.sourceElement.value = this.editorElement.innerHTML;
      this.editorElement.style.display = 'none';
      this.sourceElement.style.display = 'block';
      this.sourceElement.focus();
      if (btnSource) btnSource.classList.add('active');
      Logger.info('Modo de edição: Código Fonte (HTML).');
    } else {
      this.editorElement.innerHTML = this.sourceElement.value;
      this.sourceElement.style.display = 'none';
      this.editorElement.style.display = 'block';
      this.editorElement.focus();
      if (btnSource) btnSource.classList.remove('active');
      Logger.info('Modo de edição: Visual (WYSIWYG).');
    }
  },

  /**
   * Retorna o HTML atual do editor.
   * @returns {string}
   */
  getHtml() {
    if (this.isSourceMode && this.sourceElement) {
      return this.sourceElement.value;
    }
    return this.editorElement ? this.editorElement.innerHTML : '';
  },

  /**
   * Define o HTML do editor.
   * @param {string} html
   */
  setHtml(html) {
    if (this.editorElement) this.editorElement.innerHTML = html;
    if (this.sourceElement) this.sourceElement.value = html;
  },

  /**
   * Limpa o conteúdo do editor.
   */
  clear() {
    this.setHtml('');
    this.hideContextToolbars();
    if (this.editorElement) this.editorElement.focus();
  }
};
