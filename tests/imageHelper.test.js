import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ImageHelper } from '../js/editor/imageHelper.js';
import { HtmlSanitizer } from '../js/editor/htmlSanitizer.js';
import { AssetManager } from '../js/editor/assetManager.js';

describe('ImageHelper & Dimension Preservation', () => {
  it('deve possuir métodos para ajuste de tamanho e alinhamento', () => {
    assert.strictEqual(typeof ImageHelper.setSize, 'function');
    assert.strictEqual(typeof ImageHelper.setAlignment, 'function');
    assert.strictEqual(typeof ImageHelper.deleteImage, 'function');
    assert.strictEqual(typeof ImageHelper.setSelectedImage, 'function');
  });

  it('deve preservar estilos de largura, altura e alinhamento em tags <img> ao higienizar', () => {
    const html = '<p><img src="foto.png" alt="Foto" style="width: 350px; height: auto; margin: 10px auto; display: block;" /></p>';
    const cleaned = HtmlSanitizer.cleanHtml(html);
    assert.ok(cleaned.includes('width: 350px'));
    assert.ok(cleaned.includes('height: auto'));
    assert.ok(cleaned.includes('display: block'));
  });

  it('deve preservar estilos de redimensionamento ao converter imagens base64 via AssetManager', () => {
    const base64Png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const htmlWithResizedImg = `<p><img src="data:image/png;base64,${base64Png}" alt="Gráfico" style="width: 50%; height: auto;" /></p>`;

    const result = AssetManager.processImages(htmlWithResizedImg, 1);
    assert.strictEqual(result.assets.length, 1);
    assert.ok(result.processedHtml.includes('src="../img_q1_1.png"'));
    assert.ok(result.processedHtml.includes('style="width: 50%; height: auto;"'));
  });
});
