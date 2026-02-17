(function() {
  'use strict';

  // Determine API base URL from the script tag src
  var scripts = document.getElementsByTagName('script');
  var currentScript = scripts[scripts.length - 1];
  var scriptSrc = currentScript.getAttribute('src') || '';
  var BASE_URL = scriptSrc.replace(/\/widget\.js.*$/, '');
  if (!BASE_URL || BASE_URL === scriptSrc) {
    BASE_URL = 'https://app.mact.au';
  }

  var storeId = currentScript.getAttribute('data-store-id') || 'mact-store-001';

  // State
  var isOpen = false;
  var isLoaded = false;
  var settings = null;
  var bubble = null;
  var chatContainer = null;
  var iframe = null;

  // Default settings
  var defaults = {
    primaryColor: '#2563eb',
    position: 'bottom-right',
    offsetX: 20,
    offsetY: 20,
    bubbleSize: 'medium',
    bubbleIconColor: '#ffffff',
    zIndex: 999999,
    desktop: { display: true },
    mobile: { display: true },
  };

  // Fetch widget settings
  function fetchSettings() {
    return fetch(BASE_URL + '/api/widget/settings')
      .then(function(res) { return res.json(); })
      .then(function(data) {
        settings = Object.assign({}, defaults, data.appearance || {});
        return settings;
      })
      .catch(function() {
        settings = defaults;
        return settings;
      });
  }

  // Check if mobile
  function isMobile() {
    return window.innerWidth <= 768;
  }

  // Get bubble size in pixels
  function getBubbleSize() {
    var sizes = { small: 50, medium: 60, large: 70 };
    return sizes[settings.bubbleSize] || 60;
  }

  // Create the chat bubble
  function createBubble() {
    var mobile = isMobile();
    if (mobile && settings.mobile && !settings.mobile.display) return;
    if (!mobile && settings.desktop && !settings.desktop.display) return;

    var size = getBubbleSize();
    var color = settings.primaryColor || '#2563eb';
    var iconColor = settings.bubbleIconColor || '#ffffff';

    bubble = document.createElement('div');
    bubble.id = 'mact-chat-bubble';
    bubble.setAttribute('role', 'button');
    bubble.setAttribute('aria-label', 'Open chat');
    bubble.setAttribute('tabindex', '0');
    bubble.style.cssText = [
      'position:fixed',
      'bottom:' + (settings.offsetY || 20) + 'px',
      'right:' + (settings.offsetX || 20) + 'px',
      'width:' + size + 'px',
      'height:' + size + 'px',
      'border-radius:50%',
      'background:' + color,
      'cursor:pointer',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'box-shadow:0 4px 12px rgba(0,0,0,0.15)',
      'z-index:' + (settings.zIndex || 999999),
      'transition:transform 0.2s ease,box-shadow 0.2s ease',
      'border:none',
      'outline:none',
    ].join(';');

    // Chat icon SVG
    bubble.innerHTML = '<svg width="' + (size * 0.45) + '" height="' + (size * 0.45) + '" viewBox="0 0 24 24" fill="none" stroke="' + iconColor + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';

    bubble.addEventListener('mouseenter', function() {
      bubble.style.transform = 'scale(1.1)';
      bubble.style.boxShadow = '0 6px 20px rgba(0,0,0,0.2)';
    });
    bubble.addEventListener('mouseleave', function() {
      bubble.style.transform = isOpen ? 'scale(0)' : 'scale(1)';
      bubble.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    });

    bubble.addEventListener('click', toggleChat);
    bubble.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleChat();
      }
    });

    document.body.appendChild(bubble);
  }

  // Create the chat container with iframe
  function createChatContainer() {
    var mobile = isMobile();
    var width = mobile ? '100%' : '400px';
    var height = mobile ? '100%' : '600px';
    var bottom = mobile ? '0' : ((settings.offsetY || 20) + getBubbleSize() + 12) + 'px';
    var right = mobile ? '0' : (settings.offsetX || 20) + 'px';
    var borderRadius = mobile ? '0' : '16px';

    chatContainer = document.createElement('div');
    chatContainer.id = 'mact-chat-container';
    chatContainer.style.cssText = [
      'position:fixed',
      'bottom:' + bottom,
      'right:' + right,
      'width:' + width,
      'height:' + height,
      'max-height:' + (mobile ? '100vh' : '80vh'),
      'z-index:' + ((settings.zIndex || 999999) + 1),
      'border-radius:' + borderRadius,
      'overflow:hidden',
      'box-shadow:0 8px 32px rgba(0,0,0,0.15)',
      'display:none',
      'opacity:0',
      'transform:translateY(10px)',
      'transition:opacity 0.25s ease,transform 0.25s ease',
    ].join(';');

    iframe = document.createElement('iframe');
    iframe.id = 'mact-chat-iframe';
    iframe.src = BASE_URL + '/chat?embed=true&storeId=' + encodeURIComponent(storeId);
    iframe.style.cssText = 'width:100%;height:100%;border:none;border-radius:' + borderRadius;
    iframe.setAttribute('allow', 'microphone');
    iframe.setAttribute('title', 'MACt Chat');

    chatContainer.appendChild(iframe);
    document.body.appendChild(chatContainer);
    isLoaded = true;
  }

  // Toggle chat open/close
  function toggleChat() {
    if (!isLoaded) {
      createChatContainer();
    }

    isOpen = !isOpen;

    if (isOpen) {
      chatContainer.style.display = 'block';
      // Force reflow for animation
      chatContainer.offsetHeight;
      chatContainer.style.opacity = '1';
      chatContainer.style.transform = 'translateY(0)';
      bubble.style.transform = 'scale(0)';
      setTimeout(function() { bubble.style.display = 'none'; }, 200);
    } else {
      chatContainer.style.opacity = '0';
      chatContainer.style.transform = 'translateY(10px)';
      bubble.style.display = 'flex';
      // Force reflow
      bubble.offsetHeight;
      bubble.style.transform = 'scale(1)';
      setTimeout(function() { chatContainer.style.display = 'none'; }, 250);
    }
  }

  // Listen for messages from iframe
  window.addEventListener('message', function(event) {
    // Only accept messages from our iframe
    if (event.origin !== BASE_URL && event.origin !== window.location.origin) return;

    var data = event.data;
    if (!data || !data.type) return;

    switch (data.type) {
      case 'mact-chat-close':
        if (isOpen) toggleChat();
        break;
      case 'mact-chat-minimize':
        if (isOpen) toggleChat();
        break;
      case 'mact-chat-ready':
        // Chat page loaded, send settings
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({
            type: 'mact-widget-settings',
            settings: settings,
            baseUrl: BASE_URL,
            storeId: storeId,
          }, '*');
        }
        break;
    }
  });

  // Initialize
  function init() {
    fetchSettings().then(function() {
      createBubble();
    });
  }

  // Wait for DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose API
  window.MACTChat = {
    open: function() { if (!isOpen) toggleChat(); },
    close: function() { if (isOpen) toggleChat(); },
    toggle: toggleChat,
  };
})();
