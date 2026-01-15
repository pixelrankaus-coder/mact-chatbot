# MACt Chatbot - API Reference

## Widget API (Public)

These endpoints are CORS-enabled for use by the embeddable widget.

---

### GET /api/widget/settings

Returns widget appearance and AI settings.

**Response:**
```json
{
  "appearance": {
    "primaryColor": "#3b82f6",
    "companyName": "MACt",
    "welcomeMessage": "Hi! How can I help?",
    "position": "right",
    "offsetX": 20,
    "offsetY": 20,
    "buttonSize": 60,
    "zIndex": 9999
  },
  "aiAgent": {
    "enabled": true,
    "name": "MACt Assistant",
    "personality": "professional",
    "responseLength": 50
  },
  "operatingHours": {
    "enabled": true,
    "timezone": "Australia/Perth"
  }
}
```

---

### POST /api/widget/conversations

Creates or retrieves a conversation for a visitor.

**Request:**
```json
{
  "visitorId": "visitor_123_abc",
  "metadata": {
    "currentPage": "https://mact.au/products",
    "pageTitle": "GFRC Products",
    "referrer": "https://google.com",
    "browser": "Chrome 120",
    "os": "Windows",
    "deviceType": "Desktop",
    "screenResolution": "1920x1080",
    "timezone": "Australia/Sydney",
    "language": "en-AU"
  }
}
```

**Response:**
```json
{
  "conversation": {
    "id": "uuid-here",
    "visitor_id": "visitor_123_abc",
    "status": "active",
    "created_at": "2026-01-16T10:00:00Z"
  },
  "messages": []
}
```

---

### GET /api/widget/conversations

Get conversations for a visitor.

**Query Params:**
- `visitorId` (required): Visitor identifier

**Response:**
```json
{
  "conversations": [
    {
      "id": "uuid-here",
      "visitor_id": "visitor_123_abc",
      "status": "active",
      "created_at": "2026-01-16T10:00:00Z"
    }
  ]
}
```

---

### GET /api/widget/conversations/[id]/messages

Get messages for a conversation.

**Query Params:**
- `since` (optional): ISO timestamp for polling new messages only

**Response:**
```json
{
  "messages": [
    {
      "id": "uuid",
      "conversation_id": "uuid",
      "sender_type": "visitor",
      "sender_name": "Visitor",
      "content": "Do you sell GFRC panels?",
      "created_at": "2026-01-16T10:00:00Z"
    },
    {
      "id": "uuid",
      "conversation_id": "uuid",
      "sender_type": "ai",
      "sender_name": "MACt Assistant",
      "content": "Yes! We offer a wide range of GFRC panels...",
      "created_at": "2026-01-16T10:00:05Z"
    }
  ]
}
```

---

### POST /api/widget/conversations/[id]/messages

Send a message and get AI response.

**Request:**
```json
{
  "content": "Do you sell GFRC?",
  "visitorInfo": {
    "name": "John",
    "email": "john@example.com"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": {
    "id": "uuid",
    "sender_type": "visitor",
    "content": "Do you sell GFRC?",
    "created_at": "2026-01-16T10:00:00Z"
  },
  "aiResponse": {
    "id": "uuid",
    "sender_type": "ai",
    "content": "Yes! We specialize in GFRC products...",
    "created_at": "2026-01-16T10:00:05Z"
  }
}
```

---

### POST /api/widget/conversations/[id]/handoff

Request human agent handoff.

**Request:**
```json
{
  "name": "John",
  "email": "john@example.com",
  "message": "I need help with a large order"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Handoff request submitted"
}
```

---

## Admin API (Protected)

These endpoints are used by the admin dashboard.

---

### POST /api/chat

Generate AI response (used by inbox for agent-triggered AI responses).

**Request:**
```json
{
  "conversationId": "uuid",
  "message": "Customer asked about pricing",
  "history": [
    {"role": "user", "content": "Previous message"},
    {"role": "assistant", "content": "Previous response"}
  ]
}
```

**Response:**
```json
{
  "response": "AI generated response text",
  "usage": {
    "prompt_tokens": 150,
    "completion_tokens": 50,
    "total_tokens": 200
  },
  "model": "gpt-4o-mini"
}
```

---

### GET /api/orders/lookup

WooCommerce order lookup.

**Query Params:**
- `order_number`: Order number to look up
- `email`: Customer email to look up orders

**Response (by order number):**
```json
{
  "found": true,
  "order": {
    "id": 123,
    "number": "123",
    "status": "processing",
    "total": "1500.00",
    "currency": "AUD",
    "date_created": "2026-01-15T10:00:00Z",
    "billing": {
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@example.com"
    },
    "line_items": [
      {
        "name": "GFRC Panel - Large",
        "quantity": 2,
        "total": "1500.00"
      }
    ]
  }
}
```

---

### POST /api/knowledge-base/upload

Upload file to knowledge base.

**Request:** `multipart/form-data`
- `file`: File to upload (PDF, DOCX, XLSX, TXT)

**Response:**
```json
{
  "success": true,
  "document": {
    "id": "uuid",
    "filename": "product-specs.pdf",
    "file_type": "application/pdf",
    "file_size": 1024000,
    "status": "processing"
  }
}
```

---

### GET /api/knowledge-base/upload

List all knowledge base documents.

**Response:**
```json
{
  "documents": [
    {
      "id": "uuid",
      "filename": "product-specs.pdf",
      "file_type": "application/pdf",
      "file_size": 1024000,
      "status": "ready",
      "created_at": "2026-01-15T10:00:00Z"
    }
  ]
}
```

---

### DELETE /api/knowledge-base/upload

Delete a knowledge base document.

**Query Params:**
- `id`: Document UUID to delete

**Response:**
```json
{
  "success": true
}
```

---

### POST /api/knowledge-base/process/[id]

Process uploaded file (extract text content).

**Response:**
```json
{
  "success": true,
  "document": {
    "id": "uuid",
    "status": "ready",
    "content": "Extracted text content..."
  }
}
```

---

### GET /api/knowledge-base/scrape

Scrape URL for knowledge base content.

**Query Params:**
- `url`: URL to scrape

**Response:**
```json
{
  "success": true,
  "content": "Scraped page content...",
  "title": "Page Title"
}
```

---

### POST /api/notifications

Handle notification events.

**Request:**
```json
{
  "event": "handoff_requested",
  "conversationId": "uuid",
  "data": {}
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Error message description",
  "code": "ERROR_CODE"
}
```

**Common HTTP Status Codes:**
- `400` - Bad Request (missing/invalid parameters)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error

---

## CORS Configuration

Widget API endpoints (`/api/widget/*`) include these headers:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type`
