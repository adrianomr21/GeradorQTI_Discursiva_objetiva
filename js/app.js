import { Logger } from './logger.js';
import { QuestionParser } from './parser.js';
import { ZipBuilder } from './qti/zipBuilder.js';
import { RichTextEditor } from './editor/richTextEditor.js';

// Estado global da aplicação
const state = {
  title: 'Atividade Avaliativa',
  questions: []
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

// Elementos da Interface
const elements = {
  activityTitle: document.getElementById('activity-title'),
  btnAddQuestion: document.getElementById('btn-add-question'),
  btnClearInput: document.getElementById('btn-clear-input'),
  btnExportZip: document.getElementById('btn-export-zip'),
  btnClearAll: document.getElementById('btn-clear-all'),
  btnSampleObj: document.getElementById('btn-sample-obj'),
  btnSampleDisc: document.getElementById('btn-sample-disc'),
  jsonPreview: document.getElementById('json-preview'),
  questionsList: document.getElementById('questions-list'),
  questionCount: document.getElementById('question-count'),
  btnClearLogs: document.getElementById('btn-clear-logs')
};

/**
 * Inicializa a aplicação e registra os eventos
 */
function init() {
  // 1. Inicializa o Editor de Texto Rico
  RichTextEditor.init({
    editorId: 'editor-content',
    sourceId: 'editor-source',
    imageInputId: 'editor-image-input'
  });

  // 2. Conecta os botões da barra de ferramentas do Editor
  document.getElementById('btn-tool-bold')?.addEventListener('click', () => RichTextEditor.execCmd('bold'));
  document.getElementById('btn-tool-italic')?.addEventListener('click', () => RichTextEditor.execCmd('italic'));
  document.getElementById('btn-tool-underline')?.addEventListener('click', () => RichTextEditor.execCmd('underline'));
  document.getElementById('btn-tool-strike')?.addEventListener('click', () => RichTextEditor.execCmd('strikeThrough'));
  document.getElementById('btn-tool-sup')?.addEventListener('click', () => RichTextEditor.execCmd('superscript'));
  document.getElementById('btn-tool-sub')?.addEventListener('click', () => RichTextEditor.execCmd('subscript'));
  document.getElementById('btn-tool-ul')?.addEventListener('click', () => RichTextEditor.execCmd('insertUnorderedList'));
  document.getElementById('btn-tool-ol')?.addEventListener('click', () => RichTextEditor.execCmd('insertOrderedList'));
  document.getElementById('btn-tool-table')?.addEventListener('click', () => RichTextEditor.insertTable(3, 3));
  document.getElementById('btn-tool-link')?.addEventListener('click', () => RichTextEditor.insertLink());
  document.getElementById('btn-tool-image')?.addEventListener('click', () => RichTextEditor.triggerImageUpload());
  document.getElementById('btn-tool-clear')?.addEventListener('click', () => RichTextEditor.clearFormatting());
  document.getElementById('btn-tool-source')?.addEventListener('click', () => RichTextEditor.toggleSourceMode());

  // 3. Botão Adicionar Questão
  elements.btnAddQuestion.addEventListener('click', handleAddQuestion);

  // 4. Botão Limpar Entrada
  elements.btnClearInput.addEventListener('click', () => {
    RichTextEditor.clear();
    Logger.info('Editor de texto limpo.');
  });

  // 5. Botão Exportar Pacote QTI
  elements.btnExportZip.addEventListener('click', handleExportZip);

  // 6. Botão Limpar Tudo
  elements.btnClearAll.addEventListener('click', handleClearAll);

  // 7. Botões de Exemplos Rápidos
  elements.btnSampleObj.addEventListener('click', () => {
    RichTextEditor.setHtml(SAMPLES.objective);
    Logger.info('Exemplo formatado de questão Objetiva carregado no editor.');
  });

  elements.btnSampleDisc.addEventListener('click', () => {
    RichTextEditor.setHtml(SAMPLES.discursive);
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
 * Adiciona a questão colada ao estado (JSON)
 */
function handleAddQuestion() {
  const content = RichTextEditor.getHtml().trim();
  if (!content) {
    Logger.warn('Por favor, digite ou cole o conteúdo da questão antes de adicionar.');
    return;
  }

  const nextIndex = state.questions.length + 1;
  const parsed = QuestionParser.parse(content, nextIndex);

  if (parsed) {
    state.questions.push(parsed);
    RichTextEditor.clear();
    render();
    Logger.success(`Questão #${parsed.id} adicionada à lista.`);
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
    render();
    Logger.info('Todas as questões foram removidas.');
  }
}

/**
 * Remove uma questão específica pelo índice
 */
window.removeQuestion = function(index) {
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
};

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

  // 4. Atualiza Lista de Questões
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

    let optionsHtml = '';
    if (isObj && q.options.length > 0) {
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

    return `
      <div class="question-card">
        <div class="q-card-header">
          <div class="q-card-title">
            <span class="q-badge ${badgeClass}">${typeLabel}</span>
            <strong>${q.title}</strong>
          </div>
          <button class="btn-remove" onclick="removeQuestion(${idx})" title="Remover questão">&times;</button>
        </div>
        <div class="q-card-body">
          <p class="q-prompt">${q.prompt.replace(/\n/g, '<br>')}</p>
          ${optionsHtml}
          ${q.modelAnswer ? `<div class="q-model-answer"><strong>Padrão de Resposta:</strong><br>${q.modelAnswer.replace(/\n/g, '<br>')}</div>` : ''}
          ${q.feedback ? `<div class="q-feedback"><strong>Feedback:</strong><br>${q.feedback.replace(/\n/g, '<br>')}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// Inicia quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', init);
