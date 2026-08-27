/**
 * zipBuilder.js
 * Módulo responsável por reunir todos os XMLs e estruturas de pastas
 * e gerar o arquivo .zip final pronto para importação no LMS.
 */

import { Logger } from '../logger.js';
import { XmlHelpers } from './xmlHelpers.js';
import { ItemBuilder } from './itemBuilder.js';
import { TestBuilder } from './testBuilder.js';
import { ManifestBuilder } from './manifestBuilder.js';

export const ZipBuilder = {
  /**
   * Constrói e dispara o download do pacote QTI 2.1 em .zip.
   * @param {Array} questions - Lista de questões cadastradas
   * @param {string} title - Título da atividade / pool
   * @returns {Promise<boolean>} Sucesso da operação
   */
  async generatePackage(questions, title = 'Atividade Avaliativa') {
    if (!questions || questions.length === 0) {
      Logger.error('Não há questões para gerar o pacote QTI.');
      return false;
    }

    if (typeof JSZip === 'undefined' && typeof window.JSZip === 'undefined') {
      Logger.error('Biblioteca JSZip não encontrada no navegador.');
      return false;
    }

    const JSZipLib = window.JSZip || JSZip;
    const zip = new JSZipLib();

    Logger.info(`Iniciando geração do pacote QTI 2.1 para "${title}" (${questions.length} questões)...`);

    try {
      // 1. Gera e adiciona o imsmanifest.xml na raiz
      Logger.info('Criando imsmanifest.xml...');
      const manifestXml = ManifestBuilder.build(questions.length);
      zip.file('imsmanifest.xml', manifestXml);

      // 2. Cria a pasta csfiles/home_dir/
      zip.folder('csfiles').folder('home_dir');

      // 3. Cria a pasta qti21/
      const qtiFolder = zip.folder('qti21');

      // 4. Gera e adiciona o question_bank00001.xml
      Logger.info('Criando qti21/question_bank00001.xml...');
      const testXml = TestBuilder.build(title, questions.length);
      qtiFolder.file('question_bank00001.xml', testXml);

      // 5. Gera cada arquivo assessmentItemXXXXX.xml
      questions.forEach((q, index) => {
        const itemNumber = index + 1;
        const itemId = XmlHelpers.formatItemIdentifier(itemNumber);
        const fileName = `${itemId}.xml`;

        Logger.info(`Gerando qti21/${fileName} [Tipo: ${q.type}]...`);
        const itemXml = ItemBuilder.build(q, itemNumber);
        qtiFolder.file(fileName, itemXml);
      });

      // 6. Compacta em formato Blob
      Logger.info('Compactando arquivos no pacote .zip...');
      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      // 7. Dispara o download automático no navegador
      const sanitizedName = title.replace(/[^a-zA-Z0-9_\-]/g, '_');
      const filename = `Pool_ExportFile_${sanitizedName}.zip`;

      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      Logger.success(`Pacote "${filename}" gerado e baixado com sucesso! (${(blob.size / 1024).toFixed(2)} KB)`);
      return true;

    } catch (err) {
      Logger.error(`Erro ao empacotar o arquivo QTI: ${err.message}`);
      console.error(err);
      return false;
    }
  }
};
