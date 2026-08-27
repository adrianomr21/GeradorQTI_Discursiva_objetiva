/**
 * logger.js
 * Módulo responsável por exibir mensagens de log tanto no console do navegador
 * quanto no painel visual de monitoramento na interface web.
 */

export const Logger = {
  containerId: 'log-console',

  /**
   * Adiciona uma mensagem de log formatada com timestamp.
   * @param {string} message - Texto da mensagem
   * @param {'info' | 'success' | 'warn' | 'error'} type - Tipo do log
   */
  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString('pt-BR');
    const prefixMap = {
      info: 'ℹ️ [INFO]',
      success: '✅ [SUCESSO]',
      warn: '⚠️ [AVISO]',
      error: '❌ [ERRO]'
    };

    const prefix = prefixMap[type] || '[LOG]';
    const formattedConsole = `${prefix} [${timestamp}] ${message}`;

    // 1. Log no Console do Navegador
    if (type === 'error') console.error(formattedConsole);
    else if (type === 'warn') console.warn(formattedConsole);
    else console.log(formattedConsole);

    // 2. Log no Painel Visual (DOM se disponível)
    if (typeof document !== 'undefined') {
      const logBox = document.getElementById(this.containerId);
      if (logBox) {
        const line = document.createElement('div');
        line.className = `log-line log-${type}`;
        line.innerHTML = `<span class="log-time">${timestamp}</span> <span class="log-badge ${type}">${prefix}</span> <span class="log-text">${this.escapeHtml(message)}</span>`;
        logBox.appendChild(line);
        logBox.scrollTop = logBox.scrollHeight;
      }
    }
  },

  info(msg) {
    this.log(msg, 'info');
  },

  success(msg) {
    this.log(msg, 'success');
  },

  warn(msg) {
    this.log(msg, 'warn');
  },

  error(msg) {
    this.log(msg, 'error');
  },

  clear() {
    const logBox = document.getElementById(this.containerId);
    if (logBox) {
      logBox.innerHTML = '';
      this.info('Console de logs limpo.');
    }
  },

  escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
};
