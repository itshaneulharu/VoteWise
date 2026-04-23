/**
 * VoteWise — Main Application Controller
 * Handles chat UI, message rendering, events, and state management.
 */

const App = {
  // State
  chatHistory: [],
  isProcessing: false,

  // Quick action prompts
  quickActions: {
    election: 'Explain the election process step by step',
    checklist: 'Give me a personalized voter checklist — I\'m a first-time voter',
    booth: 'How do I find my polling booth and check my voter registration?',
    faq: 'What are the most common questions first-time voters have?'
  },

  // DOM references (set in init)
  els: {},

  /**
   * Initialize the application.
   */
  init() {
    this._cacheDOM();
    this._bindEvents();
    this._checkApiKey();
    this._autoResizeInput();
  },

  /**
   * Cache frequently used DOM elements.
   */
  _cacheDOM() {
    this.els = {
      chatMessages: document.getElementById('chat-messages'),
      chatInput: document.getElementById('chat-input'),
      sendBtn: document.getElementById('send-btn'),
      welcomeScreen: document.getElementById('welcome-screen'),
      modalOverlay: document.getElementById('api-key-modal'),
      apiKeyInput: document.getElementById('api-key-input'),
      apiKeySaveBtn: document.getElementById('api-key-save'),
      apiKeyError: document.getElementById('api-key-error'),
      newChatBtn: document.getElementById('new-chat-btn'),
      settingsBtn: document.getElementById('settings-btn'),
      menuToggle: document.getElementById('menu-toggle'),
      sidebar: document.getElementById('sidebar'),
      sidebarOverlay: document.getElementById('sidebar-overlay'),
    };
  },

  /**
   * Bind all event listeners.
   */
  _bindEvents() {
    // Send message
    this.els.sendBtn.addEventListener('click', () => this._handleSend());
    this.els.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this._handleSend();
      }
    });

    // Auto-resize textarea
    this.els.chatInput.addEventListener('input', () => this._autoResizeInput());

    // Quick actions
    document.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (this.quickActions[action]) {
          this.els.chatInput.value = this.quickActions[action];
          this._handleSend();
        }
      });
    });

    // API key modal
    this.els.apiKeySaveBtn.addEventListener('click', () => this._handleApiKeySave());
    this.els.apiKeyInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._handleApiKeySave();
    });

    // New chat
    this.els.newChatBtn.addEventListener('click', () => this._handleNewChat());

    // Settings (re-open API key modal)
    this.els.settingsBtn.addEventListener('click', () => this._showModal());

    // Mobile sidebar
    this.els.menuToggle.addEventListener('click', () => this._toggleSidebar());
    if (this.els.sidebarOverlay) {
      this.els.sidebarOverlay.addEventListener('click', () => this._toggleSidebar());
    }
  },

  /**
   * Check if API key exists; show modal if not.
   */
  _checkApiKey() {
    if (!GeminiService.hasApiKey()) {
      this._showModal();
    }
  },

  /**
   * Show the API key modal.
   */
  _showModal() {
    this.els.modalOverlay.classList.remove('hidden');
    this.els.apiKeyInput.value = GeminiService.getApiKey() || '';
    this.els.apiKeyError.style.display = 'none';
    setTimeout(() => this.els.apiKeyInput.focus(), 100);
  },

  /**
   * Hide the API key modal.
   */
  _hideModal() {
    this.els.modalOverlay.classList.add('hidden');
  },

  /**
   * Handle saving the API key.
   */
  async _handleApiKeySave() {
    const key = this.els.apiKeyInput.value.trim();
    if (!key) {
      this._showApiKeyError('Please enter an API key');
      return;
    }

    this.els.apiKeySaveBtn.textContent = 'Validating...';
    this.els.apiKeySaveBtn.disabled = true;

    const result = await GeminiService.validateApiKey(key);

    if (result.valid) {
      GeminiService.setApiKey(key);
      this._hideModal();
      this.els.chatInput.focus();
    } else {
      this._showApiKeyError('Invalid API key. Please check and try again.');
    }

    this.els.apiKeySaveBtn.textContent = 'Start Chatting →';
    this.els.apiKeySaveBtn.disabled = false;
  },

  /**
   * Show an error in the API key modal.
   */
  _showApiKeyError(msg) {
    this.els.apiKeyError.textContent = msg;
    this.els.apiKeyError.style.display = 'block';
  },

  /**
   * Handle sending a message.
   */
  async _handleSend() {
    const text = this.els.chatInput.value.trim();
    if (!text || this.isProcessing) return;

    if (!GeminiService.hasApiKey()) {
      this._showModal();
      return;
    }

    // Hide welcome screen
    if (this.els.welcomeScreen) {
      this.els.welcomeScreen.remove();
      this.els.welcomeScreen = null;
    }

    // Clear input
    this.els.chatInput.value = '';
    this._autoResizeInput();

    // Add user message
    this._addMessage('user', text);
    this.chatHistory.push({ role: 'user', text });

    // Show typing indicator
    this.isProcessing = true;
    this._updateSendBtn();
    const typingEl = this._showTyping();

    try {
      // Send to Gemini (pass history without current message since it's included)
      const historyForApi = this.chatHistory.slice(0, -1);
      const response = await GeminiService.sendMessage(text, historyForApi);

      // Remove typing indicator
      typingEl.remove();

      // Add bot response
      this._addMessage('bot', response);
      this.chatHistory.push({ role: 'model', text: response });
    } catch (error) {
      typingEl.remove();
      const errorMsg = GeminiService.getErrorMessage(error);
      this._addMessage('bot', errorMsg);

      // If API key is invalid, show modal
      if (error.message === 'API_KEY_INVALID' || error.message === 'API_KEY_MISSING') {
        setTimeout(() => this._showModal(), 1500);
      }
    }

    this.isProcessing = false;
    this._updateSendBtn();
    this.els.chatInput.focus();
  },

  /**
   * Add a message bubble to the chat.
   * @param {'user'|'bot'} role
   * @param {string} text
   */
  _addMessage(role, text) {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${role}`;

    const avatarEl = document.createElement('div');
    avatarEl.className = 'message-avatar';
    avatarEl.textContent = role === 'bot' ? '🗳️' : '👤';

    const contentEl = document.createElement('div');
    contentEl.className = 'message-content';

    if (role === 'bot') {
      contentEl.innerHTML = MarkdownRenderer.render(text);
    } else {
      contentEl.textContent = text;
    }

    messageEl.appendChild(avatarEl);
    messageEl.appendChild(contentEl);
    this.els.chatMessages.appendChild(messageEl);

    this._scrollToBottom();
  },

  /**
   * Show typing indicator and return the element (for removal).
   */
  _showTyping() {
    const el = document.createElement('div');
    el.className = 'typing-indicator';
    el.innerHTML = `
      <div class="message-avatar" style="background: var(--gradient); box-shadow: var(--shadow-glow-primary);">🗳️</div>
      <div class="typing-dots">
        <span></span><span></span><span></span>
      </div>
    `;
    this.els.chatMessages.appendChild(el);
    this._scrollToBottom();
    return el;
  },

  /**
   * Scroll chat to the bottom.
   */
  _scrollToBottom() {
    requestAnimationFrame(() => {
      this.els.chatMessages.scrollTop = this.els.chatMessages.scrollHeight;
    });
  },

  /**
   * Update send button state.
   */
  _updateSendBtn() {
    this.els.sendBtn.disabled = this.isProcessing;
  },

  /**
   * Auto-resize the textarea based on content.
   */
  _autoResizeInput() {
    const input = this.els.chatInput;
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  },

  /**
   * Start a new chat session.
   */
  _handleNewChat() {
    this.chatHistory = [];
    this.els.chatMessages.innerHTML = '';

    // Re-add welcome screen
    const welcome = document.createElement('div');
    welcome.className = 'welcome-screen';
    welcome.id = 'welcome-screen';
    welcome.innerHTML = `
      <div class="welcome-icon">🗳️</div>
      <h1 class="welcome-title">Welcome to VoteWise</h1>
      <p class="welcome-subtitle">Your personal AI election guide. Ask me anything about voting, elections, and your civic rights.</p>
      <div class="quick-actions">
        <button class="quick-action" data-action="election">
          <span class="quick-action-icon">🏛️</span>
          <div>
            <div class="quick-action-label">Election Process</div>
            <div class="quick-action-desc">Step-by-step guide to how elections work</div>
          </div>
        </button>
        <button class="quick-action" data-action="checklist">
          <span class="quick-action-icon">✅</span>
          <div>
            <div class="quick-action-label">Voter Checklist</div>
            <div class="quick-action-desc">Get your personalized preparation list</div>
          </div>
        </button>
        <button class="quick-action" data-action="booth">
          <span class="quick-action-icon">📍</span>
          <div>
            <div class="quick-action-label">Polling Booth</div>
            <div class="quick-action-desc">Find your booth & verify your registration</div>
          </div>
        </button>
        <button class="quick-action" data-action="faq">
          <span class="quick-action-icon">💬</span>
          <div>
            <div class="quick-action-label">Common Doubts</div>
            <div class="quick-action-desc">Quick answers to first-time voter questions</div>
          </div>
        </button>
      </div>
    `;
    this.els.chatMessages.appendChild(welcome);
    this.els.welcomeScreen = welcome;

    // Re-bind quick action buttons
    welcome.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (this.quickActions[action]) {
          this.els.chatInput.value = this.quickActions[action];
          this._handleSend();
        }
      });
    });

    // Close sidebar on mobile
    this.els.sidebar.classList.remove('open');
    if (this.els.sidebarOverlay) this.els.sidebarOverlay.classList.remove('open');
  },

  /**
   * Toggle sidebar on mobile.
   */
  _toggleSidebar() {
    this.els.sidebar.classList.toggle('open');
    if (this.els.sidebarOverlay) {
      this.els.sidebarOverlay.classList.toggle('open');
    }
  }
};

// Boot the app
document.addEventListener('DOMContentLoaded', () => App.init());
