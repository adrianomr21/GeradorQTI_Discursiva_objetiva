/**
 * imageHelper.js
 * Módulo para redimensionamento e alinhamento de imagens no editor de texto.
 */

export const ImageHelper = {
  currentImage: null,

  /**
   * Define a imagem ativa selecionada.
   * @param {HTMLImageElement|null} img
   */
  setSelectedImage(img) {
    // Remove borda da imagem anterior
    if (this.currentImage && this.currentImage !== img) {
      this.currentImage.classList.remove('img-selected');
    }

    this.currentImage = img;

    if (this.currentImage) {
      this.currentImage.classList.add('img-selected');
    }
  },

  /**
   * Aplica largura predefinida (percentual ou pixels) à imagem ativa.
   * @param {string} widthValue - Ex: '25%', '50%', '75%', '100%', '300px'
   */
  setSize(widthValue) {
    if (!this.currentImage) return;

    this.currentImage.style.width = widthValue;
    this.currentImage.style.height = 'auto';
    this.currentImage.style.maxWidth = '100%';
    this.currentImage.setAttribute('width', widthValue);
  },

  /**
   * Abre um prompt para o usuário digitar um tamanho exato em pixels.
   */
  promptCustomSize() {
    if (!this.currentImage) return;
    const currentW = this.currentImage.offsetWidth || 300;
    const input = prompt('Digite a largura desejada em pixels (ex: 350):', currentW);
    if (input) {
      const num = parseInt(input.replace(/[^0-9]/g, ''), 10);
      if (!isNaN(num) && num > 20) {
        this.setSize(`${num}px`);
      }
    }
  },

  /**
   * Define o alinhamento da imagem.
   * @param {'left'|'center'|'right'} alignment
   */
  setAlignment(alignment) {
    if (!this.currentImage) return;

    this.currentImage.style.maxWidth = '100%';

    if (alignment === 'center') {
      this.currentImage.style.display = 'block';
      this.currentImage.style.margin = '10px auto';
      this.currentImage.style.float = 'none';
    } else if (alignment === 'left') {
      this.currentImage.style.display = 'inline-block';
      this.currentImage.style.margin = '10px 14px 10px 0';
      this.currentImage.style.float = 'left';
    } else if (alignment === 'right') {
      this.currentImage.style.display = 'inline-block';
      this.currentImage.style.margin = '10px 0 10px 14px';
      this.currentImage.style.float = 'right';
    }
  },

  /**
   * Remove a imagem ativa do editor.
   */
  deleteImage() {
    if (!this.currentImage) return;
    this.currentImage.remove();
    this.currentImage = null;
  }
};
