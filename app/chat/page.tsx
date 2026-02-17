"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────────────────
interface Message {
  id: string;
  conversation_id: string;
  sender_type: "visitor" | "ai" | "agent" | "system";
  sender_name: string;
  content: string;
  created_at: string;
}

interface PrechatField {
  id: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
}

interface PrechatConfig {
  enabled: boolean;
  title?: string;
  subtitle?: string;
  fields?: PrechatField[];
}

interface WidgetSettings {
  appearance?: {
    primaryColor?: string;
    companyName?: string;
  };
  aiAgent?: {
    name?: string;
    welcomeMessage?: string;
  };
}

// ─── Constants ───────────────────────────────────────────────────────
const POLL_INTERVAL = 3000;

// ─── Helpers ─────────────────────────────────────────────────────────
function getBaseUrl(): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  // If embedded, use the parent origin; otherwise use current origin
  return params.get("baseUrl") || window.location.origin;
}

function getOrCreateVisitorId(): string {
  const key = "mact_visitor_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = "v_" + Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem(key, id);
  }
  return id;
}

// ─── Component ───────────────────────────────────────────────────────
export default function ChatPage() {
  const baseUrl = useRef(getBaseUrl());
  const visitorId = useRef(getOrCreateVisitorId());

  const [phase, setPhase] = useState<"loading" | "prechat" | "chat">("loading");
  const [settings, setSettings] = useState<WidgetSettings>({});
  const [prechatConfig, setPrechatConfig] = useState<PrechatConfig>({ enabled: false });
  const [prechatData, setPrechatData] = useState<Record<string, string>>({});
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageTime = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sendingRef = useRef(false);

  const primaryColor = settings.appearance?.primaryColor || "#2563eb";
  const agentName = settings.aiAgent?.name || "MACt Assistant";

  // ─── Init: fetch settings + prechat config ──────────────────────
  useEffect(() => {
    const url = baseUrl.current;

    Promise.all([
      fetch(`${url}/api/widget/settings`).then((r) => r.json()).catch(() => ({})),
      fetch(`${url}/api/widget/prechat-config`).then((r) => r.json()).catch(() => ({ enabled: false })),
      fetch(`${url}/api/widget/status`).then((r) => r.json()).catch(() => ({ online: true })),
    ]).then(([settingsData, prechatData, statusData]) => {
      setSettings(settingsData);
      setPrechatConfig(prechatData);
      setIsOnline(statusData.online !== false);

      // Check for existing conversation
      fetch(`${url}/api/widget/conversations?visitorId=${visitorId.current}`)
        .then((r) => r.json())
        .then((data) => {
          const activeConv = (data.conversations || []).find(
            (c: { status: string }) => c.status === "active"
          );
          if (activeConv) {
            setConversationId(activeConv.id);
            setPhase("chat");
            loadMessages(activeConv.id);
          } else if (prechatData.enabled) {
            setPhase("prechat");
          } else {
            startConversation({});
          }
        })
        .catch(() => {
          if (prechatData.enabled) {
            setPhase("prechat");
          } else {
            startConversation({});
          }
        });
    });

    // Tell parent widget we're ready
    window.parent.postMessage({ type: "mact-chat-ready" }, "*");

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Auto-scroll ────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ─── Start conversation ─────────────────────────────────────────
  const startConversation = useCallback(
    async (formData: Record<string, string>) => {
      try {
        const res = await fetch(`${baseUrl.current}/api/widget/conversations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            visitorId: visitorId.current,
            visitorName: formData.name || "Website Visitor",
            visitorEmail: formData.email || null,
            prechatData: formData,
          }),
        });
        const data = await res.json();
        if (data.conversation) {
          setConversationId(data.conversation.id);
          setPhase("chat");
          loadMessages(data.conversation.id);
        }
      } catch (err) {
        console.error("Failed to start conversation:", err);
      }
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ─── Load messages + start polling ──────────────────────────────
  const loadMessages = useCallback(
    (convId: string) => {
      fetch(`${baseUrl.current}/api/widget/conversations/${convId}/messages`)
        .then((r) => r.json())
        .then((data) => {
          const msgs = data.messages || [];
          setMessages(msgs);
          if (msgs.length > 0) {
            lastMessageTime.current = msgs[msgs.length - 1].created_at;
          }
        })
        .catch(console.error);

      // Start polling for new messages
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(() => {
        // Skip poll updates while a message is being sent to avoid duplicates
        if (sendingRef.current) return;

        const since = lastMessageTime.current;
        const url = since
          ? `${baseUrl.current}/api/widget/conversations/${convId}/messages?since=${encodeURIComponent(since)}`
          : `${baseUrl.current}/api/widget/conversations/${convId}/messages`;

        fetch(url)
          .then((r) => r.json())
          .then((data) => {
            const newMsgs = data.messages || [];
            if (newMsgs.length > 0) {
              setMessages((prev) => {
                const existingIds = new Set(prev.map((m) => m.id));
                const unique = newMsgs.filter((m: Message) => !existingIds.has(m.id));
                if (unique.length === 0) return prev;
                const updated = [...prev, ...unique];
                lastMessageTime.current = updated[updated.length - 1].created_at;
                return updated;
              });
            }
          })
          .catch(() => {});
      }, POLL_INTERVAL);
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ─── Send message ───────────────────────────────────────────────
  const sendMessage = async () => {
    // Use ref to prevent double-sends from React state batching race conditions
    if (!inputValue.trim() || !conversationId || sendingRef.current) return;
    sendingRef.current = true;

    const content = inputValue.trim();
    setInputValue("");
    setSending(true);

    // Optimistic: add visitor message immediately
    const tempId = "temp_" + Date.now();
    const optimisticMsg: Message = {
      id: tempId,
      conversation_id: conversationId,
      sender_type: "visitor",
      sender_name: "You",
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const res = await fetch(
        `${baseUrl.current}/api/widget/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, visitorId: visitorId.current }),
        }
      );
      const data = await res.json();

      setMessages((prev) => {
        // Remove optimistic message
        let updated = prev.filter((m) => m.id !== tempId);
        if (data.userMessage) {
          // Remove any poll-added duplicate before adding
          updated = updated.filter((m) => m.id !== data.userMessage.id);
          updated = [...updated, data.userMessage];
          lastMessageTime.current = data.userMessage.created_at;
        }
        if (data.botMessage) {
          // Remove any poll-added duplicate before adding
          updated = updated.filter((m) => m.id !== data.botMessage.id);
          updated = [...updated, data.botMessage];
          lastMessageTime.current = data.botMessage.created_at;
        }
        return updated;
      });
    } catch (err) {
      console.error("Failed to send message:", err);
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInputValue(content); // restore input
    } finally {
      setSending(false);
      sendingRef.current = false;
    }
  };

  // ─── Handle close ───────────────────────────────────────────────
  const handleClose = () => {
    window.parent.postMessage({ type: "mact-chat-close" }, "*");
  };

  // ─── Render: Loading ────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div style={styles.container}>
        <div style={{ ...styles.header, background: primaryColor }}>
          <div style={styles.headerText}>
            <div style={styles.headerTitle}>{agentName}</div>
          </div>
          <button onClick={handleClose} style={styles.closeBtn} aria-label="Close">
            ✕
          </button>
        </div>
        <div style={styles.loadingBody}>
          <div style={styles.spinner} />
          <p style={{ color: "#6b7280", marginTop: 12 }}>Loading chat...</p>
        </div>
      </div>
    );
  }

  // ─── Render: Pre-chat Form ──────────────────────────────────────
  if (phase === "prechat") {
    const fields = prechatConfig.fields || [
      { id: "name", label: "Name", type: "text", required: true, placeholder: "Your name" },
      { id: "email", label: "Email", type: "email", required: true, placeholder: "your@email.com" },
    ];

    const handlePrechatSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      startConversation(prechatData);
    };

    return (
      <div style={styles.container}>
        <div style={{ ...styles.header, background: primaryColor }}>
          <div style={styles.headerText}>
            <div style={styles.headerTitle}>{agentName}</div>
            <div style={styles.headerSubtitle}>
              {isOnline ? "We typically reply in a few minutes" : "Leave a message, we'll get back to you"}
            </div>
          </div>
          <button onClick={handleClose} style={styles.closeBtn} aria-label="Close">
            ✕
          </button>
        </div>
        <div style={styles.prechatBody}>
          <h3 style={styles.prechatTitle}>
            {prechatConfig.title || "Start a conversation"}
          </h3>
          {prechatConfig.subtitle && (
            <p style={styles.prechatSubtitle}>{prechatConfig.subtitle}</p>
          )}
          <form onSubmit={handlePrechatSubmit} style={styles.prechatForm}>
            {fields.map((field) => (
              <div key={field.id} style={styles.fieldGroup}>
                <label style={styles.label}>
                  {field.label}
                  {field.required && <span style={{ color: "#ef4444" }}> *</span>}
                </label>
                {field.type === "textarea" ? (
                  <textarea
                    style={{ ...styles.input, minHeight: 80, resize: "vertical" as const }}
                    placeholder={field.placeholder}
                    required={field.required}
                    value={prechatData[field.id] || ""}
                    onChange={(e) =>
                      setPrechatData((prev) => ({ ...prev, [field.id]: e.target.value }))
                    }
                  />
                ) : field.type === "select" && field.options ? (
                  <select
                    style={styles.input}
                    required={field.required}
                    value={prechatData[field.id] || ""}
                    onChange={(e) =>
                      setPrechatData((prev) => ({ ...prev, [field.id]: e.target.value }))
                    }
                  >
                    <option value="">Select...</option>
                    {field.options.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type || "text"}
                    style={styles.input}
                    placeholder={field.placeholder}
                    required={field.required}
                    value={prechatData[field.id] || ""}
                    onChange={(e) =>
                      setPrechatData((prev) => ({ ...prev, [field.id]: e.target.value }))
                    }
                  />
                )}
              </div>
            ))}
            <button
              type="submit"
              style={{ ...styles.submitBtn, background: primaryColor }}
            >
              Start Chat
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ─── Render: Chat ───────────────────────────────────────────────
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={{ ...styles.header, background: primaryColor }}>
        <div style={styles.headerText}>
          <div style={styles.headerTitle}>{agentName}</div>
          <div style={styles.headerSubtitle}>
            {isOnline ? "Online" : "Offline"}
          </div>
        </div>
        <button onClick={handleClose} style={styles.closeBtn} aria-label="Close">
          ✕
        </button>
      </div>

      {/* Messages */}
      <div style={styles.messagesContainer}>
        {messages.map((msg) => {
          const isVisitor = msg.sender_type === "visitor";
          return (
            <div
              key={msg.id}
              style={{
                ...styles.messageRow,
                justifyContent: isVisitor ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  ...styles.messageBubble,
                  ...(isVisitor
                    ? { background: primaryColor, color: "#fff", borderBottomRightRadius: 4 }
                    : { background: "#f3f4f6", color: "#1f2937", borderBottomLeftRadius: 4 }),
                }}
              >
                {!isVisitor && (
                  <div style={styles.senderName}>{msg.sender_name}</div>
                )}
                <div style={styles.messageContent}>{msg.content}</div>
                <div
                  style={{
                    ...styles.messageTime,
                    color: isVisitor ? "rgba(255,255,255,0.7)" : "#9ca3af",
                  }}
                >
                  {new Date(msg.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
          );
        })}
        {sending && (
          <div style={{ ...styles.messageRow, justifyContent: "flex-start" }}>
            <div style={{ ...styles.messageBubble, background: "#f3f4f6", color: "#9ca3af" }}>
              <div style={styles.typingDots}>
                <span style={styles.dot}>●</span>
                <span style={{ ...styles.dot, animationDelay: "0.2s" }}>●</span>
                <span style={{ ...styles.dot, animationDelay: "0.4s" }}>●</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={styles.inputContainer}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          style={styles.inputForm}
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type a message..."
            style={styles.chatInput}
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || sending}
            style={{
              ...styles.sendBtn,
              background: inputValue.trim() ? primaryColor : "#d1d5db",
              cursor: inputValue.trim() ? "pointer" : "default",
            }}
            aria-label="Send message"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
        <div style={styles.poweredBy}>
          Powered by <strong>MACt</strong>
        </div>
      </div>
    </div>
  );
}

// ─── Styles (inline for iframe isolation) ─────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    width: "100%",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 14,
    background: "#fff",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px",
    color: "#fff",
    flexShrink: 0,
  },
  headerText: { flex: 1 },
  headerTitle: { fontWeight: 600, fontSize: 16 },
  headerSubtitle: { fontSize: 12, opacity: 0.85, marginTop: 2 },
  closeBtn: {
    background: "rgba(255,255,255,0.2)",
    border: "none",
    color: "#fff",
    width: 32,
    height: 32,
    borderRadius: "50%",
    cursor: "pointer",
    fontSize: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  loadingBody: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  spinner: {
    width: 32,
    height: 32,
    border: "3px solid #e5e7eb",
    borderTopColor: "#2563eb",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  // Pre-chat form
  prechatBody: { flex: 1, padding: "24px 20px", overflowY: "auto" },
  prechatTitle: { fontSize: 18, fontWeight: 600, color: "#1f2937", margin: 0 },
  prechatSubtitle: { fontSize: 13, color: "#6b7280", marginTop: 4 },
  prechatForm: { marginTop: 20, display: "flex", flexDirection: "column", gap: 16 },
  fieldGroup: { display: "flex", flexDirection: "column", gap: 4 },
  label: { fontSize: 13, fontWeight: 500, color: "#374151" },
  input: {
    padding: "10px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    fontSize: 14,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  submitBtn: {
    padding: "12px",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 4,
  },
  // Messages
  messagesContainer: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 16px 8px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  messageRow: { display: "flex", width: "100%" },
  messageBubble: {
    maxWidth: "80%",
    padding: "10px 14px",
    borderRadius: 16,
    wordBreak: "break-word",
  },
  senderName: { fontSize: 11, fontWeight: 600, marginBottom: 2, opacity: 0.7 },
  messageContent: { fontSize: 14, lineHeight: 1.45, whiteSpace: "pre-wrap" },
  messageTime: { fontSize: 10, marginTop: 4, textAlign: "right" },
  typingDots: { display: "flex", gap: 4, padding: "4px 0" },
  dot: { fontSize: 10, animation: "pulse 1s infinite" },
  // Input
  inputContainer: {
    borderTop: "1px solid #e5e7eb",
    padding: "12px 16px 8px",
    flexShrink: 0,
    background: "#fff",
  },
  inputForm: { display: "flex", gap: 8, alignItems: "center" },
  chatInput: {
    flex: 1,
    padding: "10px 14px",
    border: "1px solid #d1d5db",
    borderRadius: 24,
    fontSize: 14,
    outline: "none",
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  poweredBy: {
    textAlign: "center",
    fontSize: 10,
    color: "#9ca3af",
    padding: "6px 0 2px",
  },
};
