/**
 * linkHelper.js
 * Módulo responsável por gerenciar a inserção, edição, configuração de abertura
 * em nova janela (target="_blank") e remoção de hiperlinks no Editor de Texto Rico.
 */

import { Logger } from '../logger.js';
import { HtmlSanitizer } from './htmlSanitizer.js';

export const LinkHelper = {
  editor: null,
  modal: null,
  floatingToolbar: null,
  textInput: null,
  urlInput: null,
  targetBlankCheckbox: null,
  currentLink: null,
  savedRange: null,

  /**
   * Inicializa o módulo LinkHelper e registra os ouvintes de eventos.
   * @param {Object} editorInstance - Instância do RichTextEditor
   */
  init(editorInstance) {
    this.editor = editorInstance;
    if (typeof document === 'undefined') return;

    this.modal = document.getElementById('modal-link');
    this.floatingToolbar = document.getElementById('link-floating-toolbar');
    this.textInput = document.getElementById('link-text-input');
    this.urlInput = document.getElementById('link-url-input');
    this.targetBlankCheckbox = document.getElementById('link-target-blank');

    this.bindModalEvents();
    this.bindFloatingToolbarEvents();
  },

  /**
   * Conecta os eventos do modal de inserção/edição de link.
   */
  bindModalEvents() {
    if (!this.modal) return;

    document.getElementById('btn-link-close')?.addEventListener('click', () => this.closeModal());
    document.getElementById('btn-link-cancel')?.addEventListener('click', () => this.closeModal());
    document.getElementById('btn-link-insert')?.addEventListener('click', () => this.applyLink());
    document.getElementById('btn-link-remove')?.addEventListener('click', () => {
      this.removeLink(this.currentLink);
      this.closeModal();
    });

    // Tecla Enter no input de URL ou texto aplica o link
    const handleKeyEnter = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.applyLink();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.closeModal();
      }
    };

    this.urlInput?.addEventListener('keydown', handleKeyEnter);
    this.textInput?.addEventListener('keydown', handleKeyEnter);

    // Fecha ao clicar fora do card do modal
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.closeModal();
      }
    });
  },

  /**
   * Conecta os botões da barra flutuante contextual de link.
   */
  bindFloatingToolbarEvents() {
    if (!this.floatingToolbar) return;

    document.getElementById('btn-link-float-edit')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.currentLink) {
        this.openModal(this.currentLink);
      }
    });

    document.getElementById('btn-link-float-open')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.currentLink && this.currentLink.href) {
        window.open(this.currentLink.href, '_blank', 'noopener,noreferrer');
      }
    });

    document.getElementById('btn-link-float-remove')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.currentLink) {
        this.removeLink(this.currentLink);
        this.hideFloatingToolbar();
      }
    });
  },

  /**
   * Captura e salva o range da seleção atual.
   */
  saveSelection() {
    if (typeof window === 'undefined') return;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      this.savedRange = sel.getRangeAt(0).cloneRange();
    } else {
      this.savedRange = null;
    }
  },

  /**
   * Restaura o range da seleção salva no editor.
   */
  restoreSelection() {
    if (typeof window === 'undefined' || !this.savedRange) return;
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(this.savedRange);
    }
  },

  /**
   * Localiza o elemento <a> mais próximo da seleção ou nó fornecido.
   * @param {Node} node
   * @returns {HTMLAnchorElement|null}
   */
  getClosestLink(node) {
    if (!node) return null;
    if (node.nodeType === 1 && node.tagName && node.tagName.toLowerCase() === 'a') {
      return node;
    }
    return node.parentElement ? node.parentElement.closest('a') : null;
  },

  /**
   * Abre o modal para criar ou editar um link.
   * @param {HTMLAnchorElement|null} targetLink - Link existente a ser editado
   */
  openModal(targetLink = null) {
    if (typeof document === 'undefined') return;
    this.hideFloatingToolbar();

    let linkEl = targetLink;
    if (!linkEl) {
      this.saveSelection();
      const sel = window.getSelection();
      if (sel && sel.anchorNode) {
        linkEl = this.getClosestLink(sel.anchorNode);
      }
    }

    this.currentLink = linkEl;

    const modalTitle = document.getElementById('link-modal-title');
    const btnInsert = document.getElementById('btn-link-insert');
    const btnRemove = document.getElementById('btn-link-remove');

    if (this.currentLink) {
      // MODO EDIÇÃO
      if (modalTitle) modalTitle.textContent = '✏️ Editar Hiperlink';
      if (btnInsert) btnInsert.textContent = 'Salvar Alterações';
      if (btnRemove) btnRemove.style.display = 'inline-flex';

      if (this.textInput) this.textInput.value = this.currentLink.textContent || '';
      if (this.urlInput) this.urlInput.value = this.currentLink.getAttribute('href') || '';
      if (this.targetBlankCheckbox) {
        const target = this.currentLink.getAttribute('target');
        // Se tem target="_blank" ou não foi definido explicitamente como _self, default é true
        this.targetBlankCheckbox.checked = target !== '_self';
      }
    } else {
      // MODO INSERÇÃO
      if (modalTitle) modalTitle.textContent = '🔗 Inserir Hiperlink';
      if (btnInsert) btnInsert.textContent = 'Inserir Link';
      if (btnRemove) btnRemove.style.display = 'none';

      let selectedText = '';
      if (this.savedRange) {
        selectedText = this.savedRange.toString().trim();
      }

      if (this.textInput) this.textInput.value = selectedText;
      if (this.urlInput) this.urlInput.value = '';
      if (this.targetBlankCheckbox) this.targetBlankCheckbox.checked = true; // Padrão: abrir em nova janela
    }

    if (this.modal) {
      this.modal.style.display = 'flex';
    }

    // Foca no campo mais apropriado
    setTimeout(() => {
      if (this.textInput && this.textInput.value) {
        this.urlInput?.focus();
      } else {
        this.textInput?.focus();
      }
    }, 50);
  },

  /**
   * Fecha o modal de link e reseta o estado.
   */
  closeModal() {
    if (this.modal) {
      this.modal.style.display = 'none';
    }
    this.currentLink = null;
    this.savedRange = null;
  },

  /**
   * Formata e valida a URL do link.
   * @param {string} url
   * @returns {string} URL normalizada
   */
  normalizeUrl(url) {
    if (!url) return '';
    let trimmed = url.trim();
    if (!trimmed) return '';

    // Se não tiver esquema conhecido nem âncora interna, adiciona https://
    if (!/^(https?:\/\/|mailto:|tel:|ftp:\/\/|#|\/)/i.test(trimmed)) {
      trimmed = `https://${trimmed}`;
    }
    return trimmed;
  },

  /**
   * Aplica a inserção ou edição do link no editor.
   */
  applyLink() {
    const rawUrl = this.urlInput ? this.urlInput.value : '';
    const text = this.textInput ? this.textInput.value.trim() : '';
    const isTargetBlank = this.targetBlankCheckbox ? this.targetBlankCheckbox.checked : true;

    const url = this.normalizeUrl(rawUrl);

    if (!url) {
      if (this.currentLink) {
        this.removeLink(this.currentLink);
        this.closeModal();
      } else {
        Logger.warn('Por favor, informe a URL de destino do link.');
      }
      return;
    }

    if (this.currentLink) {
      // 1. Atualiza Link Existente
      this.currentLink.setAttribute('href', url);
      if (text && text !== this.currentLink.textContent) {
        this.currentLink.textContent = text;
      }
      if (isTargetBlank) {
        this.currentLink.setAttribute('target', '_blank');
        this.currentLink.setAttribute('rel', 'noopener noreferrer');
      } else {
        this.currentLink.removeAttribute('target');
        this.currentLink.removeAttribute('rel');
      }

      Logger.success(`Link atualizado para "${url}" (${isTargetBlank ? 'Abre em nova janela' : 'Mesma janela'}).`);
      this.closeModal();
      this.editor?.editorElement?.focus();
      return;
    }

    // 2. Insere Novo Link
    this.restoreSelection();
    const displayText = text || url;

    const linkHtml = `<a href="${url}" ${isTargetBlank ? 'target="_blank" rel="noopener noreferrer"' : ''}>${displayText}</a>`;

    if (this.savedRange && !this.savedRange.collapsed && (!text || text === this.savedRange.toString())) {
      // Envolve a seleção existente
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = linkHtml;
        const newLink = tempDiv.firstElementChild;
        range.insertNode(newLink);
        
        // Coloca cursor após o link
        range.setStartAfter(newLink);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } else {
      // Insere no ponto do cursor
      this.editor?.insertHtmlAtCursor(linkHtml);
    }

    Logger.success(`Link inserido: "${url}" (${isTargetBlank ? 'Abre em nova janela' : 'Mesma janela'}).`);
    this.closeModal();
    this.editor?.editorElement?.focus();
  },

  /**
   * Remove o link (desfaz a tag <a> mantendo o texto interno).
   * @param {HTMLAnchorElement|null} targetLink
   */
  removeLink(targetLink = null) {
    let linkEl = targetLink || this.currentLink;
    
    if (!linkEl && typeof window !== 'undefined') {
      const sel = window.getSelection();
      if (sel && sel.anchorNode) {
        linkEl = this.getClosestLink(sel.anchorNode);
      }
    }

    if (linkEl && linkEl.parentNode) {
      const parent = linkEl.parentNode;
      const children = Array.from(linkEl.childNodes || []);
      if (children.length > 0) {
        for (const child of children) {
          parent.insertBefore(child, linkEl);
        }
      } else if (linkEl.firstChild) {
        parent.insertBefore(linkEl.firstChild, linkEl);
      }
      parent.removeChild(linkEl);
      Logger.info('Link removido mantendo o texto original.');
      this.hideFloatingToolbar();
      this.editor?.editorElement?.focus();
      return;
    }

    // Fallback: comando nativo unlink
    if (typeof document !== 'undefined') {
      document.execCommand('unlink', false, null);
      Logger.info('Link removido da seleção.');
      this.hideFloatingToolbar();
    }
  },

  /**
   * Exibe a barra de ferramentas flutuante sobre o link selecionado/clicado.
   * @param {HTMLAnchorElement} linkElement
   */
  showFloatingToolbar(linkElement) {
    if (!this.floatingToolbar || !linkElement) return;
    this.currentLink = linkElement;

    const urlDisplay = document.getElementById('link-float-url');
    if (urlDisplay) {
      const href = linkElement.getAttribute('href') || '';
      urlDisplay.textContent = href.length > 40 ? href.substring(0, 37) + '...' : href;
      urlDisplay.title = href;
    }

    this.floatingToolbar.style.display = 'flex';
  },

  /**
   * Oculta a barra de ferramentas flutuante de link.
   */
  hideFloatingToolbar() {
    if (this.floatingToolbar) {
      this.floatingToolbar.style.display = 'none';
    }
  }
};
