/**
 * app.js
 * Controlador principal da aplicação.
 * Conecta os eventos da interface com os módulos de Parser, QTI e Logger.
 */

import { Logger } from './logger.js';
import { QuestionParser } from './parser.js';
import { ZipBuilder } from './qti/zipBuilder.js';

// Estado global da aplicação
const state = {
  title: 'Atividade Avaliativa',
  questions: []
};

// Exemplos pré-configurados para teste rápido
const SAMPLES = {
  objective: `Questão 1
Qual das seguintes linguagens é padrão para manipulação de bancos de dados relacionais?
*a) SQL
b) HTML
c) CSS
d) Python
e) JSON
Feedback: SQL (Structured Query Language) é a linguagem padrão utilizada para consultas e manipulações em bancos de dados relacionais.`,

  discursive: `Questão 2
Explique a importância da normalização de dados (1FN, 2FN e 3FN) no projeto de bancos de dados relacionais e cite um benefício prático.

Padrão de resposta:
A normalização é o processo de organização dos dados para minimizar redundâncias e dependências incoerentes. O benefício prático inclui maior integridade dos dados e otimização do espaço em disco.

Feedback:
Muito bem! A resposta deve destacar a eliminação de anomalias de inserção, alteração e exclusão.`
};

// Elementos da Interface
const elements = {
  activityTitle: document.getElementById('activity-title'),
  questionInput: document.getElementById('question-input'),
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
  Logger.info('Sistema Gerador QTI 2.1 inicializado com sucesso.');

  // Botão Adicionar Questão
  elements.btnAddQuestion.addEventListener('click', handleAddQuestion);

  // Botão Limpar Entrada
  elements.btnClearInput.addEventListener('click', () => {
    elements.questionInput.value = '';
    elements.questionInput.focus();
    Logger.info('Campo de texto limpo.');
  });

  // Botão Exportar Pacote QTI
  elements.btnExportZip.addEventListener('click', handleExportZip);

  // Botão Limpar Tudo
  elements.btnClearAll.addEventListener('click', handleClearAll);

  // Botões de Exemplos Rápidos
  elements.btnSampleObj.addEventListener('click', () => {
    elements.questionInput.value = SAMPLES.objective;
    Logger.info('Exemplo de questão Objetiva carregado no editor.');
  });

  elements.btnSampleDisc.addEventListener('click', () => {
    elements.questionInput.value = SAMPLES.discursive;
    Logger.info('Exemplo de questão Discursiva carregado no editor.');
  });

  // Botão Limpar Logs
  elements.btnClearLogs.addEventListener('click', () => {
    Logger.clear();
  });

  // Alteração do título da atividade
  elements.activityTitle.addEventListener('input', (e) => {
    state.title = e.target.value.trim() || 'Atividade Avaliativa';
  });

  render();
}

/**
 * Adiciona a questão colada ao estado (JSON)
 */
function handleAddQuestion() {
  const text = elements.questionInput.value.trim();
  if (!text) {
    Logger.warn('Por favor, cole ou digite o texto da questão antes de adicionar.');
    return;
  }

  const nextIndex = state.questions.length + 1;
  const parsed = QuestionParser.parse(text, nextIndex);

  if (parsed) {
    state.questions.push(parsed);
    elements.questionInput.value = '';
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
