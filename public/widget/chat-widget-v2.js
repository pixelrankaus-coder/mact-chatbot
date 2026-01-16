(function() {
  'use strict';

  const WIDGET_VERSION = '2.3.0';

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
      this.viewedPages = [];

      // Tidio-style email capture state
      this.showEmailCapture = false;
      this.pendingMessage = null;
      this.visitorEmail = localStorage.getItem('mact_visitor_email') || null;
      this.newsletterOptIn = false;

      // Inactivity follow-up state
      this.inactivityTimer = null;
      this.followUpShown = false;
      this.lastUserActivity = Date.now();
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
      this.initPageTracking();
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
    // Visitor Info Collection
    // ============================================================
    collectVisitorData() {
      const ua = navigator.userAgent;

      return {
        // Browser detection
        browser: this.detectBrowser(ua),

        // OS detection
        os: this.detectOS(ua),

        // Device type
        deviceType: this.detectDevice(),

        // Screen info
        screenResolution: `${window.screen.width}x${window.screen.height}`,

        // Timezone
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,

        // Language
        language: navigator.language,

        // Current page
        currentPage: window.location.href,

        // Page title
        pageTitle: document.title,

        // Referrer
        referrer: document.referrer || 'Direct',

        // User agent
        userAgent: ua,

        // Timestamp
        firstVisit: new Date().toISOString()
      };
    }

    detectBrowser(ua) {
      let browser = 'Unknown';
      let version = '';

      if (ua.includes('Firefox/')) {
        browser = 'Firefox';
        const match = ua.match(/Firefox\/(\d+)/);
        if (match) version = match[1];
      } else if (ua.includes('Edg/')) {
        browser = 'Edge';
        const match = ua.match(/Edg\/(\d+)/);
        if (match) version = match[1];
      } else if (ua.includes('Chrome/')) {
        browser = 'Chrome';
        const match = ua.match(/Chrome\/(\d+)/);
        if (match) version = match[1];
      } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
        browser = 'Safari';
        const match = ua.match(/Version\/(\d+)/);
        if (match) version = match[1];
      } else if (ua.includes('Opera') || ua.includes('OPR/')) {
        browser = 'Opera';
        const match = ua.match(/(?:Opera|OPR)\/(\d+)/);
        if (match) version = match[1];
      }

      return version ? `${browser} ${version}` : browser;
    }

    detectOS(ua) {
      if (ua.includes('Windows NT 10')) return 'Windows 10';
      if (ua.includes('Windows NT 11') || (ua.includes('Windows NT 10') && ua.includes('Win64'))) return 'Windows 11';
      if (ua.includes('Windows')) return 'Windows';
      if (ua.includes('Mac OS X')) return 'macOS';
      if (ua.includes('Linux')) return 'Linux';
      if (ua.includes('Android')) return 'Android';
      if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
      return 'Unknown';
    }

    detectDevice() {
      const ua = navigator.userAgent;
      if (/Mobi|Android/i.test(ua) && !/Tablet|iPad/i.test(ua)) return 'Mobile';
      if (/Tablet|iPad/i.test(ua)) return 'Tablet';
      return 'Desktop';
    }

    // ============================================================
    // Page Tracking
    // ============================================================
    initPageTracking() {
      this.viewedPages = this.loadViewedPages();
      this.trackCurrentPage();

      // Track navigation changes (for SPAs)
      window.addEventListener('popstate', () => this.trackCurrentPage());

      // Override pushState for SPA tracking
      const originalPushState = history.pushState;
      const self = this;
      history.pushState = function(...args) {
        originalPushState.apply(history, args);
        self.trackCurrentPage();
      };

      // Override replaceState for SPA tracking
      const originalReplaceState = history.replaceState;
      history.replaceState = function(...args) {
        originalReplaceState.apply(history, args);
        self.trackCurrentPage();
      };
    }

    loadViewedPages() {
      try {
        const stored = localStorage.getItem('mact_viewed_pages');
        return stored ? JSON.parse(stored) : [];
      } catch {
        return [];
      }
    }

    trackCurrentPage() {
      const page = {
        url: window.location.href,
        title: document.title,
        visitedAt: new Date().toISOString()
      };

      // Avoid duplicates within 5 seconds
      const lastPage = this.viewedPages[this.viewedPages.length - 1];
      if (lastPage && lastPage.url === page.url) {
        const timeDiff = new Date(page.visitedAt) - new Date(lastPage.visitedAt);
        if (timeDiff < 5000) return;
      }

      this.viewedPages.push(page);

      // Keep only last 20 pages
      if (this.viewedPages.length > 20) {
        this.viewedPages = this.viewedPages.slice(-20);
      }

      localStorage.setItem('mact_viewed_pages', JSON.stringify(this.viewedPages));

      // Update conversation if active
      if (this.conversation) {
        this.updateVisitorData();
      }
    }

    async updateVisitorData(additionalData = {}) {
      if (!this.conversation) return;

      try {
        await fetch(`${apiBase}/api/widget/conversations/${this.conversation.id}/visitor`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pagesViewed: this.viewedPages,
            currentPage: window.location.href,
            pageTitle: document.title,
            ...additionalData
          })
        });
      } catch (error) {
        console.error('MACt Widget: Failed to update visitor data', error);
      }
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
          preChatForm: {
            enabled: false,
            collectNewsletter: true
          }
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

    get emailCaptureEnabled() {
      return this.settings?.preChatForm?.enabled ?? false;
    }

    get collectNewsletter() {
      return this.settings?.preChatForm?.collectNewsletter ?? true;
    }

    // ============================================================
    // Email Capture (Tidio-style)
    // ============================================================
    hasVisitorEmail() {
      return !!this.visitorEmail;
    }

    saveVisitorEmail(email, newsletter = false) {
      this.visitorEmail = email;
      this.newsletterOptIn = newsletter;
      localStorage.setItem('mact_visitor_email', email);
      if (newsletter) {
        localStorage.setItem('mact_newsletter_optin', 'true');
      }
    }

    async handleEmailCaptureSubmit(e) {
      e.preventDefault();

      const emailInput = this.shadowRoot.querySelector('#mact-email-capture-input');
      const newsletterCheckbox = this.shadowRoot.querySelector('#mact-newsletter-checkbox');
      const email = emailInput?.value?.trim() || '';
      const newsletter = newsletterCheckbox?.checked || false;

      // Validate email
      if (!email) {
        this.showEmailCaptureError('Please enter your email address');
        return;
      }

      if (!this.isValidEmail(email)) {
        this.showEmailCaptureError('Please enter a valid email address');
        return;
      }

      // Save email
      this.saveVisitorEmail(email, newsletter);

      // Update conversation with email
      if (this.conversation) {
        await this.updateVisitorData({
          visitorEmail: email,
          newsletterOptIn: newsletter
        });
      }

      // Hide email capture panel
      this.showEmailCapture = false;
      this.renderEmailCapturePanel();

      // Send the pending message
      if (this.pendingMessage) {
        const message = this.pendingMessage;
        this.pendingMessage = null;
        await this.sendMessageDirect(message);
      }
    }

    isValidEmail(email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    showEmailCaptureError(message) {
      const errorEl = this.shadowRoot.querySelector('.mact-email-capture-error');
      if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
      }
    }

    dismissEmailCapture() {
      // User dismissed - send message anyway without email
      this.showEmailCapture = false;
      this.renderEmailCapturePanel();

      if (this.pendingMessage) {
        const message = this.pendingMessage;
        this.pendingMessage = null;
        this.sendMessageDirect(message);
      }
    }

    // ============================================================
    // Markdown to HTML Conversion (for clickable links)
    // ============================================================
    parseMarkdownLinks(text) {
      if (!text) return '';

      // Escape HTML first to prevent XSS
      let html = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      // Convert markdown links [text](url) to clickable HTML
      html = html.replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer" class="mact-link">$1</a>'
      );

      // Convert bare URLs to clickable links (but not already converted ones)
      html = html.replace(
        /(?<!href="|">)(https?:\/\/[^\s<]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer" class="mact-link">$1</a>'
      );

      // Convert **bold** text
      html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

      // Convert *italic* text
      html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

      // Convert line breaks
      html = html.replace(/\n/g, '<br>');

      return html;
    }

    // ============================================================
    // Inactivity Follow-up Prompt
    // ============================================================
    startInactivityTimer() {
      this.stopInactivityTimer();
      this.lastUserActivity = Date.now();

      // Only start timer if chat is open, conversation exists, and follow-up hasn't been shown
      if (!this.isOpen || !this.conversation || this.followUpShown) return;

      // 30 second inactivity timer
      this.inactivityTimer = setTimeout(() => {
        this.showFollowUpPrompt();
      }, 30000);
    }

    stopInactivityTimer() {
      if (this.inactivityTimer) {
        clearTimeout(this.inactivityTimer);
        this.inactivityTimer = null;
      }
    }

    resetInactivityTimer() {
      this.lastUserActivity = Date.now();
      if (this.isOpen && this.conversation && !this.followUpShown) {
        this.startInactivityTimer();
      }
    }

    showFollowUpPrompt() {
      if (this.followUpShown || !this.conversation) return;
      this.followUpShown = true;

      // Add follow-up message from assistant
      const followUpMessage = {
        id: 'followup_' + Date.now(),
        sender_type: 'ai',
        content: "Is there anything else I can help you with? Feel free to ask about our GFRC products, pricing, or installation process!",
        created_at: new Date().toISOString(),
        isFollowUp: true
      };

      this.messages.push(followUpMessage);
      this.renderMessages();
      this.scrollToBottom();
    }

    // ============================================================
    // Conversation & Messages API
    // ============================================================
    async createConversation() {
      try {
        const visitorInfo = this.collectVisitorData();

        const response = await fetch(`${apiBase}/api/widget/conversations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            visitorId: this.visitorId,
            visitorName: null,
            visitorEmail: this.visitorEmail,
            visitorInfo: {
              ...visitorInfo,
              pagesViewed: this.viewedPages
            }
          }),
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

    // Intercept message send - check if email capture needed
    async sendMessage(content) {
      if (!content.trim() || !this.conversation || this.isSending) return;

      // Check if we need to capture email first (Tidio-style flow)
      // Only show email capture on first visitor message if enabled
      const isFirstVisitorMessage = !this.messages.some(m =>
        (m.sender_type === 'visitor' || m.sender === 'user') && !m.id.startsWith('temp_')
      );

      if (this.emailCaptureEnabled && !this.hasVisitorEmail() && isFirstVisitorMessage) {
        // Store pending message and show email capture
        this.pendingMessage = content.trim();
        this.showEmailCapture = true;
        this.renderEmailCapturePanel();
        return;
      }

      // Send message normally
      await this.sendMessageDirect(content);
    }

    // Actually send the message (after email capture or if not needed)
    async sendMessageDirect(content) {
      if (!content.trim() || !this.conversation || this.isSending) return;
      this.isSending = true;
      this.stopPolling();
      this.resetInactivityTimer();

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
        // Always initialize conversation immediately (no blocking pre-chat form)
        if (!this.conversation) {
          this.initConversation();
        }
        this.startPolling();
        this.startInactivityTimer();
        this.scrollToBottom();
        const input = this.shadowRoot.querySelector('.mact-input');
        if (input) setTimeout(() => input.focus(), 100);
      } else {
        this.stopPolling();
        this.stopInactivityTimer();
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
        <div class="mact-chat-window ${this.isOpen ? 'open' : ''}">
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

          ${this.renderChatContent()}

          <div class="mact-footer">
            Powered by <a href="https://mact.au" target="_blank" rel="noopener">MACt</a>
            <span class="mact-version">v${WIDGET_VERSION}</span>
          </div>
        </div>

        <!-- Launcher Button -->
        <button class="mact-launcher ${this.isOpen ? 'open' : ''}" aria-label="Open chat">
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

    renderChatContent() {
      return `
        <div class="mact-chat-body">
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

          <!-- Email Capture Panel (Tidio-style slide-up) -->
          <div class="mact-email-capture ${this.showEmailCapture ? 'open' : ''}">
            <button class="mact-email-capture-dismiss" aria-label="Dismiss">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            <div class="mact-email-capture-avatar">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <h4 class="mact-email-capture-title">Please introduce yourself:</h4>
            <div class="mact-email-capture-error" style="display: none;"></div>
            <form id="mact-email-capture-form" class="mact-email-capture-form">
              <input
                type="email"
                id="mact-email-capture-input"
                placeholder="Enter your email..."
                autocomplete="email"
              />
              ${this.collectNewsletter ? `
                <label class="mact-newsletter-label">
                  <input type="checkbox" id="mact-newsletter-checkbox" />
                  <span>Sign up for our newsletter</span>
                </label>
              ` : ''}
              <button type="submit" class="mact-email-capture-submit">Send</button>
            </form>
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
        </div>
      `;
    }

    renderEmailCapturePanel() {
      const panel = this.shadowRoot.querySelector('.mact-email-capture');
      if (panel) {
        panel.classList.toggle('open', this.showEmailCapture);

        // Re-attach event listeners for the form
        if (this.showEmailCapture) {
          const form = this.shadowRoot.querySelector('#mact-email-capture-form');
          const dismissBtn = this.shadowRoot.querySelector('.mact-email-capture-dismiss');

          form?.addEventListener('submit', (e) => this.handleEmailCaptureSubmit(e));
          dismissBtn?.addEventListener('click', () => this.dismissEmailCapture());

          // Focus email input
          const emailInput = this.shadowRoot.querySelector('#mact-email-capture-input');
          if (emailInput) setTimeout(() => emailInput.focus(), 100);
        }
      }
    }

    formatTimestamp(dateString) {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;

      // Format as time for older messages
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    renderMessages() {
      const container = this.shadowRoot.querySelector('.mact-messages');
      if (!container) return;

      const color = this.primaryColor;

      container.innerHTML = this.messages.map(msg => {
        const senderType = msg.sender_type || msg.sender;
        const isVisitor = senderType === 'visitor' || senderType === 'user';
        const isSystem = senderType === 'system';
        const isAI = senderType === 'ai' || senderType === 'bot' || senderType === 'assistant' || senderType === 'agent';
        const hasError = msg.error;
        const timestamp = msg.created_at ? this.formatTimestamp(msg.created_at) : '';

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

        // AI/Agent message with parsed markdown and timestamp
        const parsedContent = this.parseMarkdownLinks(msg.content);
        return `
          <div class="mact-message mact-message-assistant">
            <div class="mact-avatar" style="background-color: ${color}20; color: ${color};">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 8V4H8"/><rect x="8" y="8" width="8" height="12" rx="2"/><circle cx="10" cy="13" r="1"/><circle cx="14" cy="13" r="1"/>
              </svg>
            </div>
            <div class="mact-message-content">
              <div class="mact-bubble mact-bubble-assistant">
                ${parsedContent}
              </div>
              ${timestamp ? `<div class="mact-timestamp">${timestamp}</div>` : ''}
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

      // Email capture form
      const emailForm = this.shadowRoot.querySelector('#mact-email-capture-form');
      emailForm?.addEventListener('submit', (e) => this.handleEmailCaptureSubmit(e));

      // Email capture dismiss
      const dismissBtn = this.shadowRoot.querySelector('.mact-email-capture-dismiss');
      dismissBtn?.addEventListener('click', () => this.dismissEmailCapture());

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
      const chatBody = this.shadowRoot.querySelector('.mact-chat-body');
      if (!chatBody) return;

      // Create overlay
      const overlay = document.createElement('div');
      overlay.className = 'mact-handoff-overlay';
      overlay.innerHTML = `
        <div class="mact-handoff-form">
          <h4>Talk to a Human</h4>
          <p>Leave your details and we'll get back to you shortly.</p>
          <input type="text" class="mact-handoff-name" placeholder="Your name" />
          <input type="email" class="mact-handoff-email" placeholder="Your email" value="${this.visitorEmail || ''}" />
          <textarea class="mact-handoff-message" placeholder="How can we help? (optional)" rows="3"></textarea>
          <div class="mact-handoff-buttons">
            <button class="mact-handoff-cancel">Cancel</button>
            <button class="mact-handoff-submit">Connect Me</button>
          </div>
        </div>
      `;

      chatBody.appendChild(overlay);

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

        // Save email if not already saved
        if (!this.visitorEmail) {
          this.saveVisitorEmail(email);
        }

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
          flex-shrink: 0;
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
           Chat Body
           ======================================== */
        .mact-chat-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
        }

        /* ========================================
           Messages Area
           ======================================== */
        .mact-messages {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          background: #f8fafc;
        }

        /* Message row */
        .mact-message {
          display: flex;
          margin-bottom: 6px;
          max-width: 75%;
        }

        /* Visitor messages - right aligned */
        .mact-message-visitor {
          align-self: flex-end;
          justify-content: flex-end;
        }

        /* Assistant messages - left aligned with avatar */
        .mact-message-assistant {
          align-self: flex-start;
          justify-content: flex-start;
          gap: 8px;
        }

        /* System messages - centered */
        .mact-message-system {
          align-self: center;
          max-width: 90%;
        }

        /* Avatar */
        .mact-avatar {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        /* Bubbles */
        .mact-bubble {
          padding: 6px 10px;
          font-size: 14px;
          line-height: 1.2;
          display: inline-block;
          max-width: 100%;
          word-wrap: break-word;
          box-sizing: border-box;
        }

        .mact-bubble-visitor {
          background: var(--primary-color);
          color: white;
          border-radius: 16px 16px 4px 16px;
        }

        .mact-bubble-assistant {
          background: white;
          color: #1e293b;
          border-radius: 16px 16px 16px 4px;
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

        /* Message content wrapper (for timestamp positioning) */
        .mact-message-content {
          display: flex;
          flex-direction: column;
          max-width: 100%;
        }

        /* Timestamps */
        .mact-timestamp {
          font-size: 11px;
          color: #94a3b8;
          margin-top: 4px;
          padding-left: 2px;
        }

        /* Clickable links in messages */
        .mact-link {
          color: var(--primary-color);
          text-decoration: underline;
          cursor: pointer;
          word-break: break-word;
        }

        .mact-link:hover {
          opacity: 0.8;
        }

        .mact-bubble-assistant .mact-link {
          color: var(--primary-color);
        }

        .mact-bubble-visitor .mact-link {
          color: white;
          opacity: 0.9;
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
           Email Capture (Tidio-style)
           ======================================== */
        .mact-email-capture {
          position: absolute;
          bottom: 100px;
          left: 16px;
          right: 16px;
          background: white;
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
          padding: 20px;
          transform: translateY(100%);
          opacity: 0;
          transition: transform 0.3s ease, opacity 0.3s ease;
          pointer-events: none;
          z-index: 10;
        }

        .mact-email-capture.open {
          transform: translateY(0);
          opacity: 1;
          pointer-events: auto;
        }

        .mact-email-capture-dismiss {
          position: absolute;
          top: 8px;
          right: 8px;
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s;
        }

        .mact-email-capture-dismiss:hover {
          color: #64748b;
        }

        .mact-email-capture-avatar {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 12px;
          color: #94a3b8;
        }

        .mact-email-capture-title {
          font-size: 16px;
          font-weight: 600;
          color: #1e293b;
          text-align: center;
          margin-bottom: 16px;
        }

        .mact-email-capture-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #dc2626;
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 13px;
          margin-bottom: 12px;
          text-align: center;
        }

        .mact-email-capture-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .mact-email-capture-form input[type="email"] {
          width: 100%;
          padding: 12px 14px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 14px;
          font-family: inherit;
          transition: border-color 0.2s;
          background: white;
          color: #1e293b;
        }

        .mact-email-capture-form input[type="email"]:focus {
          outline: none;
          border-color: var(--primary-color);
        }

        .mact-email-capture-form input[type="email"]::placeholder {
          color: #94a3b8;
        }

        .mact-newsletter-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #64748b;
          cursor: pointer;
        }

        .mact-newsletter-label input[type="checkbox"] {
          width: 16px;
          height: 16px;
          cursor: pointer;
        }

        .mact-email-capture-submit {
          width: 100%;
          padding: 12px;
          background: var(--primary-color);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          font-family: inherit;
          cursor: pointer;
          transition: filter 0.2s;
        }

        .mact-email-capture-submit:hover {
          filter: brightness(1.1);
        }

        /* ========================================
           Input Area
           ======================================== */
        .mact-input-area {
          padding: 12px 16px;
          background: white;
          border-top: 1px solid #e2e8f0;
          flex-shrink: 0;
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
           Handoff Overlay
           ======================================== */
        .mact-handoff-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 20;
        }

        .mact-handoff-form {
          background: white;
          border-radius: 12px;
          padding: 24px;
          width: 100%;
          max-width: 320px;
        }

        .mact-handoff-form h4 {
          margin: 0 0 8px;
          font-size: 18px;
          font-weight: 600;
          color: #1e293b;
        }

        .mact-handoff-form p {
          margin: 0 0 16px;
          font-size: 14px;
          color: #64748b;
        }

        .mact-handoff-form input,
        .mact-handoff-form textarea {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          font-family: inherit;
          margin-bottom: 12px;
          background: white;
          color: #1e293b;
        }

        .mact-handoff-form input:focus,
        .mact-handoff-form textarea:focus {
          outline: none;
          border-color: var(--primary-color);
        }

        .mact-handoff-form textarea {
          resize: none;
        }

        .mact-handoff-buttons {
          display: flex;
          gap: 8px;
          margin-top: 8px;
        }

        .mact-handoff-cancel {
          flex: 1;
          padding: 10px;
          background: #f1f5f9;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-family: inherit;
          cursor: pointer;
          color: #64748b;
          transition: background 0.2s;
        }

        .mact-handoff-cancel:hover {
          background: #e2e8f0;
        }

        .mact-handoff-submit {
          flex: 1;
          padding: 10px;
          background: var(--primary-color);
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-family: inherit;
          cursor: pointer;
          color: white;
          transition: filter 0.2s;
        }

        .mact-handoff-submit:hover {
          filter: brightness(1.1);
        }

        .mact-handoff-submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
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
          flex-shrink: 0;
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

          .mact-email-capture {
            left: 12px;
            right: 12px;
            bottom: 90px;
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
    isOpen: () => widget.isOpen,
  };

})();
