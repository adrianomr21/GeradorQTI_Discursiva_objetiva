/**
 * latexHelper.js
 * Módulo responsável por renderizar fÓrmulas matemáticas em LaTeX (usando KaTeX),
 * gerenciar o modal interativo com paleta de símbolos e pré-visualização em tempo real,
 * e permitir inserção e reedição de fórmulas no Editor VYSIWYG.
 */

import { Logger } from '../logger.js';

export const LatexHelper = {
  modal: null,
  input: null,
  preview: null,
  displayCheckbox: null,
  btnInsert: null,
  targetMathElement: null,
  savedRange: null,
  editorInstance: null,

  /**
   * Inicializa o módulo de LaTeX e conecta os elementos da interface.
   * @param {Object} editorInstance - Referência do RichTextEditor
   */
  init(editorInstance = null) {
    this.editorInstance = editorInstance;
    this.modal = document.getElementById('modal-latex');
    this.input = document.getElementById('latex-code-input');
    this.preview = document.getElementById('latex-preview-container');
    this.displayCheckbox = document.getElementById('latex-display-mode');
    this.btnInsert = document.getElementById('btn-latex-insert');

    if (!this.modal || !this.input || !this.preview) {
      return;
    }

    this.bindEvents();
    Logger.info('Suporte a fÓrmulas matemáticas em LaTeX inicializado.');
  },

  /**
   * Obtém a instância global do KaTeX com fallback seguro.
   * @returns {Object|null}
   */
  getKatex() {
    if (typeof window !== 'undefined' && window.katex) return window.katex;
    if (typeof globalThis !== 'undefined' && globalThis.katex) return globalThis.katex;
    if (typeof global !== 'undefined' && global.katex) return global.katex;
    return null;
  },

  /**
   * Registra os eventos do modal, inputs e paleta de botões matemáticos.
   */
  bindEvents() {
    // 1. Atualização em tempo real da pré-visualização (Live Preview)
    this.input.addEventListener('input', () => this.updatePreview());
    if (this.displayCheckbox) {
      this.displayCheckbox.addEventListener('change', () => this.updatePreview());
    }

    // 2. Atalhos de Teclado no Textarea (Ctrl+Enter para inserir, Esc para fechar)
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.confirmInsertion();
      } else if (e.key === 'Escape') {
        this.closeModal();
      }
    });

    // 3. Botões de Ação do Modal
    if (this.btnInsert) {
      this.btnInsert.addEventListener('click', () => this.confirmInsertion());
    }


    const btnClose = document.getElementById('btn-latex-close');
    const btnCancel = document.getElementById('btn-latex-cancel');
    if (btnClose) btnClose.addEventListener('click', () => this.closeModal());
    if (btnCancel) btnCancel.addEventListener('click', () => this.closeModal());

    // 4. Fechar ao clicar fora do modal (overlay)
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.closeModal();
      }
    });

    // 5. Botões da Paleta de Símbolos e Templates Matemáticos
    const paletteButtons = document.querySelectorAll('.latex-palette-btn');
    paletteButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const snippet = btn.getAttribute('data-snippet') || btn.innerText;
        this.insertSnippetAtCursor(snippet);
      });
    });
  },

  /**
   * Insere um trecho/template de LaTeX na posição atual do cursor no textarea.
   * @param {string} snippet
   */
  insertSnippetAtCursor(snippet) {
    if (!this.input || !snippet) return;

    const startPos = this.input.selectionStart || 0;
    const endPos = this.input.selectionEnd || 0;
    const currentValue = this.input.value;

    const newValue = currentValue.substring(0, startPos) + snippet + currentValue.substring(endPos);
    this.input.value = newValue;

    // Posiciona o cursor após o snippet inserido (ou dentro de chaves se houver {})
    const cursorOffset = snippet.indexOf('{}') !== -1 ? snippet.indexOf('{}') + 1 : startPos + snippet.length;
    this.input.focus();
    this.input.setSelectionRange(cursorOffset, cursorOffset);

    this.updatePreview();
  },

  /**
   * Renderiza uma expressão LaTeX para HTML/MathML usando KaTeX.
   * @param {string} latex - Código LaTeX
   * @param {boolean} isDisplay - Modo em bloco (centralizado) ou inline
   * @returns {string} HTML renderizado
   */
  renderFormula(latex, isDisplay = false) {
    if (!latex || !latex.trim()) return '';

    const katex = this.getKatex();
    if (!katex) {
      return `<span class="math-fallback">${latex}</span>`;
    }

    try {
      return katex.renderToString(latex.trim(), {
        displayMode: isDisplay,
        output: 'htmlAndMathml',
        throwOnError: false
      });
    } catch (err) {
      console.warn('Erro ao renderizar fórmula com KaTeX:', err);
      return `<span class="katex-error" title="${err.message}">${latex}</span>`;
    }
  },

  /**
   * Atualiza a caixa de pré-visualização em tempo real.
   */
  updatePreview() {
    if (!this.preview || !this.input) return;

    const latex = this.input.value.trim();
    const isDisplay = this.displayCheckbox ? this.displayCheckbox.checked : false;

    if (!latex) {
      this.preview.innerHTML = '<span class="preview-placeholder">A pré-visualização da fórmula aparecerá rqui...</span>';
      return;
    }

    const rendered = this.renderFormula(latex, isDisplay);
    this.preview.innerHTML = rendered || '<span class="preview-placeholder">FÓrmula vazia</span>';
  },

  /**
   * Abre o modal de LaTeX para criar uma nova fórmula ou editar uma existente.
   * @param {HTMLElement|null} targetElement - Elemento .qti-math existente para edição
   */
  openModal(targetElement = null) {
    this.targetMathElement = targetElement;
    this.saveSelection();

    if (this.targetMathElement) {
      const originalLatex = this.targetMathElement.getAttribute('data-latex') || '';
      const isDisplay = this.targetMathElement.getAttribute('data-display') === 'true' ||
                        this.targetMathElement.classList.contains('qti-math-display');
      
      this.input.value = originalLatex;
      if (this.displayCheckbox) this.displayCheckbox.checked = isDisplay;

      const titleEl = document.getElementById('latex-modal-title');
      if (titleEl) titleEl.innerText = '✬️ Editar Fórmula Matemática (LaTeX)';
      if (this.btnInsert) this.btnInsert.innerText = 'Atualizar Fórmula';
    } else {
      this.input.value = '';
      if (this.displayCheckbox) this.displayCheckbox.checked = false;

      const titleEl = document.getElementById('latex-modal-title');
      if (titleEl) titleEl.innerText = '🧮 Inserir FÓrmula Matemática (LaTeX)';
      if (this.btnInsert) this.btnInsert.innerText = 'Inserir no Editor';
    }

    if (this.modal) {
      this.modal.classList.add('active');
      this.modal.style.display = 'flex';
    }

    this.updatePreview();
    setTimeout(() => {
      if (this.input) this.input.focus();
    }, 50);
  },

  /**
   * Fecha o modal de LaTeX e limpa referências temporárias.
   */
  closeModal() {
    if (this.modal) {
      this.modal.classList.remove('active');
      this.modal.style.display = 'none';
    }
    this.targetMathElement = null;
  },

  /**
   * Confirma a inserção ou atualização da fÓrmula no editor.
   */
  confirmInsertion() {
    const latex = this.input.value.trim();
    if (!latex) {
      alert('Por favor, digite o código LaTeX da fórmula ou selecione um modelo na paleta.');
      if (this.input) this.input.focus();
      return;
    }

    const isDisplay = this.displayCheckbox ? this.displayCheckbox.checked : false;
    const renderedHtml = this.renderFormula(latex, isDisplay);

    if (this.targetMathElement) {
      // 1. Atualiza elemento existente no editor
      this.targetMathElement.setAttribute('data-latex', latex);
      this.targetMathElement.setAttribute('data-display', isDisplay ? 'true' : 'false');
      if (isDisplay) {
        this.targetMathElement.classList.add('qti-math-display');
      } else {
        this.targetMathElement.classList.remove('qti-math-display');
      }
      this.targetMathElement.innerHTML = renderedHtml;
      Logger.success('Fórmula matemática atualizada.');
    } else {
      // 2. Insere novo elemento no editor
      const mathSpan = document.createElement('span');
      mathSpan.className = `qti-math${isDisplay ? ' qti-math-display' : ''}`;
      mathSpan.setAttribute('data-latex', latex);
      mathSpan.setAttribute('data-display', isDisplay ? 'true' : 'false');
      mathSpan.setAttribute('contenteditable', 'false');
      mathSpan.setAttribute('title', 'Clique duas vezes para editar a fórmula (LaTeX)');
      mathSpan.innerHTML = renderedHtml;

      this.restoreSelection();

      const editorEl = this.editorInstance?.editorElement || document.getElementById('editor-content');
      if (editorEl) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && editorEl.contains(sel.anchorNode)) {
          const range = sel.getRangeAt(0);
          range.deleteContents();
          range.insertNode(mathSpan);

          const spaceNode = document.createTextNode('\u00A0');
          range.setStartAfter(mathSpan);
          range.insertNode(spaceNode);
          range.setStartAfter(spaceNode);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        } else {
          editorEl.appendChild(mathSpan);
          editorEl.appendChild(document.createTextNode('\u00A0;'));
        }
      }
      Logger.success('Fórmula matemática inserida no editor.');
    }

    this.closeModal();

    if (this.editorInstance && typeof this.editorInstance.syncSourceFromEditor === 'function') {
      this.editorInstance.syncSourceFromEditor();
    }
  },

  saveSelection() {
    if (typeof window === 'undefined') return;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      this.savedRange = sel.getRangeAt(0).cloneRange();
    }
  },

  restoreSelection() {
    if (typeof window === 'undefined' || !this.savedRange) return;
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(this.savedRange);
    }
  }
};
