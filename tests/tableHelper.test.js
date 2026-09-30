import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TableHelper } from '../js/editor/tableHelper.js';

describe('TableHelper Module', () => {
  it('deve possuir métodos para adicionar e excluir linhas e colunas', () => {
    assert.strictEqual(typeof TableHelper.addRowAbove, 'function');
    assert.strictEqual(typeof TableHelper.addRowBelow, 'function');
    assert.strictEqual(typeof TableHelper.addColumnLeft, 'function');
    assert.strictEqual(typeof TableHelper.addColumnRight, 'function');
    assert.strictEqual(typeof TableHelper.deleteRow, 'function');
    assert.strictEqual(typeof TableHelper.deleteColumn, 'function');
    assert.strictEqual(typeof TableHelper.deleteTable, 'function');
    assert.strictEqual(typeof TableHelper.convertTableToImage, 'function');
    assert.strictEqual(typeof TableHelper.tableToImageNative, 'function');
  });

  it('deve retornar null com segurança se os nós fornecidos forem nulos', async () => {
    assert.strictEqual(TableHelper.getClosestCell(null), null);
    assert.strictEqual(TableHelper.getClosestTable(null), null);
    assert.strictEqual(TableHelper.addRowAbove(null), null);
    assert.strictEqual(TableHelper.addRowBelow(null), null);
    assert.strictEqual(await TableHelper.convertTableToImage(null), null);
  });
});
