import { Logger } from './logger.js';
import { QuestionParser } from './parser.js';
import { ZipBuilder } from './qti/zipBuilder.js';
import { QtiImporter } from './qti/qtiImporter.js';
import { DocxImporter } from './docx/docxImporter.js';
import { RichTextEditor } from './editor/richTextEditor.js';

// Estado global da aplicação
export const state = {
  title: 'Atividade Avaliativa',
  questions: [],
  editingIndex: null // Índice da questão sendo editada ou null
};

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
    btnAddQuestion: document.getElementById('btn-add-question'),
    btnClearInput: document.getElementById('btn-clear-input'),
    btnExportZip: document.getElementById('btn-export-zip'),
    btnImportDocx: document.getElementById('btn-import-docx'),
    inputFileDocx: document.getElementById('input-file-docx'),
    btnImportQti: document.getElementById('btn-import-qti'),
    inputFileQti: document.getElementById('input-file-qti'),
    btnClearAll: document.getElementById('btn-clear-all'),
    btnSampleObj: document.getElementById('btn-sample-obj'),
    btnSampleDisc: document.getElementById('btn-sample-disc'),
    jsonPreview: document.getElementById('json-preview'),
    questionsList: document.getElementById('questions-list'),
    questionCount: document.getElementById('question-count'),
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

  // 3. Botão Adicionar ou Salvar Questão
  elements.btnAddQuestion.addEventListener('click', handleSaveOrAddQuestion);

  // 4. Botão Limpar / Cancelar Edição
  elements.btnClearInput.addEventListener('click', handleCancelOrClear);
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

  // 7. Botão Exportar Pacote QTI
  elements.btnExportZip.addEventListener('click', handleExportZip);

  // 8. Botão Limpar Tudo
  elements.btnClearAll.addEventListener('click', handleClearAll);

  // 7. Botões de Exemplos Rápidos
  elements.btnSampleObj.addEventListener('click', () => {
    if (state.editingIndex !== null) {
      if (!confirm('Você está editando uma questão. Carregar o exemplo cancelará a edição atual. Continuar?')) return;
      state.editingIndex = null;
    }
    RichTextEditor.setHtml(SAMPLES.objective);
    render();
    Logger.info('Exemplo formatado de questão Objetiva carregado no editor.');
  });

  elements.btnSampleDisc.addEventListener('click', () => {
    if (state.editingIndex !== null) {
      if (!confirm('Você está editando uma questão. Carregar o exemplo cancelará a edição atual. Continuar?')) return;
      state.editingIndex = null;
    }
    RichTextEditor.setHtml(SAMPLES.discursive);
    render();
    Logger.info('Exemplo formatado de questão Discursiva carregado no editor.');
  });

  // 8. Botão Limpar Logs
  elements.btnClearLogs.addEventListener('click', () => {
    Logger.clear();
  });

  // 9. Alteração do título da atividade
  elements.activityTitle.addEventListener('input', (e) => {
    state.title = e.target.value.trim() || 'Atividade Avaliativa';
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
      render();
      Logger.success(`Questão #${parsed.id} atualizada com sucesso na mesma posição!`);
    }
  } else {
    // MODO ADIÇÃO: Cria uma nova questão no fim da lista
    const nextIndex = state.questions.length + 1;
    const parsed = QuestionParser.parse(content, nextIndex);
    if (parsed) {
      state.questions.push(parsed);
      RichTextEditor.clear();
      render();
      Logger.success(`Questão #${parsed.id} adicionada à lista.`);
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
    render();
    Logger.info(`Edição da Questão #${editId} cancelada.`);
  } else {
    RichTextEditor.clear();
    Logger.info('Editor de texto limpo.');
  }
}

/**
 * Carrega a questão selecionada de volta para o editor para alteração in-place
 */
export function editQuestion(index) {
  const question = state.questions[index];
  if (!question) return;

  state.editingIndex = index;
  const html = questionToEditorHtml(question);
  RichTextEditor.setHtml(html);

  // Scroll suave até o container do editor
  const editorEl = typeof document !== 'undefined' ? document.querySelector('.editor-container') : null;
  if (editorEl) {
    editorEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  RichTextEditor.editorElement?.focus();
  render();
  Logger.info(`Questão #${question.id} carregada no editor para alteração. Faça os ajustes e clique em "Salvar Alterações".`);
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

      // Se o título estiver padrão e o documento trouxer um título descritivo, atualiza
      if (result.title && state.title === 'Atividade Avaliativa') {
        state.title = result.title;
        if (elements.activityTitle) elements.activityTitle.value = result.title;
      }

      render();
      Logger.success(`🎉 ${result.questions.length} questões importadas com sucesso do Word! Total no banco: ${state.questions.length} questões.`);
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

      // Se o título estiver padrão e o pacote trouxer um título descritivo, atualiza
      if (result.title && state.title === 'Atividade Avaliativa') {
        state.title = result.title;
        if (elements.activityTitle) elements.activityTitle.value = result.title;
      }

      render();
      Logger.success(`🎉 ${result.questions.length} questões importadas e adicionadas com sucesso! Total no banco: ${state.questions.length} questões.`);
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
 * Exporta o pacote QTI .zip
 */
async function handleExportZip() {
  if (state.questions.length === 0) {
    Logger.warn('Adicione ao menos uma questão antes de gerar o pacote QTI.');
    return;
  }

  elements.btnExportZip.disabled = true;
  elements.btnExportZip.textContent = '⏳ Gerando Pacote...';

  try {
    await ZipBuilder.generatePackage(state.questions, state.title);
  } finally {
    elements.btnExportZip.disabled = false;
    elements.btnExportZip.textContent = '📦 Gerar Pacote QTI (.zip)';
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

  // 2. Atualiza Botão Exportar
  elements.btnExportZip.disabled = state.questions.length === 0;

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

  // 5. Atualiza Lista de Questões
  if (state.questions.length === 0) {
    elements.questionsList.innerHTML = `
      <div class="empty-state">
        <p>Nenhuma questão cadastrada ainda.</p>
        <p class="subtitle">Cole o texto de uma questão ao lado e clique em "Adicionar ao JSON".</p>
      </div>
    `;
    return;
  }

  elements.questionsList.innerHTML = state.questions.map((q, idx) => {
    const isObj = q.type === 'multiple_choice';
    const badgeClass = isObj ? 'badge-obj' : 'badge-disc';
    const typeLabel = isObj ? 'Objetiva' : 'Discursiva';
    const isEditing = state.editingIndex === idx;
    const needsAdjustment = isObj && (q.needsCorrectAnswerAdjustment || !q.options.some(opt => opt.isCorrect));

    let optionsHtml = '';
    if (isObj && q.options.length > 0) {
      optionsHtml = `
        ${needsAdjustment ? `
          <div class="q-warning-alert" style="background: #fffbeb; border-left: 4px solid #f59e0b; color: #92400e; padding: 8px 12px; border-radius: 4px; font-size: 0.82rem; margin: 8px 0; display: flex; align-items: center; gap: 6px; font-weight: 600;">
            ⚠️ Ajustar alternativa correta (nenhuma alternativa com '*' foi sinalizada).
          </div>
        ` : ''}
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
      <div class="question-card ${isEditing ? 'question-card-editing' : ''} ${needsAdjustment ? 'question-card-warning' : ''}">
        <div class="q-card-header">
          <div class="q-card-title">
            <span class="q-badge ${badgeClass}">${typeLabel}</span>
            <strong>${q.title}</strong>
            ${needsAdjustment ? '<span class="badge-needs-adjustment" style="background: #fee2e2; color: #b91c1c; border: 1px solid #f87171; font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 12px; margin-left: 6px; display: inline-flex; align-items: center; gap: 3px;">⚠️ Ajustar alternativa correta</span>' : ''}
            ${isEditing ? '<span style="color: #2563eb; font-size: 0.78rem; font-weight: 600; margin-left: 6px;">(Editando no momento)</span>' : ''}
          </div>
          <div class="q-card-actions">
            <button class="btn-card-action btn-edit" onclick="editQuestion(${idx})" title="Editar esta questão">✏️</button>
            <button class="btn-card-action btn-remove" onclick="removeQuestion(${idx})" title="Remover questão">&times;</button>
          </div>
        </div>
        <div class="q-card-body">
          <div class="q-prompt">${formatCardHtml(q.prompt)}</div>
          ${optionsHtml}
          ${q.modelAnswer ? `<div class="q-model-answer"><strong>Padrão de Resposta:</strong><div class="q-formatted-content">${formatCardHtml(q.modelAnswer)}</div></div>` : ''}
          ${q.feedback ? `<div class="q-feedback"><strong>Feedback:</strong><div class="q-formatted-content">${formatCardHtml(q.feedback)}</div></div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// Inicia quando o DOM estiver carregado
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', init);
}

