/**
 * assetManager.js
 * Módulo responsável por gerenciar mídias/imagens inseridas no editor de questões:
 * - Extrai imagens em base64 (data URLs) do HTML.
 * - Converte em arquivos individuais para o pacote .zip.
 * - Ajusta os caminhos relativos (src="../imagem.png") para conformidade com QTI 2.1.
 * - Fornece os identificadores de recursos e dependências para o imsmanifest.xml.
 */

export const AssetManager = {
  /**
   * Processa o HTML de uma questão, extraindo imagens em base64 e substituindo por caminhos relativos.
   * @param {string} html - HTML da questão
   * @param {number} questionIndex - Índice sequencial da questão
   * @returns {{ processedHtml: string, assets: Array<{ identifier: string, filename: string, data: Uint8Array, mimeType: string }> }}
   */
  processImages(html, questionIndex = 1) {
    if (!html) return { processedHtml: '', assets: [] };

    const assets = [];
    let imageCounter = 1;

    // Expressão regular para encontrar tags <img src="data:image/...;base64,...">
    const dataUriRegex = /<img\s+([^>]*?)src=["'](data:image\/([a-zA-Z0-9\+\-]+);base64,([^"']+))["']([^>]*?)\/?>/gi;

    const processedHtml = html.replace(dataUriRegex, (match, prefix, fullDataUri, imageType, base64Data, suffix) => {
      // Determina a extensão do arquivo
      let ext = imageType.toLowerCase();
      if (ext === 'jpeg') ext = 'jpg';
      if (ext === 'svg+xml') ext = 'svg';

      const filename = `img_q${questionIndex}_${imageCounter}.${ext}`;
      const identifier = `ccres_${String(questionIndex).padStart(3, '0')}_${String(imageCounter).padStart(2, '0')}`;
      imageCounter++;

      // Converte Base64 para Uint8Array
      const binaryData = this.base64ToUint8Array(base64Data);

      assets.push({
        identifier: identifier,
        filename: filename,
        data: binaryData,
        mimeType: `image/${imageType}`
      });

      // No XML dentro da pasta qti21/, o caminho relativo para a imagem na raiz do ZIP é ../filename
      return `<img ${prefix}src="../${filename}" ${suffix} />`.replace(/\s+/g, ' ');
    });

    return {
      processedHtml: processedHtml,
      assets: assets
    };
  },

  /**
   * Converte uma string Base64 em um Uint8Array (compatível tanto no navegador quanto em Node).
   * @param {string} base64 - Dados em base64 puro
   * @returns {Uint8Array}
   */
  base64ToUint8Array(base64) {
    if (typeof atob === 'function') {
      const binaryString = atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    } else {
      // Ambiente Node.js (testes)
      return new Uint8Array(Buffer.from(base64, 'base64'));
    }
  },

  /**
   * Converte um objeto File ou Blob do navegador em uma string Data URL (Base64).
   * @param {File|Blob} file
   * @returns {Promise<string>}
   */
  fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }
};
