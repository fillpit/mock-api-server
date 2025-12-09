/**
 * JSON Editor Component
 * - Real-time syntax validation
 * - One-click formatting
 * - Error highlighting
 */

class JsonEditor {
    constructor(container, options = {}) {
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        this.options = {
            placeholder: '{\n  "key": "value"\n}',
            onChange: null,
            onValidate: null,
            ...options
        };

        this.value = '';
        this.isValid = true;
        this.error = null;

        this.init();
    }

    init() {
        // Create editor structure
        this.container.innerHTML = `
      <div class="json-editor">
        <div class="json-editor-toolbar">
          <button type="button" class="btn btn-sm btn-outline json-format-btn" title="格式化 JSON">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <path d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
            <span>格式化</span>
          </button>
          <button type="button" class="btn btn-sm btn-outline json-minify-btn" title="压缩 JSON">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <path d="M4 12h16"/>
            </svg>
            <span>压缩</span>
          </button>
          <div class="json-editor-status">
            <span class="status-indicator"></span>
            <span class="status-text"></span>
          </div>
        </div>
        <div class="json-editor-wrapper">
          <div class="json-editor-line-numbers"></div>
          <textarea class="json-editor-textarea" spellcheck="false" placeholder="${this.options.placeholder}"></textarea>
        </div>
        <div class="json-editor-error hidden"></div>
      </div>
    `;

        // Get elements
        this.textarea = this.container.querySelector('.json-editor-textarea');
        this.lineNumbers = this.container.querySelector('.json-editor-line-numbers');
        this.errorDisplay = this.container.querySelector('.json-editor-error');
        this.statusIndicator = this.container.querySelector('.status-indicator');
        this.statusText = this.container.querySelector('.status-text');
        this.formatBtn = this.container.querySelector('.json-format-btn');
        this.minifyBtn = this.container.querySelector('.json-minify-btn');

        // Bind events
        this.textarea.addEventListener('input', () => this.handleInput());
        this.textarea.addEventListener('scroll', () => this.syncScroll());
        this.textarea.addEventListener('keydown', (e) => this.handleKeydown(e));
        this.formatBtn.addEventListener('click', () => this.format());
        this.minifyBtn.addEventListener('click', () => this.minify());

        // Initial line numbers
        this.updateLineNumbers();
        this.updateStatus();
    }

    handleInput() {
        this.value = this.textarea.value;
        this.validate();
        this.updateLineNumbers();

        if (this.options.onChange) {
            this.options.onChange(this.value, this.isValid, this.error);
        }
    }

    handleKeydown(e) {
        // Tab key handling
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = this.textarea.selectionStart;
            const end = this.textarea.selectionEnd;

            if (e.shiftKey) {
                // Outdent
                const lineStart = this.value.lastIndexOf('\n', start - 1) + 1;
                const lineContent = this.value.substring(lineStart, start);
                if (lineContent.startsWith('  ')) {
                    this.textarea.value = this.value.substring(0, lineStart) + this.value.substring(lineStart + 2);
                    this.textarea.selectionStart = this.textarea.selectionEnd = start - 2;
                }
            } else {
                // Indent
                this.textarea.value = this.value.substring(0, start) + '  ' + this.value.substring(end);
                this.textarea.selectionStart = this.textarea.selectionEnd = start + 2;
            }

            this.handleInput();
        }

        // Auto-pair brackets
        const pairs = { '{': '}', '[': ']', '"': '"' };
        if (pairs[e.key] && !e.ctrlKey && !e.metaKey) {
            const start = this.textarea.selectionStart;
            const end = this.textarea.selectionEnd;

            if (start === end) {
                e.preventDefault();
                const before = this.value.substring(0, start);
                const after = this.value.substring(end);
                this.textarea.value = before + e.key + pairs[e.key] + after;
                this.textarea.selectionStart = this.textarea.selectionEnd = start + 1;
                this.handleInput();
            }
        }
    }

    validate() {
        if (!this.value.trim()) {
            this.isValid = true;
            this.error = null;
            this.errorDisplay.classList.add('hidden');
            this.updateStatus();
            return true;
        }

        try {
            JSON.parse(this.value);
            this.isValid = true;
            this.error = null;
            this.errorDisplay.classList.add('hidden');
        } catch (e) {
            this.isValid = false;
            this.error = this.parseError(e);
            this.errorDisplay.textContent = this.error.message;
            this.errorDisplay.classList.remove('hidden');
        }

        this.updateStatus();

        if (this.options.onValidate) {
            this.options.onValidate(this.isValid, this.error);
        }

        return this.isValid;
    }

    parseError(e) {
        const message = e.message;
        let line = null;
        let column = null;

        // Try to extract position from error message
        const posMatch = message.match(/position\s+(\d+)/i);
        if (posMatch) {
            const pos = parseInt(posMatch[1], 10);
            const lines = this.value.substring(0, pos).split('\n');
            line = lines.length;
            column = lines[lines.length - 1].length + 1;
        }

        // Firefox format
        const lineMatch = message.match(/line\s+(\d+)\s+column\s+(\d+)/i);
        if (lineMatch) {
            line = parseInt(lineMatch[1], 10);
            column = parseInt(lineMatch[2], 10);
        }

        return {
            message: line ? `第 ${line} 行, 第 ${column} 列: ${message}` : message,
            line,
            column,
            raw: message
        };
    }

    updateLineNumbers() {
        const lines = this.value.split('\n');
        const lineCount = lines.length || 1;

        let html = '';
        for (let i = 1; i <= lineCount; i++) {
            const isErrorLine = this.error && this.error.line === i;
            html += `<div class="line-number${isErrorLine ? ' error-line' : ''}">${i}</div>`;
        }
        this.lineNumbers.innerHTML = html;
    }

    updateStatus() {
        if (!this.value.trim()) {
            this.statusIndicator.className = 'status-indicator empty';
            this.statusText.textContent = '空';
        } else if (this.isValid) {
            this.statusIndicator.className = 'status-indicator valid';
            this.statusText.textContent = 'JSON 有效';
        } else {
            this.statusIndicator.className = 'status-indicator invalid';
            this.statusText.textContent = 'JSON 无效';
        }
    }

    syncScroll() {
        this.lineNumbers.scrollTop = this.textarea.scrollTop;
    }

    format() {
        if (!this.value.trim()) return;

        try {
            const parsed = JSON.parse(this.value);
            this.textarea.value = JSON.stringify(parsed, null, 2);
            this.handleInput();
            this.showToast('JSON 已格式化', 'success');
        } catch (e) {
            this.showToast('无法格式化: JSON 语法错误', 'error');
        }
    }

    minify() {
        if (!this.value.trim()) return;

        try {
            const parsed = JSON.parse(this.value);
            this.textarea.value = JSON.stringify(parsed);
            this.handleInput();
            this.showToast('JSON 已压缩', 'success');
        } catch (e) {
            this.showToast('无法压缩: JSON 语法错误', 'error');
        }
    }

    showToast(message, type = 'info') {
        // Use global toast if available
        if (window.showToast) {
            window.showToast(message, type);
        }
    }

    getValue() {
        return this.value;
    }

    setValue(value) {
        this.value = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
        this.textarea.value = this.value;
        this.validate();
        this.updateLineNumbers();
    }

    getParsedValue() {
        try {
            return JSON.parse(this.value);
        } catch {
            return null;
        }
    }

    isValidJson() {
        return this.isValid;
    }

    focus() {
        this.textarea.focus();
    }

    clear() {
        this.setValue('');
    }
}

// Export for use
window.JsonEditor = JsonEditor;
