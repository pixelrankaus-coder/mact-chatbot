(function() {
  'use strict';

  // Widget version - increment on each release
  const WIDGET_VERSION = '1.4.0';

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

  // Pre-chat form state
  let prechatConfig = null;
  let prechatCompleted = false;
  let prechatData = null;

  // Rating state
  let showRatingPrompt = false;
  let selectedRating = 0;
  let ratingFeedback = '';
  let ratingSubmitted = false;
  let lastActivityTime = Date.now();
  let ratingCheckInterval = null;
  const RATING_INACTIVITY_MS = 5 * 60 * 1000; // 5 minutes

  // DOM elements
  let shadowHost = null;
  let shadowRoot = null;
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

  // Fetch pre-chat form configuration
  async function fetchPrechatConfig() {
    try {
      const response = await fetch(`${apiBase}/api/widget/prechat-config`);
      if (!response.ok) throw new Error('Failed to fetch prechat config');
      prechatConfig = await response.json();

      // Check localStorage for existing submission
      const stored = localStorage.getItem(`mact_prechat_${storeId}`);
      if (stored) {
        prechatData = JSON.parse(stored);
        prechatCompleted = true;
      }

      return prechatConfig;
    } catch (error) {
      console.error('MACt Widget: Failed to load prechat config', error);
      prechatConfig = { enabled: false };
      return prechatConfig;
    }
  }

  // Create or get existing conversation
  async function getOrCreateConversation(withPrechatData = null) {
    try {
      const response = await fetch(`${apiBase}/api/widget/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorId,
          storeId,
          visitorName: withPrechatData?.name || prechatData?.name,
          visitorEmail: withPrechatData?.email || prechatData?.email,
          prechatData: withPrechatData || prechatData,
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

    // Update activity timestamp
    updateActivity();

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

      // User messages: bubble only (no avatar)
      // Bot messages: avatar + bubble
      return `
        <div class="mact-message ${isUser ? 'mact-message-user' : 'mact-message-bot'}">
          ${!isUser ? `<div class="mact-msg-avatar" style="background-color: ${primaryColor}20; color: ${primaryColor};">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 8V4H8"/><rect x="8" y="8" width="8" height="12" rx="2"/><circle cx="10" cy="13" r="1"/><circle cx="14" cy="13" r="1"/>
            </svg>
          </div>` : ''}
          <div class="mact-msg-bubble ${isUser ? 'mact-msg-bubble-user' : 'mact-msg-bubble-bot'}"${isUser ? ` style="background-color: ${primaryColor};"` : ''}${hasError ? ' style="opacity: 0.6;"' : ''}>
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

  // Check if rating was already submitted for this conversation
  function checkRatingStatus() {
    if (!conversation) return false;
    const ratedKey = `mact_rated_${conversation.id}`;
    return localStorage.getItem(ratedKey) !== null;
  }

  // Check for inactivity and show rating prompt
  function checkInactivity() {
    if (!conversation || !isOpen) return;
    if (ratingSubmitted || showRatingPrompt) return;
    if (checkRatingStatus()) return;
    if (messages.length < 2) return; // Need at least one exchange

    const timeSinceActivity = Date.now() - lastActivityTime;
    if (timeSinceActivity >= RATING_INACTIVITY_MS) {
      showRatingPrompt = true;
      renderRatingPrompt();
    }
  }

  // Start rating check interval
  function startRatingCheck() {
    if (ratingCheckInterval) return;
    ratingCheckInterval = setInterval(checkInactivity, 30000); // Check every 30s
  }

  // Stop rating check interval
  function stopRatingCheck() {
    if (ratingCheckInterval) {
      clearInterval(ratingCheckInterval);
      ratingCheckInterval = null;
    }
  }

  // Update activity timestamp
  function updateActivity() {
    lastActivityTime = Date.now();
  }

  // Render rating prompt
  function renderRatingPrompt() {
    const content = chatWindow?.querySelector('.mact-content');
    if (!content) return;

    const primaryColor = settings?.appearance?.primaryColor || '#2563eb';

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'mact-rating-overlay';

    if (ratingSubmitted) {
      overlay.innerHTML = `
        <div class="mact-rating-prompt">
          <div class="mact-rating-thanks">
            <div class="mact-rating-thanks-icon">✓</div>
            <p>Thank you for your feedback!</p>
          </div>
        </div>
      `;
    } else {
      const starsHtml = [1, 2, 3, 4, 5].map(n => `
        <button class="mact-rating-star ${n <= selectedRating ? 'active' : ''}" data-rating="${n}">
          <svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
        </button>
      `).join('');

      overlay.innerHTML = `
        <div class="mact-rating-prompt">
          <p class="mact-rating-title">How was your experience?</p>
          <div class="mact-rating-stars">${starsHtml}</div>
          ${selectedRating > 0 ? `
            <div class="mact-rating-feedback">
              <textarea
                class="mact-rating-textarea"
                placeholder="Any additional feedback? (optional)"
                rows="3"
              >${ratingFeedback}</textarea>
            </div>
          ` : ''}
          <div class="mact-rating-actions">
            <button class="mact-rating-skip">Skip</button>
            <button class="mact-rating-submit" style="background-color: ${primaryColor};" ${selectedRating === 0 ? 'disabled' : ''}>Submit</button>
          </div>
        </div>
      `;
    }

    // Remove existing overlay if any
    const existingOverlay = content.querySelector('.mact-rating-overlay');
    if (existingOverlay) {
      existingOverlay.remove();
    }

    content.appendChild(overlay);

    // Add event listeners
    overlay.querySelectorAll('.mact-rating-star').forEach(star => {
      star.addEventListener('click', () => {
        selectedRating = parseInt(star.dataset.rating);
        renderRatingPrompt();
      });
    });

    const textarea = overlay.querySelector('.mact-rating-textarea');
    if (textarea) {
      textarea.addEventListener('input', (e) => {
        ratingFeedback = e.target.value;
      });
    }

    const skipBtn = overlay.querySelector('.mact-rating-skip');
    skipBtn?.addEventListener('click', skipRating);

    const submitBtn = overlay.querySelector('.mact-rating-submit');
    submitBtn?.addEventListener('click', submitRating);
  }

  // Submit rating
  async function submitRating() {
    if (selectedRating === 0 || !conversation) return;

    const submitBtn = chatWindow?.querySelector('.mact-rating-submit');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';
    }

    try {
      const response = await fetch(`${apiBase}/api/widget/conversations/${conversation.id}/rating`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: selectedRating,
          feedback: ratingFeedback.trim() || null,
        }),
      });

      if (response.ok) {
        ratingSubmitted = true;
        localStorage.setItem(`mact_rated_${conversation.id}`, 'true');
        renderRatingPrompt();

        // Hide after 2 seconds
        setTimeout(() => {
          hideRatingPrompt();
        }, 2000);
      }
    } catch (error) {
      console.error('MACt Widget: Failed to submit rating', error);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit';
      }
    }
  }

  // Skip rating
  function skipRating() {
    if (conversation) {
      localStorage.setItem(`mact_rated_${conversation.id}`, 'skipped');
    }
    hideRatingPrompt();
  }

  // Hide rating prompt
  function hideRatingPrompt() {
    showRatingPrompt = false;
    const overlay = chatWindow?.querySelector('.mact-rating-overlay');
    if (overlay) {
      overlay.remove();
    }
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
      startRatingCheck();
      updateActivity();
      scrollToBottom();
      // Focus input
      const input = chatWindow?.querySelector('.mact-input');
      if (input) setTimeout(() => input.focus(), 100);
    } else {
      stopPolling();
      stopRatingCheck();
    }
  }

  // Initialize conversation
  async function initConversation() {
    isLoading = true;
    renderLoadingState();

    // Check if prechat form is needed
    if (prechatConfig?.enabled && !prechatCompleted) {
      isLoading = false;
      renderPrechatForm();
      return;
    }

    await getOrCreateConversation();
    if (conversation) {
      await fetchMessages();
    }

    isLoading = false;
    renderChatContent();
  }

  // Render pre-chat form
  function renderPrechatForm() {
    const content = chatWindow?.querySelector('.mact-content');
    if (!content || !prechatConfig) return;

    const primaryColor = settings?.appearance?.primaryColor || '#2563eb';

    // Build form fields HTML
    const fieldsHtml = prechatConfig.fields.map(field => {
      const requiredMark = field.required ? '<span class="mact-required">*</span>' : '';
      let inputHtml = '';

      if (field.type === 'select') {
        const optionsHtml = (field.options || []).map(opt =>
          `<option value="${opt}">${opt}</option>`
        ).join('');
        inputHtml = `
          <select class="mact-prechat-input" data-field-id="${field.id}" ${field.required ? 'required' : ''}>
            <option value="">${field.placeholder || 'Select...'}</option>
            ${optionsHtml}
          </select>
        `;
      } else if (field.type === 'textarea') {
        inputHtml = `
          <textarea class="mact-prechat-input" data-field-id="${field.id}"
            placeholder="${field.placeholder || ''}"
            rows="3"
            ${field.required ? 'required' : ''}></textarea>
        `;
      } else {
        inputHtml = `
          <input type="${field.type || 'text'}" class="mact-prechat-input"
            data-field-id="${field.id}"
            placeholder="${field.placeholder || ''}"
            ${field.required ? 'required' : ''} />
        `;
      }

      return `
        <div class="mact-prechat-field">
          <label class="mact-prechat-label">${field.label}${requiredMark}</label>
          ${inputHtml}
          <span class="mact-prechat-error" data-error-for="${field.id}"></span>
        </div>
      `;
    }).join('');

    content.innerHTML = `
      <div class="mact-prechat">
        <h3 class="mact-prechat-title">${prechatConfig.title || 'Start a conversation'}</h3>
        <p class="mact-prechat-subtitle">${prechatConfig.subtitle || 'Please fill in your details to begin'}</p>
        <form class="mact-prechat-form">
          ${fieldsHtml}
          <button type="submit" class="mact-prechat-submit" style="background-color: ${primaryColor};">
            Start Chat
          </button>
        </form>
      </div>
    `;

    // Add form submit handler
    const form = content.querySelector('.mact-prechat-form');
    form?.addEventListener('submit', handlePrechatSubmit);
  }

  // Handle pre-chat form submission
  async function handlePrechatSubmit(e) {
    e.preventDefault();

    const content = chatWindow?.querySelector('.mact-content');
    if (!content) return;

    // Gather form data
    const formData = {};
    const inputs = content.querySelectorAll('.mact-prechat-input');
    let hasErrors = false;

    // Clear previous errors
    content.querySelectorAll('.mact-prechat-error').forEach(el => {
      el.textContent = '';
      el.style.display = 'none';
    });
    content.querySelectorAll('.mact-prechat-input').forEach(el => {
      el.classList.remove('mact-error');
    });

    // Validate and collect data
    inputs.forEach(input => {
      const fieldId = input.getAttribute('data-field-id');
      const value = input.value.trim();
      formData[fieldId] = value;

      // Find field config
      const fieldConfig = prechatConfig.fields.find(f => f.id === fieldId);

      // Required validation
      if (fieldConfig?.required && !value) {
        hasErrors = true;
        input.classList.add('mact-error');
        const errorEl = content.querySelector(`[data-error-for="${fieldId}"]`);
        if (errorEl) {
          errorEl.textContent = 'Required';
          errorEl.style.display = 'block';
        }
      }

      // Email validation
      if (fieldConfig?.type === 'email' && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          hasErrors = true;
          input.classList.add('mact-error');
          const errorEl = content.querySelector(`[data-error-for="${fieldId}"]`);
          if (errorEl) {
            errorEl.textContent = 'Invalid email';
            errorEl.style.display = 'block';
          }
        }
      }
    });

    if (hasErrors) return;

    // Disable submit button
    const submitBtn = content.querySelector('.mact-prechat-submit');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Starting...';
    }

    // Store in localStorage and state
    localStorage.setItem(`mact_prechat_${storeId}`, JSON.stringify(formData));
    prechatData = formData;
    prechatCompleted = true;

    // Create conversation with prechat data
    isLoading = true;
    renderLoadingState();

    await getOrCreateConversation(formData);
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

  // Get bubble text size in pixels
  function getBubbleTextSize() {
    const size = settings?.appearance?.bubbleTextSize || 'medium';
    const sizes = { small: 12, medium: 14, large: 16 };
    return sizes[size] || 14;
  }

  // Get bubble padding
  function getBubblePadding() {
    const size = settings?.appearance?.bubblePadding || 'normal';
    // WhatsApp uses approximately 6px 12px for compact look
    const paddings = { compact: '6px 10px', normal: '8px 12px', spacious: '10px 16px' };
    return paddings[size] || '8px 12px';
  }

  // Create widget styles - returns style element for shadow DOM
  function createStyles() {
    const primaryColor = settings?.appearance?.primaryColor || settings?.appearance?.actionColor || '#2563eb';
    const offsetX = settings?.appearance?.offsetX ?? 20;
    const offsetY = settings?.appearance?.offsetY ?? 80;
    const bubbleSize = getBubbleSize();
    const bubbleIconColor = settings?.appearance?.bubbleIconColor || '#ffffff';
    const chatWindowHeight = getChatWindowHeight();
    const bubbleTextSize = getBubbleTextSize();
    const bubblePadding = getBubblePadding();
    const deviceSettings = getDeviceSettings();
    const widgetPosition = deviceSettings.position || 'right';

    // Calculate icon size (55% of bubble size)
    const iconSize = Math.round(bubbleSize * 0.55);

    const styles = document.createElement('style');
    styles.textContent = `
      /* Shadow DOM CSS - no !important needed, fully isolated */
      :host {
        all: initial;
      }

      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      .mact-widget-container {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
        font-size: 14px;
        line-height: 1.4;
        letter-spacing: normal;
        text-transform: none;
        text-decoration: none;
        color: #1e293b;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }

      .mact-widget-container.position-right {
        /* Position set on host */
      }
      .mact-widget-container.position-left {
        /* Position set on host */
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
      .mact-widget-container.position-right .mact-chat-window {
        right: 0;
      }
      .mact-widget-container.position-left .mact-chat-window {
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
        font-size: 15px;
        font-weight: 600;
        line-height: 1.3;
        color: white;
        margin: 0;
      }
      .mact-header-text p {
        margin: 2px 0 0 0;
        font-size: 11px;
        opacity: 0.9;
        line-height: 1.3;
        color: white;
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
      /* =======================================================
         MACt chat messages – Flexbox layout (Messenger-style)
         Based on: https://ishadeed.com/article/facebook-messenger-chat-component/
         ======================================================= */

      /* Messages container - flex column */
      .mact-messages {
        flex: 1;
        overflow-y: auto;
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        background: #ffffff;
      }

      /* Message row - flex container with max-width constraint */
      .mact-message {
        display: flex;
        align-items: flex-end;
        gap: 6px;
        max-width: 85%;
      }

      /* User messages - align entire row to right */
      .mact-message-user {
        align-self: flex-end;
      }

      /* Bot messages - align entire row to left */
      .mact-message-bot {
        align-self: flex-start;
      }

      /* Avatar */
      .mact-msg-avatar {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .mact-msg-avatar svg {
        width: 14px;
        height: 14px;
      }

      /* Bubble - block display, controlled by padding settings */
      .mact-msg-bubble {
        padding: ${bubblePadding};
        border-radius: 16px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif;
        font-size: ${bubbleTextSize}px;
        line-height: 1.35;
        word-break: break-word;
        white-space: pre-wrap;
      }

      /* User bubble colors */
      .mact-msg-bubble-user {
        background: ${primaryColor};
        color: #ffffff;
      }

      /* Bot bubble colors */
      .mact-msg-bubble-bot {
        background: #f1f5f9;
        color: #1e293b;
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
      .mact-input {
        flex: 1;
        border: 1px solid #e2e8f0;
        border-radius: 20px;
        padding: 8px 14px;
        font-size: 14px;
        font-family: inherit;
        outline: none;
        transition: border-color 0.2s;
        background: white;
        color: #1e293b;
      }
      .mact-input:focus {
        border-color: ${primaryColor};
      }
      .mact-input::placeholder {
        color: #94a3b8;
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

      .mact-human-link {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        background: none;
        border: none;
        color: #64748b;
        font-size: 12px;
        font-family: inherit;
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
        font-family: inherit;
        background: white;
        color: #1e293b;
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
        font-family: inherit;
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
        font-family: inherit;
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

      /* Pre-chat form styles */
      .mact-prechat {
        padding: 24px 20px;
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
      }
      .mact-prechat-title {
        font-size: 18px;
        font-weight: 600;
        margin: 0 0 4px;
        color: #1a1a1a;
      }
      .mact-prechat-subtitle {
        font-size: 14px;
        color: #666;
        margin: 0 0 20px;
      }
      .mact-prechat-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
        flex: 1;
      }
      .mact-prechat-field {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .mact-prechat-label {
        font-size: 14px;
        font-weight: 500;
        color: #333;
      }
      .mact-required {
        color: #ef4444;
        margin-left: 2px;
      }
      .mact-prechat-input {
        padding: 10px 12px;
        border: 1px solid #ddd;
        border-radius: 8px;
        font-size: 14px;
        font-family: inherit;
        transition: border-color 0.2s;
        background: white;
        color: #1e293b;
        width: 100%;
        box-sizing: border-box;
      }
      .mact-prechat-input:focus {
        outline: none;
        border-color: ${primaryColor};
      }
      .mact-prechat-input.mact-error {
        border-color: #ef4444;
      }
      .mact-prechat-error {
        font-size: 12px;
        color: #ef4444;
        display: none;
      }
      .mact-prechat-submit {
        margin-top: auto;
        padding: 12px;
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        font-family: inherit;
        cursor: pointer;
        transition: opacity 0.2s;
      }
      .mact-prechat-submit:hover {
        opacity: 0.9;
      }
      .mact-prechat-submit:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      textarea.mact-prechat-input {
        resize: none;
        min-height: 80px;
      }
      select.mact-prechat-input {
        appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 12px center;
        padding-right: 36px;
      }

      /* Rating prompt styles */
      .mact-rating-overlay {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        z-index: 15;
      }
      .mact-rating-prompt {
        background: white;
        border-radius: 12px;
        padding: 24px;
        width: 100%;
        max-width: 300px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        text-align: center;
      }
      .mact-rating-title {
        font-size: 16px;
        font-weight: 500;
        color: #1a1a1a;
        margin: 0 0 16px;
      }
      .mact-rating-stars {
        display: flex;
        justify-content: center;
        gap: 8px;
        margin-bottom: 16px;
      }
      .mact-rating-star {
        background: none;
        border: none;
        padding: 4px;
        cursor: pointer;
        color: #d1d5db;
        transition: color 0.15s, transform 0.15s;
      }
      .mact-rating-star:hover {
        transform: scale(1.1);
      }
      .mact-rating-star.active {
        color: #fbbf24;
      }
      .mact-rating-star svg {
        width: 28px;
        height: 28px;
        fill: currentColor;
      }
      .mact-rating-feedback {
        margin-bottom: 16px;
      }
      .mact-rating-textarea {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        font-size: 14px;
        resize: none;
        font-family: inherit;
        background: white;
        color: #1e293b;
        box-sizing: border-box;
      }
      .mact-rating-textarea:focus {
        outline: none;
        border-color: ${primaryColor};
      }
      .mact-rating-actions {
        display: flex;
        gap: 12px;
        justify-content: center;
      }
      .mact-rating-skip {
        padding: 8px 16px;
        background: none;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        color: #64748b;
        font-size: 14px;
        font-family: inherit;
        cursor: pointer;
        transition: background 0.2s;
      }
      .mact-rating-skip:hover {
        background: #f8fafc;
      }
      .mact-rating-submit {
        padding: 8px 20px;
        border: none;
        border-radius: 6px;
        color: white;
        font-size: 14px;
        font-weight: 500;
        font-family: inherit;
        cursor: pointer;
        transition: opacity 0.2s;
      }
      .mact-rating-submit:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .mact-rating-thanks {
        padding: 20px 0;
      }
      .mact-rating-thanks-icon {
        width: 48px;
        height: 48px;
        background: #22c55e;
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        margin: 0 auto 12px;
      }
      .mact-rating-thanks p {
        margin: 0;
        color: #1e293b;
        font-size: 15px;
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
      }
    `;
    return styles;
  }

  // Create widget DOM with Shadow DOM for CSS isolation
  function createWidget() {
    const deviceSettings = getDeviceSettings();
    const primaryColor = settings?.appearance?.primaryColor || settings?.appearance?.actionColor || '#2563eb';
    const companyName = settings?.appearance?.companyName || settings?.aiAgent?.name || 'Support';
    const offsetX = settings?.appearance?.offsetX ?? 20;
    const offsetY = settings?.appearance?.offsetY ?? 80;
    const zIndex = settings?.appearance?.zIndex ?? 999999;

    // Check if widget should be displayed on this device
    if (!deviceSettings.display) {
      console.log('MACt Widget: Hidden on this device type');
      return;
    }

    // Determine position - prefer new format, fall back to legacy
    const widgetPosition = deviceSettings.position || 'right';
    const positionClass = `position-${widgetPosition}`;

    // Create shadow host (this is the only element in the light DOM)
    shadowHost = document.createElement('div');
    shadowHost.id = 'mact-chat-widget-host';
    // Position the host element - this stays in light DOM but uses inline styles
    shadowHost.style.cssText = `
      position: fixed;
      ${widgetPosition === 'left' ? 'left' : 'right'}: ${offsetX}px;
      bottom: ${offsetY}px;
      z-index: ${zIndex};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Attach shadow root
    shadowRoot = shadowHost.attachShadow({ mode: 'open' });

    // Add styles to shadow root
    const styles = createStyles();
    shadowRoot.appendChild(styles);

    // Container (inside shadow DOM)
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
        Powered by <a href="https://mact.au" target="_blank" rel="noopener">MACt</a> <span style="opacity: 0.5;">v${WIDGET_VERSION}</span>
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

    // Assemble inside shadow DOM
    container.appendChild(chatWindow);
    container.appendChild(launcher);
    shadowRoot.appendChild(container);

    // Append shadow host to document body
    document.body.appendChild(shadowHost);
  }

  // Handle viewport resize
  function handleResize() {
    const wasIsMobile = isMobile;
    isMobile = window.innerWidth <= 768;

    // If device type changed, we may need to update visibility
    if (wasIsMobile !== isMobile && shadowHost) {
      const deviceSettings = getDeviceSettings();
      const offsetX = settings?.appearance?.offsetX ?? 20;
      const offsetY = settings?.appearance?.offsetY ?? 80;
      const zIndex = settings?.appearance?.zIndex ?? 999999;
      const widgetPosition = deviceSettings.position || 'right';

      if (!deviceSettings.display) {
        shadowHost.style.display = 'none';
      } else {
        // Update host position
        shadowHost.style.cssText = `
          position: fixed;
          ${widgetPosition === 'left' ? 'left' : 'right'}: ${offsetX}px;
          bottom: ${offsetY}px;
          z-index: ${zIndex};
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        // Update container position class
        if (container) {
          container.className = `mact-widget-container position-${widgetPosition}`;
        }
      }
    }
  }

  // Initialize widget
  async function init() {
    visitorId = getVisitorId();
    await fetchSettings();
    await fetchPrechatConfig();
    createWidget(); // createStyles() is called inside createWidget() now

    // Listen for viewport changes
    window.addEventListener('resize', handleResize);

    console.log(`MACt Chat Widget v${WIDGET_VERSION} initialized (Shadow DOM mode)`);
    console.log('MACt Settings:', {
      textAlign: settings?.appearance?.bubbleTextAlign,
      padding: settings?.appearance?.bubblePadding,
      textSize: settings?.appearance?.bubbleTextSize,
      prechatEnabled: prechatConfig?.enabled
    });
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
