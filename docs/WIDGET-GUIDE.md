# MACt Chatbot - Widget Installation Guide

## Quick Install

Add this script before `</body>` on your website:

```html
<script
  src="https://mact-chatbot.vercel.app/widget/chat-widget-v2.js"
  data-store-id="mact-store-001"
  data-api-base="https://mact-chatbot.vercel.app"
  defer>
</script>
```

The widget will appear as a floating chat button in the bottom-right corner.

---

## WordPress Plugin (Recommended)

### Installation

1. Download `mact-chatbot.zip` from `/wordpress-plugin/`
2. Go to WordPress Admin → Plugins → Add New → Upload Plugin
3. Upload the zip file and activate
4. Go to Settings → MACt Chatbot
5. Enter:
   - **Widget URL:** `https://mact-chatbot.vercel.app`
   - **Store ID:** `mact-store-001`
6. Check "Enable Chat Widget"
7. Save changes

### Plugin Features

- Auto-injects widget script into site footer
- Admin settings page for easy configuration
- Enable/disable toggle without uninstalling

---

## Configuration Options

### Script Attributes

| Attribute | Required | Default | Description |
|-----------|----------|---------|-------------|
| `data-store-id` | Yes | - | Your unique store identifier |
| `data-api-base` | Yes | - | API base URL (your Vercel deployment) |

### Example

```html
<script
  src="https://mact-chatbot.vercel.app/widget/chat-widget-v2.js"
  data-store-id="my-store-123"
  data-api-base="https://mact-chatbot.vercel.app"
  defer>
</script>
```

---

## Customization

Widget appearance is controlled via the Admin Panel (not script attributes).

### Appearance Settings

Go to **Settings → Appearance** in the admin panel:

| Setting | Description |
|---------|-------------|
| Primary Color | Main widget color (hex value) |
| Position | Left or right side of screen |
| Horizontal Offset | Distance from edge (pixels) |
| Vertical Offset | Distance from bottom (pixels) |
| Button Size | Chat button diameter (pixels) |
| Z-Index | CSS stacking order |

### AI Agent Settings

Go to **AI Agent** in the admin panel:

| Setting | Description |
|---------|-------------|
| AI Name | Name shown in chat (e.g., "MACt Assistant") |
| Welcome Message | First message when chat opens |
| Personality | Professional, friendly, or casual tone |
| Response Length | How detailed AI responses should be |
| Fallback Action | What to do when AI can't answer |

### Operating Hours

Go to **Settings → Operating Hours**:

- Set business hours for each day
- Configure timezone
- Set offline message

---

## Widget JavaScript API

Control the widget programmatically from your site's JavaScript:

```javascript
// Open the chat widget
window.MActChat.open();

// Close the chat widget
window.MActChat.close();

// Toggle open/closed
window.MActChat.toggle();

// Check if widget is open
if (window.MActChat.isOpen()) {
  console.log('Chat is open');
}
```

### Example: Open chat on button click

```html
<button onclick="window.MActChat.open()">
  Need Help?
</button>
```

---

## How the Widget Works

1. **Visitor ID**: Widget generates a unique ID stored in localStorage (`mact_visitor_id`)
2. **Settings Load**: Fetches appearance/AI settings from your API
3. **Conversation Created**: When visitor sends first message, conversation is created
4. **AI Response**: Messages are sent to API, AI generates response
5. **Polling**: Widget checks for new messages every 3 seconds
6. **Handoff**: Visitor can request human agent anytime

### Data Collected

The widget collects this visitor information (stored in conversation metadata):

| Data | Purpose |
|------|---------|
| Browser & Version | Debugging, analytics |
| Operating System | Debugging, analytics |
| Device Type | Mobile/Desktop optimization |
| Screen Resolution | Display debugging |
| Current Page URL | Context for support |
| Page Title | Context for support |
| Referrer | Traffic source analytics |
| Timezone | Scheduling, context |
| Language | Localization |
| Pages Viewed | Session context |

---

## Troubleshooting

### Widget not appearing

1. **Check browser console** for JavaScript errors
2. **Verify script URL** is correct and accessible
3. **Check plugin settings** if using WordPress (ensure enabled)
4. **Hard refresh** the page (Ctrl+Shift+R / Cmd+Shift+R)
5. **Check z-index** conflicts with other fixed elements

### Widget overlapping other elements

1. Go to **Settings → Appearance** in admin panel
2. Increase vertical offset (move up from bottom)
3. Increase horizontal offset (move away from edge)
4. Try switching position (left vs right)
5. Adjust z-index if needed

### Messages not sending

1. **Check browser console** for CORS or network errors
2. **Verify API base URL** is correct in script attributes
3. **Check Supabase** is running and accessible
4. **Verify environment variables** are set in Vercel

### Widget shows "Offline"

1. Check **Operating Hours** settings in admin
2. Verify timezone is correct
3. Ensure current time is within business hours
4. Check if AI agent is enabled

### Slow response times

1. Check OpenAI API status
2. Review knowledge base size (large docs = slower processing)
3. Check Supabase performance
4. Verify Vercel function isn't cold-starting

---

## Testing

### Local Testing

1. Run the development server: `npm run dev`
2. Visit `/widget-test` page
3. Widget loads with local API

### Staging Testing

1. Deploy to Vercel preview
2. Add widget script to test page with preview URL
3. Test all flows: chat, handoff, order lookup

### Production Testing

1. Install on staging site first (e.g., pix1.dev/mact)
2. Test complete user journey
3. Verify in inbox that conversations appear
4. Check visitor info is captured correctly

---

## Version History

| Version | Changes |
|---------|---------|
| v2.0.3 | Current stable version |
| v2.0.0 | Web Components + Shadow DOM rewrite |
| v1.x | Legacy iframe-based widget |

---

## Support

- **Admin Panel Issues**: Check browser console, verify Supabase connection
- **Widget Issues**: Check network tab for failed API calls
- **AI Response Issues**: Check OpenAI API key and quota
