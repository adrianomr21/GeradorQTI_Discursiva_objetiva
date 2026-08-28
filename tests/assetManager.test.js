import { describe, it } from 'node:test';
import assert from 'node:assert';
import { AssetManager } from '../js/editor/assetManager.js';

describe('AssetManager Module', () => {
  it('deve extrair imagens em base64 do HTML e substituir por caminho relativo QTI', () => {
    // 1x1 pixel PNG em base64
    const base64Png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const htmlWithImage = `<p>Observe o gráfico:</p><p><img src="data:image/png;base64,${base64Png}" alt="Gráfico" /></p>`;

    const result = AssetManager.processImages(htmlWithImage, 1);

    assert.strictEqual(result.assets.length, 1);
    assert.strictEqual(result.assets[0].filename, 'img_q1_1.png');
    assert.strictEqual(result.assets[0].identifier, 'ccres_001_01');
    assert.ok(result.assets[0].data instanceof Uint8Array);
    assert.ok(result.assets[0].data.length > 0);
    assert.ok(result.processedHtml.includes('src="../img_q1_1.png"'));
  });

  it('deve processar múltiplas imagens atribuindo nomes sequenciais', () => {
    const base64Png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const htmlWithImages = `<p><img src="data:image/png;base64,${base64Png}" /></p><p><img src="data:image/jpeg;base64,${base64Png}" /></p>`;

    const result = AssetManager.processImages(htmlWithImages, 3);

    assert.strictEqual(result.assets.length, 2);
    assert.strictEqual(result.assets[0].filename, 'img_q3_1.png');
    assert.strictEqual(result.assets[1].filename, 'img_q3_2.jpg');
    assert.ok(result.processedHtml.includes('src="../img_q3_1.png"'));
    assert.ok(result.processedHtml.includes('src="../img_q3_2.jpg"'));
  });

  it('deve retornar HTML inalterado se não houver imagens em base64', () => {
    const textHtml = '<p>Questão sem imagem</p>';
    const result = AssetManager.processImages(textHtml, 1);
    assert.strictEqual(result.processedHtml, textHtml);
    assert.strictEqual(result.assets.length, 0);
  });
});
