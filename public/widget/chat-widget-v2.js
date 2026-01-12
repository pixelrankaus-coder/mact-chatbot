(function() {
  'use strict';

  const WIDGET_VERSION = '2.0.0';

  // Get script configuration
  const scriptTag = document.currentScript;
  const apiBase = scriptTag?.getAttribute('data-api-base') || scriptTag?.src.replace(/\/widget\/chat-widget-v2\.js.*$/, '') || '';

  // ============================================================
  // MACt Chat Widget - Custom Element with Shadow DOM
  // ============================================================
  class MActChatWidget extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });

      // State
      this.isOpen = false;
      this.isTyping = false;
      this.settings = null;
      this.conversation = null;
      this.messages = [];
      this.visitorId = this.getVisitorId();
      this.pollInterval = null;
      this.lastMessageTime = null;
      this.isSending = false;
    }

    connectedCallback() {
      this.init();
    }

    disconnectedCallback() {
      this.stopPolling();
    }

    // ============================================================
    // Initialization
    // ============================================================
    async init() {
      await this.loadSettings();
      this.render();
      this.attachEventListeners();
      console.log(`MACt Chat Widget v${WIDGET_VERSION} initialized`);
    }

    // ============================================================
    // Visitor ID Management
    // ============================================================
    getVisitorId() {
      const key = 'mact_visitor_id';
      let id = localStorage.getItem(key);
      if (!id) {
        id = 'visitor_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
        localStorage.setItem(key, id);
      }
      return id;
    }

    // ============================================================
    // Settings
    // ============================================================
    async loadSettings() {
      try {
        const response = await fetch(`${apiBase}/api/widget/settings`);
        if (!response.ok) throw new Error('Failed to fetch settings');
        this.settings = await response.json();
      } catch (error) {
        console.error('MACt Widget: Failed to load settings', error);
        this.settings = {
          appearance: {
            primaryColor: '#3b82f6',
            companyName: 'Support',
          },
          aiAgent: {
            enabled: true,
            name: 'Assistant',
            welcomeMessage: 'Hi there! How can I help you today?',
          },
        };
      }
    }

    get primaryColor() {
      return this.settings?.appearance?.primaryColor || '#3b82f6';
    }

    get companyName() {
      return this.settings?.appearance?.companyName || this.settings?.aiAgent?.name || 'Support';
    }

    get offsetX() {
      return this.settings?.appearance?.offsetX ?? 20;
    }

    get offsetY() {
      return this.settings?.appearance?.offsetY ?? 20;
    }

    // ============================================================
    // Conversation & Messages API
    // ============================================================
    async createConversation() {
      try {
        const response = await fetch(`${apiBase}/api/widget/conversations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visitorId: this.visitorId }),
        });
        if (!response.ok) throw new Error('Failed to create conversation');
        const data = await response.json();
        this.conversation = data.conversation;
        return this.conversation;
      } catch (error) {
        console.error('MACt Widget: Failed to create conversation', error);
        return null;
      }
    }

    async fetchMessages() {
      if (!this.conversation) return;
      try {
        const url = this.lastMessageTime
          ? `${apiBase}/api/widget/conversations/${this.conversation.id}/messages?since=${encodeURIComponent(this.lastMessageTime)}`
          : `${apiBase}/api/widget/conversations/${this.conversation.id}/messages`;

        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch messages');
        const data = await response.json();

        if (data.messages?.length > 0) {
          const existingIds = new Set(this.messages.filter(m => !m.id.startsWith('temp_')).map(m => m.id));
          const newMessages = data.messages.filter(m => !existingIds.has(m.id));

          if (!this.lastMessageTime) {
            const tempMessages = this.messages.filter(m => m.id.startsWith('temp_'));
            this.messages = [...data.messages, ...tempMessages];
          } else if (newMessages.length > 0) {
            this.messages = [...this.messages, ...newMessages];
          }

          this.lastMessageTime = data.messages[data.messages.length - 1].created_at;
          this.renderMessages();
        }
      } catch (error) {
        console.error('MACt Widget: Failed to fetch messages', error);
      }
    }

    async sendMessage(content) {
      if (!content.trim() || !this.conversation || this.isSending) return;
      this.isSending = true;
      this.stopPolling();

      // Optimistic UI update
      const tempMessage = {
        id: 'temp_' + Date.now(),
        sender_type: 'visitor',
        content: content.trim(),
        created_at: new Date().toISOString(),
      };
      this.messages.push(tempMessage);
      this.renderMessages();
      this.scrollToBottom();

      // Show typing
      this.setTyping(true);

      try {
        const response = await fetch(`${apiBase}/api/widget/conversations/${this.conversation.id}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: content.trim(), visitorId: this.visitorId }),
        });

        if (!response.ok) throw new Error('Failed to send message');
        const data = await response.json();

        // Replace temp message
        const tempIndex = this.messages.findIndex(m => m.id === tempMessage.id);
        if (tempIndex !== -1 && data.userMessage) {
          this.messages[tempIndex] = data.userMessage;
          this.lastMessageTime = data.userMessage.created_at;
        }

        // Add bot response
        if (data.botMessage) {
          this.messages.push(data.botMessage);
          this.lastMessageTime = data.botMessage.created_at;
        }

        this.setTyping(false);
        this.renderMessages();
        this.scrollToBottom();
      } catch (error) {
        console.error('MACt Widget: Failed to send message', error);
        this.setTyping(false);
        const tempIndex = this.messages.findIndex(m => m.id === tempMessage.id);
        if (tempIndex !== -1) {
          this.messages[tempIndex].error = true;
          this.renderMessages();
        }
      } finally {
        this.isSending = false;
        this.startPolling();
      }
    }

    // ============================================================
    // Polling
    // ============================================================
    startPolling() {
      if (this.pollInterval) return;
      this.pollInterval = setInterval(() => this.fetchMessages(), 3000);
    }

    stopPolling() {
      if (this.pollInterval) {
        clearInterval(this.pollInterval);
        this.pollInterval = null;
      }
    }

    // ============================================================
    // UI State
    // ============================================================
    setTyping(typing) {
      this.isTyping = typing;
      const indicator = this.shadowRoot.querySelector('.mact-typing');
      if (indicator) {
        indicator.style.display = typing ? 'flex' : 'none';
      }
    }

    scrollToBottom() {
      const container = this.shadowRoot.querySelector('.mact-messages');
      if (container) {
        setTimeout(() => {
          container.scrollTop = container.scrollHeight;
        }, 50);
      }
    }

    // ============================================================
    // Toggle Open/Close
    // ============================================================
    toggle() {
      this.isOpen = !this.isOpen;
      const chatWindow = this.shadowRoot.querySelector('.mact-chat-window');
      const launcher = this.shadowRoot.querySelector('.mact-launcher');

      if (chatWindow) {
        chatWindow.classList.toggle('open', this.isOpen);
      }

      if (launcher) {
        launcher.classList.toggle('open', this.isOpen);
      }

      if (this.isOpen) {
        if (!this.conversation) {
          this.initConversation();
        }
        this.startPolling();
        this.scrollToBottom();
        const input = this.shadowRoot.querySelector('.mact-input');
        if (input) setTimeout(() => input.focus(), 100);
      } else {
        this.stopPolling();
      }
    }

    async initConversation() {
      await this.createConversation();
      if (this.conversation) {
        await this.fetchMessages();
      }
    }

    // ============================================================
    // Render
    // ============================================================
    render() {
      const color = this.primaryColor;

      this.shadowRoot.innerHTML = `
        <style>${this.getStyles()}</style>

        <!-- Chat Window -->
        <div class="mact-chat-window">
          <div class="mact-chat-header">
            <div class="mact-header-avatar">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 8V4H8"/><rect x="8" y="8" width="8" height="12" rx="2"/><circle cx="10" cy="13" r="1"/><circle cx="14" cy="13" r="1"/>
              </svg>
            </div>
            <div class="mact-header-info">
              <h3>${this.companyName}</h3>
              <p>We typically reply within minutes</p>
            </div>
            <button class="mact-chat-close" aria-label="Close chat">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <div class="mact-messages"></div>

          <div class="mact-typing" style="display: none;">
            <div class="mact-typing-avatar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 8V4H8"/><rect x="8" y="8" width="8" height="12" rx="2"/><circle cx="10" cy="13" r="1"/><circle cx="14" cy="13" r="1"/>
              </svg>
            </div>
            <div class="mact-typing-bubble">
              <span></span><span></span><span></span>
            </div>
          </div>

          <div class="mact-input-area">
            <div class="mact-input-row">
              <input type="text" class="mact-input" placeholder="Type your message..." />
              <button class="mact-send-btn" aria-label="Send message">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                </svg>
              </button>
            </div>
            <button class="mact-handoff-link">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              Talk to a human
            </button>
          </div>

          <div class="mact-footer">
            Powered by <a href="https://mact.au" target="_blank" rel="noopener">MACt</a>
            <span class="mact-version">v${WIDGET_VERSION}</span>
          </div>
        </div>

        <!-- Launcher Button -->
        <button class="mact-launcher" aria-label="Open chat">
          <svg class="mact-icon-chat" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <svg class="mact-icon-close" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      `;

      this.renderMessages();
    }

    renderMessages() {
      const container = this.shadowRoot.querySelector('.mact-messages');
      if (!container) return;

      const color = this.primaryColor;

      container.innerHTML = this.messages.map(msg => {
        const senderType = msg.sender_type || msg.sender;
        const isVisitor = senderType === 'visitor' || senderType === 'user';
        const isSystem = senderType === 'system';
        const hasError = msg.error;

        if (isSystem) {
          return `
            <div class="mact-message mact-message-system">
              <div class="mact-system-bubble">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
                </svg>
                <span>${msg.content}</span>
              </div>
            </div>
          `;
        }

        if (isVisitor) {
          return `
            <div class="mact-message mact-message-visitor${hasError ? ' mact-message-error' : ''}">
              <div class="mact-bubble mact-bubble-visitor" style="background-color: ${color};">
                ${msg.content}
                ${hasError ? '<div class="mact-error-text">Failed to send</div>' : ''}
              </div>
            </div>
          `;
        }

        // AI/Agent message
        return `
          <div class="mact-message mact-message-assistant">
            <div class="mact-avatar" style="background-color: ${color}20; color: ${color};">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 8V4H8"/><rect x="8" y="8" width="8" height="12" rx="2"/><circle cx="10" cy="13" r="1"/><circle cx="14" cy="13" r="1"/>
              </svg>
            </div>
            <div class="mact-bubble mact-bubble-assistant">
              ${msg.content}
            </div>
          </div>
        `;
      }).join('');

      this.scrollToBottom();
    }

    // ============================================================
    // Event Listeners
    // ============================================================
    attachEventListeners() {
      // Launcher click
      const launcher = this.shadowRoot.querySelector('.mact-launcher');
      launcher?.addEventListener('click', () => this.toggle());

      // Close button
      const closeBtn = this.shadowRoot.querySelector('.mact-chat-close');
      closeBtn?.addEventListener('click', () => this.toggle());

      // Send message
      const input = this.shadowRoot.querySelector('.mact-input');
      const sendBtn = this.shadowRoot.querySelector('.mact-send-btn');

      input?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const message = input.value.trim();
          if (message) {
            this.sendMessage(message);
            input.value = '';
          }
        }
      });

      sendBtn?.addEventListener('click', () => {
        const message = input?.value.trim();
        if (message) {
          this.sendMessage(message);
          input.value = '';
        }
      });

      // Handoff link
      const handoffLink = this.shadowRoot.querySelector('.mact-handoff-link');
      handoffLink?.addEventListener('click', () => this.showHandoffForm());
    }

    showHandoffForm() {
      const content = this.shadowRoot.querySelector('.mact-messages');
      if (!content) return;

      // Create overlay
      const overlay = document.createElement('div');
      overlay.className = 'mact-handoff-overlay';
      overlay.innerHTML = `
        <div class="mact-handoff-form">
          <h4>Talk to a Human</h4>
          <p>Leave your details and we'll get back to you shortly.</p>
          <input type="text" class="mact-handoff-name" placeholder="Your name" />
          <input type="email" class="mact-handoff-email" placeholder="Your email" />
          <textarea class="mact-handoff-message" placeholder="How can we help? (optional)" rows="3"></textarea>
          <div class="mact-handoff-buttons">
            <button class="mact-handoff-cancel">Cancel</button>
            <button class="mact-handoff-submit">Connect Me</button>
          </div>
        </div>
      `;

      content.parentElement.appendChild(overlay);

      // Event listeners
      overlay.querySelector('.mact-handoff-cancel').addEventListener('click', () => overlay.remove());
      overlay.querySelector('.mact-handoff-submit').addEventListener('click', async () => {
        const name = overlay.querySelector('.mact-handoff-name').value;
        const email = overlay.querySelector('.mact-handoff-email').value;
        const message = overlay.querySelector('.mact-handoff-message').value;

        if (!email) {
          alert('Please enter your email address');
          return;
        }

        const btn = overlay.querySelector('.mact-handoff-submit');
        btn.textContent = 'Connecting...';
        btn.disabled = true;

        await this.requestHandoff(name, email, message);
        overlay.remove();
      });
    }

    async requestHandoff(name, email, message) {
      if (!this.conversation) return;

      try {
        const response = await fetch(`${apiBase}/api/widget/conversations/${this.conversation.id}/handoff`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            visitorName: name,
            visitorEmail: email,
            message: message,
            reason: 'user_requested',
          }),
        });

        const data = await response.json();

        if (data.success) {
          this.messages.push({
            id: 'handoff_' + Date.now(),
            sender_type: 'system',
            content: data.message || 'Your request has been submitted. An agent will be with you shortly.',
            created_at: new Date().toISOString(),
          });
          this.renderMessages();
          this.scrollToBottom();
        }
      } catch (error) {
        console.error('MACt Widget: Handoff request failed', error);
      }
    }

    // ============================================================
    // Styles
    // ============================================================
    getStyles() {
      const color = this.primaryColor;
      const offsetX = this.offsetX;
      const offsetY = this.offsetY;

      return `
        :host {
          --primary-color: ${color};
          --offset-x: ${offsetX}px;
          --offset-y: ${offsetY}px;

          all: initial;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif;
          font-size: 14px;
          line-height: 1.5;
          color: #1e293b;
        }

        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        /* ========================================
           Launcher Button
           ======================================== */
        .mact-launcher {
          position: fixed;
          bottom: var(--offset-y);
          right: var(--offset-x);
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: var(--primary-color);
          border: none;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s, box-shadow 0.2s;
          z-index: 2147483647;
        }

        .mact-launcher:hover {
          transform: scale(1.05);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
        }

        .mact-launcher svg {
          color: white;
        }

        .mact-launcher .mact-icon-close {
          display: none;
        }

        .mact-launcher.open .mact-icon-chat {
          display: none;
        }

        .mact-launcher.open .mact-icon-close {
          display: block;
        }

        /* ========================================
           Chat Window
           ======================================== */
        .mact-chat-window {
          position: fixed;
          bottom: calc(var(--offset-y) + 70px);
          right: var(--offset-x);
          width: 380px;
          height: 550px;
          max-height: calc(100vh - 120px);
          background: white;
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          z-index: 2147483646;
          opacity: 0;
          transform: translateY(20px) scale(0.95);
          transition: opacity 0.3s, transform 0.3s;
          pointer-events: none;
        }

        .mact-chat-window.open {
          opacity: 1;
          transform: translateY(0) scale(1);
          pointer-events: auto;
        }

        /* ========================================
           Header
           ======================================== */
        .mact-chat-header {
          background: var(--primary-color);
          color: white;
          padding: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .mact-header-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .mact-header-info {
          flex: 1;
          min-width: 0;
        }

        .mact-header-info h3 {
          font-size: 16px;
          font-weight: 600;
          margin: 0;
        }

        .mact-header-info p {
          font-size: 13px;
          opacity: 0.9;
          margin: 2px 0 0;
        }

        .mact-chat-close {
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          padding: 4px;
          opacity: 0.8;
          transition: opacity 0.2s;
          flex-shrink: 0;
        }

        .mact-chat-close:hover {
          opacity: 1;
        }

        /* ========================================
           Messages Area
           ======================================== */
        .mact-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          background: #f8fafc;
        }

        /* Message row */
        .mact-message {
          display: flex;
          max-width: 85%;
        }

        /* Visitor messages - right aligned */
        .mact-message-visitor {
          align-self: flex-end;
        }

        /* Assistant messages - left aligned with avatar */
        .mact-message-assistant {
          align-self: flex-start;
          gap: 8px;
        }

        /* System messages - centered */
        .mact-message-system {
          align-self: center;
          max-width: 90%;
        }

        /* Avatar */
        .mact-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        /* Bubbles */
        .mact-bubble {
          padding: 10px 14px;
          font-size: 14px;
          line-height: 1.4;
          word-wrap: break-word;
          white-space: pre-wrap;
        }

        .mact-bubble-visitor {
          background: var(--primary-color);
          color: white;
          border-radius: 18px 18px 4px 18px;
        }

        .mact-bubble-assistant {
          background: white;
          color: #1e293b;
          border-radius: 18px 18px 18px 4px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }

        .mact-message-error .mact-bubble {
          opacity: 0.6;
        }

        .mact-error-text {
          font-size: 11px;
          margin-top: 4px;
          opacity: 0.8;
        }

        /* System bubble */
        .mact-system-bubble {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #fef3c7;
          border: 1px solid #fcd34d;
          color: #92400e;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 13px;
        }

        .mact-system-bubble svg {
          flex-shrink: 0;
        }

        /* ========================================
           Typing Indicator
           ======================================== */
        .mact-typing {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          padding: 0 16px 12px;
        }

        .mact-typing-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: #64748b;
        }

        .mact-typing-bubble {
          background: white;
          border-radius: 18px 18px 18px 4px;
          padding: 12px 16px;
          display: flex;
          gap: 4px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }

        .mact-typing-bubble span {
          width: 8px;
          height: 8px;
          background: #94a3b8;
          border-radius: 50%;
          animation: mact-typing 1.4s infinite;
        }

        .mact-typing-bubble span:nth-child(2) {
          animation-delay: 0.2s;
        }

        .mact-typing-bubble span:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes mact-typing {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }

        /* ========================================
           Input Area
           ======================================== */
        .mact-input-area {
          padding: 12px 16px;
          background: white;
          border-top: 1px solid #e2e8f0;
        }

        .mact-input-row {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .mact-input {
          flex: 1;
          border: 1px solid #e2e8f0;
          border-radius: 24px;
          padding: 10px 16px;
          font-size: 14px;
          font-family: inherit;
          outline: none;
          transition: border-color 0.2s;
          background: white;
          color: #1e293b;
        }

        .mact-input:focus {
          border-color: var(--primary-color);
        }

        .mact-input::placeholder {
          color: #94a3b8;
        }

        .mact-send-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: var(--primary-color);
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: filter 0.2s;
          flex-shrink: 0;
        }

        .mact-send-btn:hover {
          filter: brightness(1.1);
        }

        .mact-send-btn svg {
          color: white;
        }

        .mact-handoff-link {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          width: 100%;
          padding: 8px;
          margin-top: 8px;
          background: none;
          border: none;
          color: #64748b;
          font-size: 13px;
          font-family: inherit;
          cursor: pointer;
          transition: color 0.2s;
        }

        .mact-handoff-link:hover {
          color: var(--primary-color);
        }

        /* ========================================
           Footer
           ======================================== */
        .mact-footer {
          padding: 8px;
          text-align: center;
          font-size: 11px;
          color: #94a3b8;
          background: #f8fafc;
          border-top: 1px solid #e2e8f0;
        }

        .mact-footer a {
          color: #64748b;
          text-decoration: none;
        }

        .mact-footer a:hover {
          text-decoration: underline;
        }

        .mact-version {
          opacity: 0.5;
          margin-left: 4px;
        }

        /* ========================================
           Mobile Responsive
           ======================================== */
        @media (max-width: 480px) {
          .mact-chat-window {
            width: 100%;
            height: 100%;
            max-height: 100%;
            bottom: 0;
            right: 0;
            border-radius: 0;
          }

          .mact-launcher {
            bottom: 16px;
            right: 16px;
            width: 56px;
            height: 56px;
          }
        }
      `;
    }
  }

  // Register the custom element
  customElements.define('mact-chat-widget', MActChatWidget);

  // Auto-initialize
  const widget = document.createElement('mact-chat-widget');
  document.body.appendChild(widget);

  // Expose API
  window.MActChat = {
    open: () => widget.isOpen || widget.toggle(),
    close: () => widget.isOpen && widget.toggle(),
    toggle: () => widget.toggle(),
  };

})();
