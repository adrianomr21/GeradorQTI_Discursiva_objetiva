import { Logger } from './logger.js';
import { QuestionParser } from './parser.js';
import { ZipBuilder } from './qti/zipBuilder.js';
import { QtiImporter } from './qti/qtiImporter.js';
import { DocxImporter } from './docx/docxImporter.js';
import { DocxExporter } from './docx/docxExporter.js';
import { JsonImporter } from './jsonImporter.js';
import { RichTextEditor } from './editor/richTextEditor.js';

// Estado global da aplicação
export const state = {
  title: '',
  questions: [],
  editingIndex: null, // Índice da questão sendo editada ou null
  currentFilter: 'all' // 'all' | 'problems' | 'objective' | 'discursive'
};

/**
 * Extrai lista de imagens (src) de um fragmento HTML
 * @param {string} html
 * @returns {Array<string>}
 */
function extractImagesFromHtml(html = '') {
  if (!html) return [];
  const matches = [];
  const regex = /<img[^>]+src=["']([^"']+)["']/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    matches.push(m[1]);
  }
  return matches;
}

/**
 * Extrai lista de fórmulas LaTeX de um fragmento HTML
 * @param {string} html
 * @returns {Array<string>}
 */
function extractMathFromHtml(html = '') {
  if (!html) return [];
  const matches = [];
  const regex = /data-latex=["']([^"']+)["']/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    matches.push(m[1].trim());
  }
  return matches;
}

/**
 * Extrai lista de vídeos (src de iframe, video, source, embed, object) de um fragmento HTML
 * @param {string} html
 * @returns {Array<string>}
 */
function extractVideosFromHtml(html = '') {
  if (!html) return [];
  const matches = [];
  const regex = /<(?:iframe|video|source|embed|object)[^>]+(?:src|data)=["']([^"']+)["']/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    matches.push(m[1].trim());
  }
  return matches;
}

/**
 * Compara se duas listas de strings são idênticas
 * @param {Array<string>} list1
 * @param {Array<string>} list2
 * @returns {boolean}
 */
function areStringListsEqual(list1 = [], list2 = []) {
  if (list1.length !== list2.length) return false;
  for (let i = 0; i < list1.length; i++) {
    if (list1[i] !== list2[i]) return false;
  }
  return true;
}

/**
 * Gera uma assinatura canônica de um conjunto de alternativas
 * @param {Array} options
 * @returns {string}
 */
function getOptionSignature(options = []) {
  if (!options || !Array.isArray(options) || options.length === 0) return '';
  return options
    .map(opt => {
      const text = QuestionParser.stripHtml(opt.text || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const imgs = extractImagesFromHtml(opt.text || '').join(';');
      const maths = extractMathFromHtml(opt.text || '').join(';');
      const vids = extractVideosFromHtml(opt.text || '').join(';');
      return `${text}[IMG:${imgs}][MATH:${maths}][VID:${vids}]`;
    })
    .sort()
    .join(' || ');
}

/**
 * Verifica se duas questões possuem o mesmo conteúdo (enunciado, imagens, fórmulas, vídeos e alternativas/respostas)
 * @param {Object} q1
 * @param {Object} q2
 * @returns {boolean}
 */
export function isSameQuestion(q1, q2) {
  if (!q1 || !q2) return false;
  if (q1 === q2) return false;

  // 1. Tipos diferentes não são a mesma questão
  if (q1.type !== q2.type) return false;

  // 2. Compara texto normalizado do enunciado
  const normPrompt1 = QuestionParser.stripHtml(q1.prompt || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  
  const normPrompt2 = QuestionParser.stripHtml(q2.prompt || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  if (normPrompt1 !== normPrompt2) return false;

  // 3. Compara imagens do enunciado
  const imgs1 = extractImagesFromHtml(q1.prompt || '');
  const imgs2 = extractImagesFromHtml(q2.prompt || '');
  if (!areStringListsEqual(imgs1, imgs2)) return false;

  // 4. Compara fórmulas matemáticas do enunciado
  const maths1 = extractMathFromHtml(q1.prompt || '');
  const maths2 = extractMathFromHtml(q2.prompt || '');
  if (!areStringListsEqual(maths1, maths2)) return false;

  // 5. Compara vídeos do enunciado (iframe, video, source)
  const vids1 = extractVideosFromHtml(q1.prompt || '');
  const vids2 = extractVideosFromHtml(q2.prompt || '');
  if (!areStringListsEqual(vids1, vids2)) return false;

  // Se o enunciado estiver completamente vazio (nem texto nem imagem nem fórmula nem vídeo), não considera igual
  if (!normPrompt1 && imgs1.length === 0 && maths1.length === 0 && vids1.length === 0) return false;

  // 6. Compara alternativas para questões objetivas
  if (q1.type === 'multiple_choice') {
    const opts1 = q1.options || [];
    const opts2 = q2.options || [];
    if (opts1.length !== opts2.length) return false;
    if (opts1.length === 0 && opts2.length === 0) return true;

    const sig1 = getOptionSignature(opts1);
    const sig2 = getOptionSignature(opts2);
    return sig1 === sig2;
  }

  // 7. Compara padrão de resposta para questões discursivas
  if (q1.type === 'discursive') {
    if (q1.modelAnswer || q2.modelAnswer) {
      const ansText1 = QuestionParser.stripHtml(q1.modelAnswer || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const ansText2 = QuestionParser.stripHtml(q2.modelAnswer || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (ansText1 !== ansText2) return false;

      const ansImgs1 = extractImagesFromHtml(q1.modelAnswer || '');
      const ansImgs2 = extractImagesFromHtml(q2.modelAnswer || '');
      if (!areStringListsEqual(ansImgs1, ansImgs2)) return false;

      const ansMath1 = extractMathFromHtml(q1.modelAnswer || '');
      const ansMath2 = extractMathFromHtml(q2.modelAnswer || '');
      if (!areStringListsEqual(ansMath1, ansMath2)) return false;

      const ansVids1 = extractVideosFromHtml(q1.modelAnswer || '');
      const ansVids2 = extractVideosFromHtml(q2.modelAnswer || '');
      if (!areStringListsEqual(ansVids1, ansVids2)) return false;
    }
    return true;
  }

  return true;
}

/**
 * Verifica se a questão é uma duplicata de outra questão na lista
 * @param {Object} q
 * @param {Array} allQuestions
 * @returns {boolean}
 */
export function isDuplicateQuestion(q, allQuestions = state.questions) {
  const list = Array.isArray(allQuestions) ? allQuestions : (state && state.questions ? state.questions : []);
  if (!q || !Array.isArray(list) || list.length <= 1) return false;
  return list.some(other => isSameQuestion(q, other));
}

/**
 * Verifica se uma questão possui algum problema/pendência de validação
 * @param {Object} q - Objeto da questão
 * @param {Array} allQuestions - Lista de todas as questões cadastradas
 * @returns {boolean}
 */
export function hasQuestionIssues(q, allQuestions = state.questions) {
  if (!q) return false;

  const list = Array.isArray(allQuestions) ? allQuestions : (state && state.questions ? state.questions : []);
  const isDuplicate = isDuplicateQuestion(q, list);

  if (q.type === 'multiple_choice') {
    const hasNoCorrect = q.needsCorrectAnswerAdjustment || !q.options || !q.options.some(opt => opt.isCorrect);
    const hasMultipleCorrect = !!q.hadMultipleCorrectAnswers;
    const hasDuplicateOptions = !!q.hasDuplicateOptions;
    const hasFewOptions = !q.options || q.options.length < 5;
    return hasNoCorrect || hasMultipleCorrect || hasDuplicateOptions || hasFewOptions || isDuplicate;
  } else if (q.type === 'discursive') {
    return isDuplicate;
  }
  return false;
}

// Exemplos pré-configurados para teste rápido
const SAMPLES = {
  objective: `<p><strong>Questão 1</strong></p>
<p>Qual das seguintes linguagens é padrão para manipulação de bancos de dados relacionais?</p>
<p>*a) <strong>SQL</strong> (Structured Query Language)</p>
<p>b) HTML</p>
<p>c) CSS</p>
<p>d) Python</p>
<p>e) JSON</p>
<p><strong>Feedback:</strong></p>
<p>SQL é a linguagem padrão utilizada para consultas e manipulações em bancos de dados relacionais.</p>`,

  discursive: `<p><strong>Questão 2</strong></p>
<p>Explique a importância da normalização de dados (1FN, 2FN e 3FN) no projeto de bancos de dados relacionais e cite um benefício prático.</p>
<p><strong>Padrão de resposta:</strong></p>
<p>A normalização é o processo de organização dos dados para minimizar redundâncias e dependências incoerentes. O benefício prático inclui maior integridade dos dados e otimização do espaço em disco.</p>
<p><strong>Feedback:</strong></p>
<p>Muito bem! A resposta deve destacar a eliminação de anomalias de inserção, alteração e exclusão.</p>`
};

// Elementos da Interface (inicializados dinamicamente no navegador)
let elements = {};

function initElements() {
  if (typeof document === 'undefined') return;
  elements = {
    activityTitle: document.getElementById('activity-title'),
    btnAddQuestionModal: document.getElementById('btn-add-question-modal'),
    modalQuestionEditor: document.getElementById('modal-question-editor'),
    modalEditorTitle: document.getElementById('modal-editor-title'),
    btnEditorModalClose: document.getElementById('btn-editor-modal-close'),
    btnCancelModalEditor: document.getElementById('btn-cancel-modal-editor'),
    btnAddQuestion: document.getElementById('btn-add-question'),
    btnClearInput: document.getElementById('btn-clear-input'),
    btnExportZip: document.getElementById('btn-export-zip'),
    btnExportDocx: document.getElementById('btn-export-docx'),
    btnImportDocx: document.getElementById('btn-import-docx'),
    inputFileDocx: document.getElementById('input-file-docx'),
    btnImportQti: document.getElementById('btn-import-qti'),
    inputFileQti: document.getElementById('input-file-qti'),
    btnImportJson: document.getElementById('btn-import-json'),
    inputFileJson: document.getElementById('input-file-json'),
    btnClearAll: document.getElementById('btn-clear-all'),
    btnSampleObj: document.getElementById('btn-sample-obj'),
    btnSampleDisc: document.getElementById('btn-sample-disc'),
    jsonPreview: document.getElementById('json-preview'),
    questionsList: document.getElementById('questions-list'),
    questionCount: document.getElementById('question-count'),
    filterCountAll: document.getElementById('filter-count-all'),
    filterCountProblems: document.getElementById('filter-count-problems'),
    filterCountObj: document.getElementById('filter-count-obj'),
    filterCountDisc: document.getElementById('filter-count-disc'),
    btnClearLogs: document.getElementById('btn-clear-logs'),
    editBanner: document.getElementById('editor-edit-banner'),
    editQuestionNum: document.getElementById('edit-question-num'),
    btnBannerCancelEdit: document.getElementById('btn-banner-cancel-edit')
  };
}

/**
 * Reconstrói o HTML formatado de uma questão para ser recarregado no Editor.
 * @param {Object} q - Objeto da questão
 * @returns {string} HTML pronto para o WYSIWYG
 */
export function questionToEditorHtml(q) {
  if (!q) return '';
  let html = `<p><strong>${q.title || `Questão ${q.id}`}</strong></p>\n`;
  html += `${q.prompt}\n`;

  if (q.type === 'multiple_choice' && q.options) {
    q.options.forEach(opt => {
      const prefix = opt.isCorrect ? `*${opt.letter.toUpperCase()})` : `${opt.letter.toUpperCase()})`;
      let optText = (opt.text || '').trim();
      // Remove qualquer prefixo residual e negrito total antes de adicionar o prefixo do editor
      optText = QuestionParser.removeOptionPrefix(optText);
      optText = QuestionParser.stripFullOptionBold(optText);

      if (optText.startsWith('<p') || optText.startsWith('<div')) {
        optText = optText.replace(/^(<[a-z]+[^>]*>)/i, `$1<strong>${prefix}</strong> `);
        html += `${optText}\n`;
      } else {
        html += `<p><strong>${prefix}</strong> ${optText}</p>\n`;
      }
    });
  } else if (q.type === 'discursive') {
    if (q.modelAnswer) {
      let ans = q.modelAnswer.trim();
      if (ans.startsWith('<p') || ans.startsWith('<div')) {
        html += `<p><strong>Padrão de resposta:</strong></p>\n${ans}\n`;
      } else {
        html += `<p><strong>Padrão de resposta:</strong> ${ans}</p>\n`;
      }
    }
  }

  if (q.feedback) {
    let fb = q.feedback.trim();
    if (fb.startsWith('<p') || fb.startsWith('<div')) {
      html += `<p><strong>Feedback:</strong></p>\n${fb}\n`;
    } else {
      html += `<p><strong>Feedback:</strong> ${fb}</p>\n`;
    }
  }

  return html.trim();
}

/**
 * Abre o modal do editor para adicionar uma nova questão ou editar uma questão existente
 * @param {number|null} index - Índice da questão a ser editada ou null para nova questão
 */
export function openEditorModal(index = null) {
  if (typeof document === 'undefined') return;

  if (index !== null && state.questions[index]) {
    state.editingIndex = index;
    const q = state.questions[index];
    const html = questionToEditorHtml(q);
    RichTextEditor.setHtml(html);

    if (elements.modalEditorTitle) {
      elements.modalEditorTitle.textContent = `✏️ Editar Questão #${q.id || (index + 1)}`;
    }
    if (elements.btnAddQuestion) {
      elements.btnAddQuestion.textContent = `💾 Salvar Alterações (Questão #${q.id || (index + 1)})`;
      elements.btnAddQuestion.className = 'btn btn-success';
    }
    if (elements.btnClearInput) {
      elements.btnClearInput.textContent = '❌ Limpar Conteúdo';
    }
    if (elements.editBanner) {
      elements.editBanner.style.display = 'flex';
      if (elements.editQuestionNum) elements.editQuestionNum.textContent = q.id || (index + 1);
    }
  } else {
    state.editingIndex = null;
    RichTextEditor.clear();

    if (elements.modalEditorTitle) {
      elements.modalEditorTitle.textContent = '➕ Adicionar Nova Questão';
    }
    if (elements.btnAddQuestion) {
      elements.btnAddQuestion.textContent = '➕ Adicionar Questão ao Banco';
      elements.btnAddQuestion.className = 'btn btn-primary';
    }
    if (elements.btnClearInput) {
      elements.btnClearInput.textContent = 'Limpar Editor';
    }
    if (elements.editBanner) {
      elements.editBanner.style.display = 'none';
    }
  }

  if (elements.modalQuestionEditor) {
    elements.modalQuestionEditor.style.display = 'flex';
    setTimeout(() => RichTextEditor.editorElement?.focus(), 50);
  }
}

/**
 * Fecha o modal do editor de questões
 */
export function closeEditorModal() {
  if (typeof document === 'undefined') return;

  if (elements.modalQuestionEditor) {
    elements.modalQuestionEditor.style.display = 'none';
  }

  if (state.editingIndex !== null) {
    const editId = state.questions[state.editingIndex]?.id || (state.editingIndex + 1);
    state.editingIndex = null;
    RichTextEditor.clear();
    render();
    Logger.info(`Edição da Questão #${editId} cancelada.`);
  }
}

/**
 * Inicializa a aplicação e registra os eventos
 */
function init() {
  // 0. Mapeia elementos do DOM
  initElements();

  // 1. Inicializa o Editor de Texto Rico
  RichTextEditor.init({
    editorId: 'editor-content',
    sourceId: 'editor-source',
    imageInputId: 'editor-image-input'
  });

  // 2. Conecta os botões da barra de ferramentas do Editor
  document.getElementById('btn-tool-undo')?.addEventListener('click', () => RichTextEditor.execCmd('undo'));
  document.getElementById('btn-tool-redo')?.addEventListener('click', () => RichTextEditor.execCmd('redo'));
  document.getElementById('btn-tool-bold')?.addEventListener('click', () => RichTextEditor.execCmd('bold'));
  document.getElementById('btn-tool-italic')?.addEventListener('click', () => RichTextEditor.execCmd('italic'));
  document.getElementById('btn-tool-underline')?.addEventListener('click', () => RichTextEditor.execCmd('underline'));
  document.getElementById('btn-tool-strike')?.addEventListener('click', () => RichTextEditor.execCmd('strikeThrough'));
  document.getElementById('btn-tool-sup')?.addEventListener('click', () => RichTextEditor.execCmd('superscript'));
  document.getElementById('btn-tool-sub')?.addEventListener('click', () => RichTextEditor.execCmd('subscript'));
  document.getElementById('btn-tool-align-left')?.addEventListener('click', () => RichTextEditor.execCmd('justifyLeft'));
  document.getElementById('btn-tool-align-center')?.addEventListener('click', () => RichTextEditor.execCmd('justifyCenter'));
  document.getElementById('btn-tool-align-right')?.addEventListener('click', () => RichTextEditor.execCmd('justifyRight'));
  document.getElementById('btn-tool-align-justify')?.addEventListener('click', () => RichTextEditor.execCmd('justifyFull'));
  document.getElementById('btn-tool-ul')?.addEventListener('click', () => RichTextEditor.execCmd('insertUnorderedList'));
  document.getElementById('btn-tool-ol')?.addEventListener('click', () => RichTextEditor.execCmd('insertOrderedList'));
  document.getElementById('btn-tool-outdent')?.addEventListener('click', () => RichTextEditor.execCmd('outdent'));
  document.getElementById('btn-tool-indent')?.addEventListener('click', () => RichTextEditor.execCmd('indent'));
  document.getElementById('btn-tool-table')?.addEventListener('click', () => RichTextEditor.insertTable(3, 3));
  document.getElementById('btn-tool-latex')?.addEventListener('click', () => RichTextEditor.openLatexModal());
  document.getElementById('btn-tool-link')?.addEventListener('click', () => RichTextEditor.insertLink());
  document.getElementById('btn-tool-image')?.addEventListener('click', () => RichTextEditor.triggerImageUpload());
  document.getElementById('btn-tool-clear')?.addEventListener('click', () => RichTextEditor.clearFormatting());
  document.getElementById('btn-tool-source')?.addEventListener('click', () => RichTextEditor.toggleSourceMode());

  // 2.1. Botão "+" para abrir Modal de Nova Questão
  elements.btnAddQuestionModal?.addEventListener('click', () => {
    openEditorModal(null);
  });

  // 2.2. Botões de Fechamento do Modal do Editor
  elements.btnEditorModalClose?.addEventListener('click', closeEditorModal);
  elements.btnCancelModalEditor?.addEventListener('click', closeEditorModal);

  // Fecha com a tecla Escape se sub-modais não estiverem abertos
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && elements.modalQuestionEditor?.style.display === 'flex') {
      const latexModal = document.getElementById('modal-latex');
      const linkModal = document.getElementById('modal-link');
      const titleModal = document.getElementById('modal-activity-title');
      const isSubModalOpen = (latexModal && latexModal.style.display === 'flex') ||
                             (linkModal && linkModal.style.display === 'flex') ||
                             (titleModal && titleModal.style.display === 'flex');
      if (!isSubModalOpen) {
        closeEditorModal();
      }
    }
  });

  // 3. Botão Adicionar ou Salvar Questão
  elements.btnAddQuestion?.addEventListener('click', handleSaveOrAddQuestion);

  // 4. Botão Limpar / Cancelar Edição
  elements.btnClearInput?.addEventListener('click', handleCancelOrClear);
  elements.btnBannerCancelEdit?.addEventListener('click', handleCancelOrClear);

  // 5. Botão Importar Word (.docx)
  elements.btnImportDocx?.addEventListener('click', () => {
    elements.inputFileDocx?.click();
  });
  elements.inputFileDocx?.addEventListener('change', handleImportDocxFile);

  // 6. Botão Importar Pacote QTI (.zip)
  elements.btnImportQti?.addEventListener('click', () => {
    elements.inputFileQti?.click();
  });
  elements.inputFileQti?.addEventListener('change', handleImportQtiFile);

  // 6.1. Botão Importar JSON (.json)
  elements.btnImportJson?.addEventListener('click', () => {
    elements.inputFileJson?.click();
  });
  elements.inputFileJson?.addEventListener('change', handleImportJsonFile);

  // 7. Botão Exportar Pacote QTI
  elements.btnExportZip?.addEventListener('click', handleExportZip);

  // 8. Botão Exportar para Word (.docx)
  elements.btnExportDocx?.addEventListener('click', handleExportDocx);

  // 9. Botão Limpar Tudo
  elements.btnClearAll?.addEventListener('click', handleClearAll);

  // 10. Botões de Exemplos Rápidos (carregam no editor e abrem o modal)
  elements.btnSampleObj?.addEventListener('click', () => {
    openEditorModal(null);
    RichTextEditor.setHtml(SAMPLES.objective);
    Logger.info('Exemplo formatado de questão Objetiva carregado no editor.');
  });

  elements.btnSampleDisc?.addEventListener('click', () => {
    openEditorModal(null);
    RichTextEditor.setHtml(SAMPLES.discursive);
    Logger.info('Exemplo formatado de questão Discursiva carregado no editor.');
  });

  // 11. Botão Limpar Logs
  elements.btnClearLogs?.addEventListener('click', () => {
    Logger.clear();
  });

  // 12. Barra de Filtros de Questões
  document.querySelectorAll('.questions-filter-bar button[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.getAttribute('data-filter');
      state.currentFilter = filter || 'all';
      render();
    });
  });

  // 13. Alteração do título da atividade
  elements.activityTitle?.addEventListener('input', (e) => {
    state.title = e.target.value.trim();
  });

  Logger.info('Sistema Gerador QTI 2.1 inicializado com sucesso.');
  render();
}

/**
 * Adiciona uma nova questão ou salva a alteração da questão em edição na mesma posição
 */
function handleSaveOrAddQuestion() {
  const content = RichTextEditor.getHtml().trim();
  if (!content) {
    Logger.warn('Por favor, digite ou cole o conteúdo da questão antes de salvar.');
    return;
  }

  if (state.editingIndex !== null) {
    // MODO EDIÇÃO: Atualiza a questão na mesma posição
    const index = state.editingIndex;
    const currentQuestion = state.questions[index];
    const targetId = currentQuestion ? currentQuestion.id : (index + 1);

    const parsed = QuestionParser.parse(content, targetId);
    if (parsed) {
      // Substitui na mesma posição do array
      state.questions[index] = parsed;
      state.editingIndex = null;
      RichTextEditor.clear();
      if (elements.modalQuestionEditor) {
        elements.modalQuestionEditor.style.display = 'none';
      }
      render();

      // Destaque visual suave no card sem rolar a tela
      const cardEl = document.getElementById(`q-card-${index}`);
      if (cardEl) {
        cardEl.classList.remove('question-card-saved-highlight');
        void cardEl.offsetWidth; // Força reflow para reiniciar animação
        cardEl.classList.add('question-card-saved-highlight');
      }

      Logger.success(`Questão #${parsed.id} atualizada com sucesso na mesma posição!`);
      if (isDuplicateQuestion(parsed, state.questions)) {
        Logger.warn(`⚠️ Atenção: A questão #${parsed.id} possui conteúdo repetido com outra questão do banco.`);
      }
    }
  } else {
    // MODO ADIÇÃO: Cria uma nova questão no fim da lista
    const nextIndex = state.questions.length + 1;
    const parsed = QuestionParser.parse(content, nextIndex);
    if (parsed) {
      state.questions.push(parsed);
      RichTextEditor.clear();
      if (elements.modalQuestionEditor) {
        elements.modalQuestionEditor.style.display = 'none';
      }
      render();

      const newIdx = state.questions.length - 1;
      const cardEl = document.getElementById(`q-card-${newIdx}`);
      if (cardEl) {
        cardEl.classList.add('question-card-saved-highlight');
      }

      Logger.success(`Questão #${parsed.id} adicionada à lista.`);
      if (isDuplicateQuestion(parsed, state.questions)) {
        Logger.warn(`⚠️ Atenção: A questão #${parsed.id} possui conteúdo repetido com outra questão do banco.`);
      }
    }
  }
}

/**
 * Cancela o modo de edição ou limpa o editor de texto
 */
function handleCancelOrClear() {
  if (state.editingIndex !== null) {
    const editId = state.questions[state.editingIndex]?.id || (state.editingIndex + 1);
    state.editingIndex = null;
    RichTextEditor.clear();
    if (elements.modalQuestionEditor) {
      elements.modalQuestionEditor.style.display = 'none';
    }
    render();
    Logger.info(`Edição da Questão #${editId} cancelada.`);
  } else {
    RichTextEditor.clear();
    Logger.info('Editor de texto limpo.');
  }
}

/**
 * Carrega a questão selecionada de volta para o editor no modal sem rolar a página
 */
export function editQuestion(index) {
  const question = state.questions[index];
  if (!question) return;

  openEditorModal(index);
  Logger.info(`Questão #${question.id} aberta no editor. Faça os ajustes e clique em "Salvar Alterações".`);
}

/**
 * Remove uma questão específica pelo índice
 */
export function removeQuestion(index) {
  // Se estiver editando a questão sendo removida, cancela o modo de edição
  if (state.editingIndex === index) {
    state.editingIndex = null;
    RichTextEditor.clear();
  } else if (state.editingIndex !== null && state.editingIndex > index) {
    state.editingIndex--;
  }

  state.questions.splice(index, 1);
  // Re-indexa os IDs
  state.questions.forEach((q, i) => {
    q.id = i + 1;
    if (q.title.startsWith('Questão')) {
      q.title = `Questão ${i + 1}`;
    }
  });
  render();
  Logger.info(`Questão removida. Restam ${state.questions.length} questões.`);
}

// Expõe globalmente para os onclick dos cards no navegador
if (typeof window !== 'undefined') {
  window.editQuestion = editQuestion;
  window.removeQuestion = removeQuestion;
}

/**
 * Importa um banco de questões a partir de um arquivo Word (.docx)
 * e adiciona continuamente as questões à lista existente
 */
async function handleImportDocxFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  Logger.info(`Carregando documento Word: "${file.name}" (${(file.size / 1024).toFixed(1)} KB)...`);

  try {
    const startingIndex = state.questions.length + 1;
    const result = await DocxImporter.importDocx(file, startingIndex);

    if (result.questions && result.questions.length > 0) {
      // Adiciona as questões importadas à lista existente (sem sobrescrever as atuais)
      state.questions.push(...result.questions);

      render();
      Logger.success(`🎉 ${result.questions.length} questões importadas com sucesso do Word! Total no banco: ${state.questions.length} questões.`);

      const duplicatesCount = state.questions.filter(q => isDuplicateQuestion(q, state.questions)).length;
      if (duplicatesCount > 0) {
        Logger.warn(`⚠️ Atenção: Foram identificadas ${duplicatesCount} questões repetidas no banco após a importação.`);
      }
    } else {
      Logger.warn('Nenhuma questão válida foi identificada no arquivo Word.');
    }
  } catch (err) {
    Logger.error(`Erro ao importar arquivo Word (.docx): ${err.message}`);
    console.error(err);
  } finally {
    e.target.value = ''; // Reseta input para permitir reimportar se desejado
  }
}

/**
 * Importa um pacote QTI 2.1 (.zip) e adiciona continuamente as questões à lista existente
 */
async function handleImportQtiFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  Logger.info(`Carregando pacote QTI: "${file.name}" (${(file.size / 1024).toFixed(1)} KB)...`);

  try {
    const startingIndex = state.questions.length + 1;
    const result = await QtiImporter.importZip(file, startingIndex);

    if (result.questions && result.questions.length > 0) {
      // Adiciona as questões importadas à lista existente (sem sobrescrever as atuais)
      state.questions.push(...result.questions);

      render();
      Logger.success(`🎉 ${result.questions.length} questões importadas e adicionadas com sucesso! Total no banco: ${state.questions.length} questões.`);

      const duplicatesCount = state.questions.filter(q => isDuplicateQuestion(q, state.questions)).length;
      if (duplicatesCount > 0) {
        Logger.warn(`⚠️ Atenção: Foram identificadas ${duplicatesCount} questões repetidas no banco após a importação.`);
      }
    } else {
      Logger.warn('Nenhuma questão válida foi encontrada no pacote importado.');
    }
  } catch (err) {
    Logger.error(`Erro ao importar pacote QTI: ${err.message}`);
    console.error(err);
  } finally {
    e.target.value = ''; // Reseta input para permitir reimportar o mesmo arquivo se desejado
  }
}

/**
 * Importa um banco de questões a partir de um arquivo JSON (.json)
 * e adiciona continuamente as questões à lista existente
 */
async function handleImportJsonFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  Logger.info(`Carregando arquivo JSON: "${file.name}" (${(file.size / 1024).toFixed(1)} KB)...`);

  try {
    const text = await file.text();
    const startingIndex = state.questions.length + 1;
    const result = JsonImporter.importJson(text, startingIndex);

    if (result.questions && result.questions.length > 0) {
      // Adiciona as questões importadas à lista existente (sem sobrescrever as atuais)
      state.questions.push(...result.questions);

      render();
      Logger.success(`🎉 ${result.questions.length} questões importadas com sucesso do JSON! Total no banco: ${state.questions.length} questões.`);

      const duplicatesCount = state.questions.filter(q => isDuplicateQuestion(q, state.questions)).length;
      if (duplicatesCount > 0) {
        Logger.warn(`⚠️ Atenção: Foram identificadas ${duplicatesCount} questões repetidas no banco após a importação.`);
      }
    } else {
      Logger.warn('Nenhuma questão válida foi encontrada no arquivo JSON.');
    }
  } catch (err) {
    Logger.error(`Erro ao importar arquivo JSON: ${err.message}`);
    console.error(err);
  } finally {
    e.target.value = ''; // Reseta input para permitir reimportar o mesmo arquivo se desejado
  }
}

/**
 * Garante que a atividade possua um nome antes de exportar.
 * Se não houver nome, abre o modal para o usuário informar.
 * @returns {Promise<string|null>} Retorna o título confirmado ou null se cancelado
 */
export function ensureActivityTitle() {
  const currentTitle = (state.title || (elements.activityTitle ? elements.activityTitle.value : '')).trim();
  if (currentTitle) {
    state.title = currentTitle;
    return Promise.resolve(currentTitle);
  }

  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      return resolve('nome_disciplina_ava_1');
    }

    const modal = document.getElementById('modal-activity-title');
    const input = document.getElementById('modal-activity-title-input');
    const btnConfirm = document.getElementById('btn-activity-title-confirm');
    const btnCancel = document.getElementById('btn-activity-title-cancel');
    const btnClose = document.getElementById('btn-activity-title-close');

    if (!modal || !input) {
      const promptTitle = window.prompt('Informe o nome da atividade:', 'nome_disciplina_ava_1');
      if (promptTitle && promptTitle.trim()) {
        const clean = promptTitle.trim();
        state.title = clean;
        if (elements.activityTitle) elements.activityTitle.value = clean;
        resolve(clean);
      } else {
        resolve(null);
      }
      return;
    }

    input.value = '';
    input.placeholder = 'nome_disciplina_ava_1';
    modal.style.display = 'flex';
    setTimeout(() => input.focus(), 50);

    const cleanup = () => {
      modal.style.display = 'none';
      btnConfirm?.removeEventListener('click', onConfirm);
      btnCancel?.removeEventListener('click', onCancel);
      btnClose?.removeEventListener('click', onCancel);
      input?.removeEventListener('keydown', onKeyDown);
      modal?.removeEventListener('click', onOverlayClick);
    };

    const onConfirm = () => {
      let val = input.value.trim();
      if (!val) {
        val = 'nome_disciplina_ava_1';
      }
      state.title = val;
      if (elements.activityTitle) elements.activityTitle.value = val;
      cleanup();
      resolve(val);
    };

    const onCancel = () => {
      cleanup();
      resolve(null);
    };

    const onKeyDown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };

    const onOverlayClick = (e) => {
      if (e.target === modal) {
        onCancel();
      }
    };

    btnConfirm?.addEventListener('click', onConfirm);
    btnCancel?.addEventListener('click', onCancel);
    btnClose?.addEventListener('click', onCancel);
    input?.addEventListener('keydown', onKeyDown);
    modal?.addEventListener('click', onOverlayClick);
  });
}

/**
 * Exporta o pacote QTI .zip
 */
async function handleExportZip() {
  if (state.questions.length === 0) {
    Logger.warn('Adicione ao menos uma questão antes de gerar o pacote QTI.');
    return;
  }

  const title = await ensureActivityTitle();
  if (!title) {
    Logger.info('Exportação do pacote QTI cancelada (nome não informado).');
    return;
  }

  elements.btnExportZip.disabled = true;
  elements.btnExportZip.textContent = '⏳ Gerando Pacote...';

  try {
    await ZipBuilder.generatePackage(state.questions, title);
  } finally {
    elements.btnExportZip.disabled = false;
    elements.btnExportZip.textContent = '📦 Gerar Pacote QTI (.zip)';
  }
}

/**
 * Exporta todas as questões cadastradas para um documento Word (.docx)
 */
async function handleExportDocx() {
  if (state.questions.length === 0) {
    Logger.warn('Adicione ao menos uma questão antes de exportar para o Word (.docx).');
    return;
  }

  const title = await ensureActivityTitle();
  if (!title) {
    Logger.info('Exportação para Word (.docx) cancelada (nome não informado).');
    return;
  }

  if (elements.btnExportDocx) {
    elements.btnExportDocx.disabled = true;
    elements.btnExportDocx.textContent = '⏳ Gerando Word...';
  }

  try {
    await DocxExporter.generateDocx(state.questions, title);
  } finally {
    if (elements.btnExportDocx) {
      elements.btnExportDocx.disabled = false;
      elements.btnExportDocx.textContent = '📄 Exportar para Word (.docx)';
    }
  }
}

/**
 * Limpa todas as questões cadastradas
 */
function handleClearAll() {
  if (state.questions.length === 0) return;
  
  if (confirm('Deseja realmente limpar todas as questões cadastradas?')) {
    state.questions = [];
    state.editingIndex = null;
    RichTextEditor.clear();
    render();
    Logger.info('Todas as questões foram removidas.');
  }
}

/**
 * Atualiza os componentes visuais na tela
 */
function render() {
  // 1. Atualiza Contador
  elements.questionCount.textContent = state.questions.length;

  // 2. Atualiza Botões de Exportar
  if (elements.btnExportZip) elements.btnExportZip.disabled = state.questions.length === 0;
  if (elements.btnExportDocx) elements.btnExportDocx.disabled = state.questions.length === 0;

  // 3. Atualiza JSON Preview
  elements.jsonPreview.textContent = JSON.stringify(state.questions, null, 2);

  // 4. Atualiza Banner e Botões no Modo de Edição
  if (state.editingIndex !== null && state.questions[state.editingIndex]) {
    const currentQ = state.questions[state.editingIndex];
    if (elements.editBanner) elements.editBanner.style.display = 'flex';
    if (elements.editQuestionNum) elements.editQuestionNum.textContent = currentQ.id;

    elements.btnAddQuestion.textContent = `💾 Salvar Alterações (Questão #${currentQ.id})`;
    elements.btnAddQuestion.className = 'btn btn-success';
    elements.btnClearInput.textContent = '❌ Cancelar Edição';
    elements.btnClearInput.className = 'btn btn-danger-outline';
  } else {
    if (elements.editBanner) elements.editBanner.style.display = 'none';
    elements.btnAddQuestion.textContent = '➕ Adicionar Questão ao JSON';
    elements.btnAddQuestion.className = 'btn btn-primary';
    elements.btnClearInput.textContent = 'Limpar Editor';
    elements.btnClearInput.className = 'btn btn-outline';
  }

  // 5. Atualiza Contadores dos Filtros
  const countAll = state.questions.length;
  const countProblems = state.questions.filter(q => hasQuestionIssues(q, state.questions)).length;
  const countObj = state.questions.filter(q => q.type === 'multiple_choice').length;
  const countDisc = state.questions.filter(q => q.type === 'discursive').length;

  if (elements.filterCountAll) elements.filterCountAll.textContent = countAll;
  if (elements.filterCountProblems) elements.filterCountProblems.textContent = countProblems;
  if (elements.filterCountObj) elements.filterCountObj.textContent = countObj;
  if (elements.filterCountDisc) elements.filterCountDisc.textContent = countDisc;

  document.querySelectorAll('.questions-filter-bar button[data-filter]').forEach(btn => {
    const f = btn.getAttribute('data-filter');
    btn.classList.toggle('active', f === state.currentFilter);
    if (f === 'problems') {
      btn.classList.toggle('has-issues', countProblems > 0);
    }
  });

  // 6. Determina as questões a serem exibidas conforme o filtro ativo
  let filteredQuestions = state.questions;
  if (state.currentFilter === 'problems') {
    filteredQuestions = state.questions.filter(q => hasQuestionIssues(q, state.questions));
  } else if (state.currentFilter === 'objective') {
    filteredQuestions = state.questions.filter(q => q.type === 'multiple_choice');
  } else if (state.currentFilter === 'discursive') {
    filteredQuestions = state.questions.filter(q => q.type === 'discursive');
  }

  // 7. Atualiza o contador de questões no cabeçalho
  if (elements.questionCount) {
    if (state.currentFilter !== 'all') {
      elements.questionCount.textContent = `${filteredQuestions.length} de ${countAll}`;
    } else {
      elements.questionCount.textContent = countAll;
    }
  }

  // 8. Atualiza Lista de Questões
  if (state.questions.length === 0) {
    elements.questionsList.innerHTML = `
      <div class="empty-state">
        <p>Nenhuma questão cadastrada ainda.</p>
        <p class="subtitle">Cole o texto de uma questão ao lado e clique em "Adicionar ao JSON".</p>
      </div>
    `;
    return;
  }

  if (filteredQuestions.length === 0) {
    if (state.currentFilter === 'problems') {
      elements.questionsList.innerHTML = `
        <div class="empty-state">
          <p style="font-size: 1.05rem; color: #059669; font-weight: 600;">🎉 Nenhuma questão com problemas!</p>
          <p class="subtitle">Todas as ${state.questions.length} questões cadastradas estão válidas e com gabarito definido.</p>
        </div>
      `;
    } else {
      elements.questionsList.innerHTML = `
        <div class="empty-state">
          <p>Nenhuma questão encontrada para este filtro.</p>
        </div>
      `;
    }
    return;
  }

  elements.questionsList.innerHTML = filteredQuestions.map((q) => {
    const idx = state.questions.indexOf(q);
    const isObj = q.type === 'multiple_choice';
    const badgeClass = isObj ? 'badge-obj' : 'badge-disc';
    const typeLabel = isObj ? 'Objetiva' : 'Discursiva';
    const isEditing = state.editingIndex === idx;
    const hasNoCorrect = isObj && (q.needsCorrectAnswerAdjustment || !q.options || !q.options.some(opt => opt.isCorrect));
    const hasMultipleCorrect = isObj && q.hadMultipleCorrectAnswers;
    const hasDuplicateOptions = isObj && q.hasDuplicateOptions;
    const hasFewOptions = isObj && (!q.options || q.options.length < 5);
    const isDuplicate = isDuplicateQuestion(q, state.questions);
    const needsWarning = hasNoCorrect || hasMultipleCorrect || hasDuplicateOptions || hasFewOptions || isDuplicate;

    const warningAlerts = [];
    if (isDuplicate) {
      warningAlerts.push("⚠️ Atenção: Foi identificada outra questão com o mesmo conteúdo cadastrada no banco (questão repetida).");
    }
    if (hasNoCorrect) {
      warningAlerts.push("⚠️ Ajustar alternativa correta (nenhuma alternativa com '*' foi sinalizada).");
    }
    if (hasMultipleCorrect) {
      warningAlerts.push("⚠️ Atenção: Mais de uma alternativa com '*' foi sinalizada. Só pode haver uma alternativa correta (apenas a primeira foi mantida).");
    }
    if (hasDuplicateOptions) {
      warningAlerts.push("⚠️ Atenção: Foram identificadas alternativas repetidas nesta questão.");
    }
    if (hasFewOptions) {
      const optCount = q.options ? q.options.length : 0;
      warningAlerts.push(`⚠️ Atenção: Esta questão possui apenas ${optCount} alternativa${optCount === 1 ? '' : 's'} (o padrão são 5 alternativas).`);
    }

    const warningAlertHtml = warningAlerts.map(msg => `
      <div class="q-warning-alert" style="background: #fffbeb; border-left: 4px solid #f59e0b; color: #92400e; padding: 8px 12px; border-radius: 4px; font-size: 0.82rem; margin: 8px 0; display: flex; align-items: center; gap: 6px; font-weight: 600;">
        ${msg}
      </div>
    `).join('');

    let optionsHtml = '';
    if (isObj && q.options && q.options.length > 0) {
      optionsHtml = `
        <ul class="q-options-list">
          ${q.options.map(opt => `
            <li class="${opt.isCorrect ? 'correct-opt' : ''}">
              <strong>${opt.letter})</strong> ${opt.text} ${opt.isCorrect ? '<span class="correct-tag">✓ Correta</span>' : ''}
            </li>
          `).join('')}
        </ul>
      `;
    }

    const formatCardHtml = (content) => {
      if (!content) return '';
      // Garante que todo link abra em nova janela com segurança
      return content.replace(/<a\s+(?:[^>]*?\s+)?href=["']([^"']*)["']([^>]*)>/gi, (match, href, rest) => {
        const cleanRest = rest.replace(/\s*target=["'][^"']*["']/gi, '').replace(/\s*rel=["'][^"']*["']/gi, '');
        return `<a href="${href}" target="_blank" rel="noopener noreferrer"${cleanRest}>`;
      });
    };

    return `
      <div class="question-card ${isEditing ? 'question-card-editing' : ''} ${needsWarning ? 'question-card-warning' : ''}" id="q-card-${idx}">
        <div class="q-card-header">
          <div class="q-card-title">
            <span class="q-badge ${badgeClass}">${typeLabel}</span>
            <strong>${q.title}</strong>
            ${isDuplicate ? '<span class="badge-needs-adjustment" style="background: #fee2e2; color: #b91c1c; border: 1px solid #f87171; font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 12px; margin-left: 6px; display: inline-flex; align-items: center; gap: 3px;">⚠️ Questão repetida</span>' : ''}
            ${hasNoCorrect ? '<span class="badge-needs-adjustment" style="background: #fee2e2; color: #b91c1c; border: 1px solid #f87171; font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 12px; margin-left: 6px; display: inline-flex; align-items: center; gap: 3px;">⚠️ Ajustar alternativa correta</span>' : ''}
            ${hasMultipleCorrect ? '<span class="badge-needs-adjustment" style="background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 12px; margin-left: 6px; display: inline-flex; align-items: center; gap: 3px;">⚠️ Só pode haver 1 alternativa correta</span>' : ''}
            ${hasDuplicateOptions ? '<span class="badge-needs-adjustment" style="background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 12px; margin-left: 6px; display: inline-flex; align-items: center; gap: 3px;">⚠️ Alternativas repetidas</span>' : ''}
            ${hasFewOptions ? `<span class="badge-needs-adjustment" style="background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 12px; margin-left: 6px; display: inline-flex; align-items: center; gap: 3px;">⚠️ Menos de 5 alternativas (${q.options ? q.options.length : 0})</span>` : ''}
            ${isEditing ? '<span style="color: #2563eb; font-size: 0.78rem; font-weight: 600; margin-left: 6px;">(Editando no momento)</span>' : ''}
          </div>
          <div class="q-card-actions">
            <button class="btn-card-action btn-edit" onclick="editQuestion(${idx})" title="Editar esta questão">✏️</button>
            <button class="btn-card-action btn-remove" onclick="removeQuestion(${idx})" title="Remover questão">&times;</button>
          </div>
        </div>
        <div class="q-card-body">
          ${warningAlertHtml}
          <div class="q-prompt">${formatCardHtml(q.prompt)}</div>
          ${optionsHtml}
          ${q.modelAnswer ? `<div class="q-model-answer"><strong>Padrão de Resposta:</strong><div class="q-formatted-content">${formatCardHtml(q.modelAnswer)}</div></div>` : ''}
          ${q.feedback ? `<div class="q-feedback"><strong>Feedback:</strong><div class="q-formatted-content">${formatCardHtml(q.feedback)}</div></div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// Expõe globalmente para os onclick dos cards no navegador
if (typeof window !== 'undefined') {
  window.editQuestion = editQuestion;
  window.removeQuestion = removeQuestion;
  window.openEditorModal = openEditorModal;
  window.closeEditorModal = closeEditorModal;
}

// Inicia quando o DOM estiver carregado
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', init);
}

