(function() {
  'use strict';

  // Get script configuration
  const scriptTag = document.currentScript;
  const storeId = scriptTag?.getAttribute('data-store-id') || 'default';
  const apiBase = scriptTag?.getAttribute('data-api-base') || scriptTag?.src.replace(/\/widget\/chat-widget\.js.*$/, '') || '';

  // Widget state
  let isOpen = false;
  let isLoading = true;
  let isTyping = false;
  let isHandoffMode = false;
  let settings = null;
  let conversation = null;
  let messages = [];
  let visitorId = null;
  let pollInterval = null;
  let lastMessageTime = null;
  let isMobile = window.innerWidth <= 768;

  // DOM elements
  let container = null;
  let bubble = null;
  let chatWindow = null;

  // Generate or retrieve visitor ID
  function getVisitorId() {
    const storageKey = 'mact_visitor_id';
    let id = localStorage.getItem(storageKey);
    if (!id) {
      id = 'visitor_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem(storageKey, id);
    }
    return id;
  }

  // Fetch settings from API
  async function fetchSettings() {
    try {
      const response = await fetch(`${apiBase}/api/widget/settings`);
      if (!response.ok) throw new Error('Failed to fetch settings');
      settings = await response.json();
      return settings;
    } catch (error) {
      console.error('MACt Widget: Failed to load settings', error);
      // Use defaults
      settings = {
        appearance: {
          primaryColor: '#2563eb',
          position: 'bottom-right',
          welcomeMessage: 'Hi there! How can I help you today?',
          companyName: 'Support',
        },
        aiAgent: {
          enabled: true,
          name: 'Assistant',
          welcomeMessage: 'Hi there! How can I help you today?',
        },
      };
      return settings;
    }
  }

  // Create or get existing conversation
  async function getOrCreateConversation() {
    try {
      const response = await fetch(`${apiBase}/api/widget/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorId,
          storeId,
        }),
      });
      if (!response.ok) throw new Error('Failed to create conversation');
      const data = await response.json();
      conversation = data.conversation;
      return conversation;
    } catch (error) {
      console.error('MACt Widget: Failed to create conversation', error);
      return null;
    }
  }

  // Fetch messages
  async function fetchMessages() {
    if (!conversation) return;
    try {
      const url = lastMessageTime
        ? `${apiBase}/api/widget/conversations/${conversation.id}/messages?since=${encodeURIComponent(lastMessageTime)}`
        : `${apiBase}/api/widget/conversations/${conversation.id}/messages`;

      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch messages');
      const data = await response.json();

      if (data.messages && data.messages.length > 0) {
        // Always deduplicate by ID on every fetch
        const existingIds = new Set(messages.filter(m => !m.id.startsWith('temp_')).map(m => m.id));
        const newMessages = data.messages.filter(m => !existingIds.has(m.id));

        if (!lastMessageTime) {
          // Initial load - replace all (but keep any temp messages)
          const tempMessages = messages.filter(m => m.id.startsWith('temp_'));
          messages = [...data.messages, ...tempMessages];
        } else if (newMessages.length > 0) {
          // Append only truly new messages
          messages = [...messages, ...newMessages];
        }

        lastMessageTime = data.messages[data.messages.length - 1].created_at;
        renderMessages();
      }
    } catch (error) {
      console.error('MACt Widget: Failed to fetch messages', error);
    }
  }

  // Send message
  let isSending = false;
  async function sendMessage(content) {
    if (!content.trim() || !conversation || isSending) return;
    isSending = true;

    // Stop polling while sending to avoid race conditions
    stopPolling();

    // Add optimistic user message
    const tempMessage = {
      id: 'temp_' + Date.now(),
      sender_type: 'visitor',
      content: content.trim(),
      created_at: new Date().toISOString(),
    };
    messages.push(tempMessage);
    renderMessages();
    scrollToBottom();

    // Show typing indicator
    setTyping(true);

    try {
      const response = await fetch(`${apiBase}/api/widget/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          visitorId,
        }),
      });

      if (!response.ok) throw new Error('Failed to send message');
      const data = await response.json();

      // Replace temp message with real one
      const tempIndex = messages.findIndex(m => m.id === tempMessage.id);
      if (tempIndex !== -1 && data.userMessage) {
        messages[tempIndex] = data.userMessage;
        lastMessageTime = data.userMessage.created_at;
      }

      // Add bot response if present
      if (data.botMessage) {
        messages.push(data.botMessage);
        lastMessageTime = data.botMessage.created_at;
      }

      setTyping(false);
      renderMessages();
      scrollToBottom();

      // Resume polling after send completes
      isSending = false;
      startPolling();
    } catch (error) {
      console.error('MACt Widget: Failed to send message', error);
      setTyping(false);
      // Show error state
      const tempIndex = messages.findIndex(m => m.id === tempMessage.id);
      if (tempIndex !== -1) {
        messages[tempIndex].error = true;
        renderMessages();
      }
      // Resume polling after error
      isSending = false;
      startPolling();
    }
  }

  // Set typing indicator
  function setTyping(typing) {
    isTyping = typing;
    const typingEl = chatWindow?.querySelector('.mact-typing');
    if (typingEl) {
      typingEl.style.display = typing ? 'flex' : 'none';
    }
  }

  // Request human handoff
  async function requestHandoff(visitorName, visitorEmail, message) {
    if (!conversation) return;

    try {
      const response = await fetch(`${apiBase}/api/widget/conversations/${conversation.id}/handoff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorName,
          visitorEmail,
          message,
          reason: 'user_requested',
        }),
      });

      const data = await response.json();

      if (data.success) {
        isHandoffMode = true;
        // Add system message
        messages.push({
          id: 'handoff_' + Date.now(),
          sender: 'system',
          content: data.message,
          created_at: new Date().toISOString(),
        });
        renderMessages();
        scrollToBottom();

        // Hide handoff form, show regular input
        hideHandoffForm();
      }

      return data;
    } catch (error) {
      console.error('MACt Widget: Handoff request failed', error);
      return { success: false, error: 'Failed to request handoff' };
    }
  }

  // Show handoff form
  function showHandoffForm() {
    const content = chatWindow?.querySelector('.mact-content');
    if (!content) return;

    const primaryColor = settings?.appearance?.primaryColor || '#2563eb';

    // Create handoff form overlay
    const formHtml = `
      <div class="mact-handoff-form">
        <h4>Talk to a Human</h4>
        <p>Leave your details and we'll get back to you shortly.</p>
        <input type="text" class="mact-handoff-name" placeholder="Your name" />
        <input type="email" class="mact-handoff-email" placeholder="Your email" />
        <textarea class="mact-handoff-message" placeholder="How can we help? (optional)" rows="3"></textarea>
        <div class="mact-handoff-buttons">
          <button class="mact-handoff-cancel">Cancel</button>
          <button class="mact-handoff-submit" style="background-color: ${primaryColor};">Connect Me</button>
        </div>
      </div>
    `;

    const formContainer = document.createElement('div');
    formContainer.className = 'mact-handoff-overlay';
    formContainer.innerHTML = formHtml;
    content.appendChild(formContainer);

    // Add event listeners
    formContainer.querySelector('.mact-handoff-cancel')?.addEventListener('click', hideHandoffForm);
    formContainer.querySelector('.mact-handoff-submit')?.addEventListener('click', async () => {
      const name = formContainer.querySelector('.mact-handoff-name')?.value || '';
      const email = formContainer.querySelector('.mact-handoff-email')?.value || '';
      const msg = formContainer.querySelector('.mact-handoff-message')?.value || '';

      if (!email) {
        alert('Please enter your email address');
        return;
      }

      const submitBtn = formContainer.querySelector('.mact-handoff-submit');
      if (submitBtn) {
        submitBtn.textContent = 'Connecting...';
        submitBtn.disabled = true;
      }

      await requestHandoff(name, email, msg);
    });
  }

  // Hide handoff form
  function hideHandoffForm() {
    const overlay = chatWindow?.querySelector('.mact-handoff-overlay');
    if (overlay) {
      overlay.remove();
    }
  }

  // Scroll chat to bottom
  function scrollToBottom() {
    const messagesContainer = chatWindow?.querySelector('.mact-messages');
    if (messagesContainer) {
      setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }, 50);
    }
  }

  // Start polling for new messages
  function startPolling() {
    if (pollInterval) return;
    pollInterval = setInterval(fetchMessages, 3000);
  }

  // Stop polling
  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  // Render messages
  function renderMessages() {
    const messagesContainer = chatWindow?.querySelector('.mact-messages');
    if (!messagesContainer) return;

    const primaryColor = settings?.appearance?.primaryColor || settings?.appearance?.actionColor || '#2563eb';

    messagesContainer.innerHTML = messages.map(msg => {
      // Support both old format (sender) and new format (sender_type)
      const senderType = msg.sender_type || msg.sender;
      const isUser = senderType === 'visitor' || senderType === 'user';
      const isSystem = senderType === 'system' || msg.sender_name === 'System';
      const hasError = msg.error;

      if (isSystem) {
        return `
          <div class="mact-message mact-message-system">
            <div class="mact-system-bubble">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
              </svg>
              ${msg.content}
            </div>
          </div>
        `;
      }

      return `
        <div class="mact-message ${isUser ? 'mact-message-user' : 'mact-message-bot'}">
          ${!isUser ? `<div class="mact-msg-avatar" style="background-color: ${primaryColor}20; color: ${primaryColor};">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 8V4H8"/><rect x="8" y="8" width="8" height="12" rx="2"/><circle cx="10" cy="13" r="1"/><circle cx="14" cy="13" r="1"/>
            </svg>
          </div>` : ''}
          <div class="mact-msg-bubble ${isUser ? 'mact-msg-bubble-user' : 'mact-msg-bubble-bot'}" ${hasError ? 'style="opacity: 0.6;"' : ''}>
            ${msg.content}
            ${hasError ? '<div style="font-size: 10px; margin-top: 4px;">Failed to send</div>' : ''}
          </div>
        </div>
      `;
    }).join('');

    // Re-add typing indicator HTML
    const typingHtml = `
      <div class="mact-typing" style="display: ${isTyping ? 'flex' : 'none'};">
        <div class="mact-msg-avatar" style="background-color: ${primaryColor}20; color: ${primaryColor};">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 8V4H8"/><rect x="8" y="8" width="8" height="12" rx="2"/><circle cx="10" cy="13" r="1"/><circle cx="14" cy="13" r="1"/>
          </svg>
        </div>
        <div class="mact-msg-bubble mact-msg-bubble-bot">
          <div class="mact-typing-dots">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
    `;
    messagesContainer.insertAdjacentHTML('beforeend', typingHtml);
  }

  // Toggle chat window
  function toggleChat() {
    isOpen = !isOpen;
    if (chatWindow) {
      chatWindow.style.display = isOpen ? 'flex' : 'none';
      chatWindow.style.opacity = isOpen ? '1' : '0';
      chatWindow.style.transform = isOpen ? 'scale(1)' : 'scale(0.95)';
    }
    if (bubble) {
      const closeIcon = bubble.querySelector('.mact-close-icon');
      const chatIcon = bubble.querySelector('.mact-chat-icon');
      if (closeIcon) closeIcon.style.display = isOpen ? 'block' : 'none';
      if (chatIcon) chatIcon.style.display = isOpen ? 'none' : 'block';
    }

    if (isOpen) {
      // Initialize conversation if needed
      if (!conversation) {
        initConversation();
      }
      startPolling();
      scrollToBottom();
      // Focus input
      const input = chatWindow?.querySelector('.mact-input');
      if (input) setTimeout(() => input.focus(), 100);
    } else {
      stopPolling();
    }
  }

  // Initialize conversation
  async function initConversation() {
    isLoading = true;
    renderLoadingState();

    await getOrCreateConversation();
    if (conversation) {
      await fetchMessages();
    }

    isLoading = false;
    renderChatContent();
  }

  // Render loading state
  function renderLoadingState() {
    const content = chatWindow?.querySelector('.mact-content');
    if (!content) return;

    content.innerHTML = `
      <div class="mact-loading">
        <div class="mact-spinner"></div>
        <p>Loading...</p>
      </div>
    `;
  }

  // Render chat content
  function renderChatContent() {
    const content = chatWindow?.querySelector('.mact-content');
    if (!content) return;

    const primaryColor = settings?.appearance?.primaryColor || '#2563eb';

    content.innerHTML = `
      <div class="mact-messages"></div>
      <div class="mact-input-area">
        <div class="mact-input-row">
          <input type="text" class="mact-input" placeholder="Type your message..." />
          <button class="mact-send" style="background-color: ${primaryColor};">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
            </svg>
          </button>
        </div>
        <button class="mact-human-link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
          Talk to a human
        </button>
      </div>
    `;

    // Render existing messages
    renderMessages();

    // Add event listeners
    const input = content.querySelector('.mact-input');
    const sendBtn = content.querySelector('.mact-send');
    const humanLink = content.querySelector('.mact-human-link');

    input?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const message = input.value.trim();
        if (message) {
          sendMessage(message);
          input.value = '';
        }
      }
    });

    sendBtn?.addEventListener('click', () => {
      const message = input?.value.trim();
      if (message) {
        sendMessage(message);
        input.value = '';
      }
    });

    humanLink?.addEventListener('click', () => {
      showHandoffForm();
    });

    scrollToBottom();
  }

  // Get visibility settings for current device
  function getDeviceSettings() {
    const deviceKey = isMobile ? 'mobile' : 'desktop';
    return settings?.appearance?.[deviceKey] || { display: true, position: 'right', buttonType: 'corner' };
  }

  // Get bubble size in pixels
  function getBubbleSize() {
    const size = settings?.appearance?.bubbleSize || 'medium';
    const sizes = { small: 50, medium: 60, large: 70 };
    return sizes[size] || 60;
  }

  // Get chat window height in pixels
  function getChatWindowHeight() {
    const size = settings?.appearance?.chatWindowHeight || 'medium';
    const sizes = { small: 450, medium: 550, large: 650 };
    return sizes[size] || 550;
  }

  // Create widget styles
  function createStyles() {
    const primaryColor = settings?.appearance?.primaryColor || settings?.appearance?.actionColor || '#2563eb';
    const offsetX = settings?.appearance?.offsetX ?? 20;
    const offsetY = settings?.appearance?.offsetY ?? 80;
    const zIndex = settings?.appearance?.zIndex ?? 999999;
    const bubbleSize = getBubbleSize();
    const bubbleIconColor = settings?.appearance?.bubbleIconColor || '#ffffff';
    const chatWindowHeight = getChatWindowHeight();
    const deviceSettings = getDeviceSettings();
    const widgetPosition = deviceSettings.position || 'right';

    // Calculate icon size (55% of bubble size)
    const iconSize = Math.round(bubbleSize * 0.55);

    const styles = document.createElement('style');
    styles.id = 'mact-widget-styles';
    styles.textContent = `
      /* CSS Reset for isolation from parent page styles */
      .mact-widget-container,
      .mact-widget-container *,
      .mact-widget-container *::before,
      .mact-widget-container *::after {
        all: revert;
        box-sizing: border-box;
      }
      .mact-widget-container {
        position: fixed;
        z-index: ${zIndex};
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
        font-size: 14px;
        line-height: 1.4;
        color: #1e293b;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
      .mact-widget-container.position-right {
        bottom: ${offsetY}px;
        right: ${offsetX}px;
      }
      .mact-widget-container.position-left {
        bottom: ${offsetY}px;
        left: ${offsetX}px;
      }
      /* Legacy support */
      .mact-widget-container.bottom-right {
        bottom: ${offsetY}px;
        right: ${offsetX}px;
      }
      .mact-widget-container.bottom-left {
        bottom: ${offsetY}px;
        left: ${offsetX}px;
      }
      .mact-launcher {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .mact-launcher-text {
        background: white;
        color: #1e293b;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        white-space: nowrap;
      }
      .mact-bubble {
        width: ${bubbleSize}px;
        height: ${bubbleSize}px;
        border-radius: 50%;
        background-color: ${primaryColor};
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        transition: transform 0.2s, box-shadow 0.2s;
        flex-shrink: 0;
      }
      .mact-bubble:hover {
        transform: scale(1.05);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
      }
      .mact-bubble svg {
        color: ${bubbleIconColor};
        width: ${iconSize}px;
        height: ${iconSize}px;
      }
      .mact-close-icon {
        display: none;
      }
      .mact-chat-window {
        display: none;
        flex-direction: column;
        position: absolute;
        bottom: ${bubbleSize + 20}px;
        width: 380px;
        height: ${chatWindowHeight}px;
        background: white;
        border-radius: 16px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
        overflow: hidden;
        transition: opacity 0.2s, transform 0.2s;
        opacity: 0;
        transform: scale(0.95);
      }
      .mact-widget-container.position-right .mact-chat-window,
      .mact-widget-container.bottom-right .mact-chat-window {
        right: 0;
      }
      .mact-widget-container.position-left .mact-chat-window,
      .mact-widget-container.bottom-left .mact-chat-window {
        left: 0;
      }
      .mact-header {
        background: ${primaryColor};
        color: white;
        padding: 16px 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .mact-header-info {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .mact-header-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: rgba(255,255,255,0.2);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .mact-header-text h3 {
        margin: 0;
        padding: 0;
        font-size: 16px;
        font-weight: 600;
        line-height: 1.3;
        color: inherit;
        text-transform: none;
        letter-spacing: normal;
      }
      .mact-header-text p {
        margin: 2px 0 0;
        padding: 0;
        font-size: 12px;
        opacity: 0.9;
        line-height: 1.3;
        color: inherit;
      }
      .mact-header-close {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        padding: 4px;
        opacity: 0.8;
        transition: opacity 0.2s;
      }
      .mact-header-close:hover {
        opacity: 1;
      }
      .mact-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .mact-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        background: #ffffff;
      }
      .mact-message {
        display: flex;
        gap: 8px;
        max-width: 85%;
        min-width: 40px;
        margin: 0;
        padding: 0;
      }
      .mact-message-user {
        align-self: flex-end;
        flex-direction: row-reverse;
      }
      .mact-message-bot {
        align-self: flex-start;
      }
      .mact-msg-avatar {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        margin-top: 1px;
      }
      .mact-msg-avatar svg {
        width: 12px;
        height: 12px;
      }
      .mact-msg-bubble {
        padding: 8px 12px;
        font-size: 14px;
        line-height: 1.4;
        word-wrap: break-word;
        overflow-wrap: break-word;
        white-space: pre-wrap;
        max-width: 100%;
        margin: 0;
        border: none;
        outline: none;
        text-decoration: none;
        font-weight: 400;
        letter-spacing: normal;
        text-transform: none;
      }
      .mact-msg-bubble-bot {
        background: #f1f5f9;
        color: #1e293b;
        border-radius: 8px 8px 8px 2px;
      }
      .mact-msg-bubble-user {
        background: ${primaryColor};
        color: white;
        border-radius: 8px 8px 2px 8px;
      }
      .mact-typing {
        display: flex;
        gap: 6px;
        align-self: flex-start;
      }
      .mact-typing-dots {
        display: flex;
        gap: 4px;
        padding: 4px 0;
      }
      .mact-typing-dots span {
        width: 6px;
        height: 6px;
        background: #94a3b8;
        border-radius: 50%;
        animation: mact-bounce 1.4s infinite ease-in-out;
      }
      .mact-typing-dots span:nth-child(1) { animation-delay: 0s; }
      .mact-typing-dots span:nth-child(2) { animation-delay: 0.2s; }
      .mact-typing-dots span:nth-child(3) { animation-delay: 0.4s; }
      @keyframes mact-bounce {
        0%, 80%, 100% { transform: translateY(0); }
        40% { transform: translateY(-6px); }
      }
      .mact-input {
        flex: 1;
        border: 1px solid #e2e8f0;
        border-radius: 20px;
        padding: 8px 14px;
        font-size: 14px;
        outline: none;
        transition: border-color 0.2s;
      }
      .mact-input:focus {
        border-color: ${primaryColor};
      }
      .mact-send {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: none;
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: opacity 0.2s;
        flex-shrink: 0;
      }
      .mact-send:hover {
        opacity: 0.9;
      }
      .mact-footer {
        padding: 8px;
        text-align: center;
        font-size: 11px;
        color: #94a3b8;
        background: #f8fafc;
      }
      .mact-footer a {
        color: #64748b;
        text-decoration: none;
      }
      .mact-footer a:hover {
        text-decoration: underline;
      }
      .mact-loading {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        color: #64748b;
      }
      .mact-spinner {
        width: 32px;
        height: 32px;
        border: 3px solid #e2e8f0;
        border-top-color: ${primaryColor};
        border-radius: 50%;
        animation: mact-spin 0.8s linear infinite;
      }
      @keyframes mact-spin {
        to { transform: rotate(360deg); }
      }
      /* Input row with human link */
      .mact-input-area {
        padding: 10px 12px;
        border-top: 1px solid #e2e8f0;
        display: flex;
        flex-direction: column;
        gap: 6px;
        background: white;
      }
      .mact-input-row {
        display: flex;
        gap: 6px;
      }
      .mact-human-link {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        background: none;
        border: none;
        color: #64748b;
        font-size: 12px;
        cursor: pointer;
        padding: 4px 8px;
        transition: color 0.2s;
      }
      .mact-human-link:hover {
        color: ${primaryColor};
      }
      .mact-human-link svg {
        opacity: 0.7;
      }
      /* System messages */
      .mact-message-system {
        align-self: center;
        max-width: 90%;
      }
      .mact-system-bubble {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        background: #fef3c7;
        border: 1px solid #fcd34d;
        color: #92400e;
        padding: 10px 14px;
        border-radius: 8px;
        font-size: 13px;
        line-height: 1.4;
      }
      .mact-system-bubble svg {
        flex-shrink: 0;
        margin-top: 2px;
      }
      /* Handoff form overlay */
      .mact-handoff-overlay {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        z-index: 10;
      }
      .mact-handoff-form {
        background: white;
        border-radius: 12px;
        padding: 24px;
        width: 100%;
        max-width: 320px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
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
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        font-size: 14px;
        margin-bottom: 12px;
        outline: none;
        transition: border-color 0.2s;
        box-sizing: border-box;
        font-family: inherit;
      }
      .mact-handoff-form input:focus,
      .mact-handoff-form textarea:focus {
        border-color: ${primaryColor};
      }
      .mact-handoff-form textarea {
        resize: none;
      }
      .mact-handoff-buttons {
        display: flex;
        gap: 8px;
        margin-top: 4px;
      }
      .mact-handoff-cancel {
        flex: 1;
        padding: 10px 16px;
        border: 1px solid #e2e8f0;
        background: white;
        border-radius: 8px;
        font-size: 14px;
        cursor: pointer;
        transition: background 0.2s;
      }
      .mact-handoff-cancel:hover {
        background: #f8fafc;
      }
      .mact-handoff-submit {
        flex: 1;
        padding: 10px 16px;
        border: none;
        color: white;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: opacity 0.2s;
      }
      .mact-handoff-submit:hover {
        opacity: 0.9;
      }
      .mact-handoff-submit:disabled {
        opacity: 0.7;
        cursor: not-allowed;
      }
      @media (max-width: 768px) {
        .mact-chat-window {
          width: calc(100vw - 32px);
          height: 85vh;
          max-height: calc(100vh - 100px);
          bottom: ${bubbleSize + 16}px;
        }
        .mact-launcher-text {
          display: none;
        }
        .mact-widget-container.bottom-right,
        .mact-widget-container.bottom-left,
        .mact-widget-container.position-right,
        .mact-widget-container.position-left {
          right: 16px;
          left: auto;
        }
        .mact-widget-container.position-left,
        .mact-widget-container.bottom-left {
          left: 16px;
          right: auto;
        }
        .mact-widget-container .mact-chat-window {
          right: 0;
          left: 0;
        }
      }
    `;
    document.head.appendChild(styles);
  }

  // Create widget DOM
  function createWidget() {
    const deviceSettings = getDeviceSettings();
    const primaryColor = settings?.appearance?.primaryColor || settings?.appearance?.actionColor || '#2563eb';
    const companyName = settings?.appearance?.companyName || settings?.aiAgent?.name || 'Support';

    // Check if widget should be displayed on this device
    if (!deviceSettings.display) {
      console.log('MACt Widget: Hidden on this device type');
      return;
    }

    // Determine position class - prefer new format, fall back to legacy
    const widgetPosition = deviceSettings.position || 'right';
    const positionClass = `position-${widgetPosition}`;

    // Container
    container = document.createElement('div');
    container.className = `mact-widget-container ${positionClass}`;
    container.id = 'mact-chat-widget';

    // Chat window
    chatWindow = document.createElement('div');
    chatWindow.className = 'mact-chat-window';
    chatWindow.innerHTML = `
      <div class="mact-header">
        <div class="mact-header-info">
          <div class="mact-header-avatar">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 8V4H8"/><rect x="8" y="8" width="8" height="12" rx="2"/><circle cx="10" cy="13" r="1"/><circle cx="14" cy="13" r="1"/>
            </svg>
          </div>
          <div class="mact-header-text">
            <h3>${companyName}</h3>
            <p>We typically reply within minutes</p>
          </div>
        </div>
        <button class="mact-header-close" aria-label="Close chat">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="mact-content">
        <div class="mact-messages"></div>
        <div class="mact-input-area">
          <input type="text" class="mact-input" placeholder="Type your message..." />
          <button class="mact-send" style="background-color: ${primaryColor};">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="mact-footer">
        Powered by <a href="https://mact.au" target="_blank" rel="noopener">MACt</a>
      </div>
    `;

    // Launcher wrapper (holds optional text + bubble)
    const launcher = document.createElement('div');
    launcher.className = 'mact-launcher';

    // Optional bubble text
    const showBubbleText = settings?.appearance?.showBubbleText === true;
    if (showBubbleText) {
      const textEl = document.createElement('span');
      textEl.className = 'mact-launcher-text';
      textEl.textContent = 'Chat with us';
      launcher.appendChild(textEl);
    }

    // Bubble (circular FAB button)
    bubble = document.createElement('div');
    bubble.className = 'mact-bubble';
    bubble.setAttribute('aria-label', 'Open chat');
    bubble.innerHTML = `
      <svg class="mact-chat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <svg class="mact-close-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
    `;

    launcher.appendChild(bubble);

    // Add event listeners
    bubble.addEventListener('click', toggleChat);
    chatWindow.querySelector('.mact-header-close')?.addEventListener('click', toggleChat);

    // Input handling
    const input = chatWindow.querySelector('.mact-input');
    const sendBtn = chatWindow.querySelector('.mact-send');

    input?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const message = input.value.trim();
        if (message) {
          sendMessage(message);
          input.value = '';
        }
      }
    });

    sendBtn?.addEventListener('click', () => {
      const message = input?.value.trim();
      if (message) {
        sendMessage(message);
        input.value = '';
      }
    });

    // Assemble and append
    container.appendChild(chatWindow);
    container.appendChild(launcher);
    document.body.appendChild(container);
  }

  // Handle viewport resize
  function handleResize() {
    const wasIsMobile = isMobile;
    isMobile = window.innerWidth <= 768;

    // If device type changed, we may need to update visibility
    if (wasIsMobile !== isMobile && container) {
      const deviceSettings = getDeviceSettings();
      if (!deviceSettings.display) {
        container.style.display = 'none';
      } else {
        container.style.display = 'block';
        // Update position class
        container.className = `mact-widget-container position-${deviceSettings.position || 'right'}`;
      }
    }
  }

  // Initialize widget
  async function init() {
    visitorId = getVisitorId();
    await fetchSettings();
    createStyles();
    createWidget();

    // Listen for viewport changes
    window.addEventListener('resize', handleResize);

    console.log('MACt Chat Widget initialized');
  }

  // Wait for DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose API for external control
  window.MActChat = {
    open: () => { if (!isOpen) toggleChat(); },
    close: () => { if (isOpen) toggleChat(); },
    toggle: toggleChat,
  };
})();
