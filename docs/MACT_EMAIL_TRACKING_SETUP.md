# MACt Outreach — Email Tracking Setup

## Current Problem
- Open Rate: 0%
- Reply Rate: 0%
- Campaigns are sending but tracking isn't working

## Root Cause
The infrastructure for tracking opens, clicks, and replies needs to be connected:
1. Resend domain needs open/click tracking enabled
2. Resend webhooks need to be configured
3. Inbound email (for replies) needs DNS + webhook setup

---

# PART 1: Open & Click Tracking

## Step 1.1: Enable Tracking in Resend Dashboard

**Manual steps (Drew to do in Resend Dashboard):**

1. Go to https://resend.com/domains
2. Find your domain: `mact.au`
3. Scroll to bottom of domain settings
4. Enable **Open Tracking** ✓
5. Enable **Click Tracking** ✓
6. Save

## Step 1.2: Configure Resend Webhooks

**Manual steps (Drew to do in Resend Dashboard):**

1. Go to https://resend.com/webhooks
2. Click "Add Webhook"
3. Configure:
   - **Endpoint URL:** `https://mact-chatbot.vercel.app/api/outreach/webhooks/resend`
   - **Events to listen for:**
     - ✓ email.sent
     - ✓ email.delivered
     - ✓ email.opened
     - ✓ email.clicked
     - ✓ email.bounced
     - ✓ email.complained
4. Save webhook

## Step 1.3: Verify Webhook Handler Exists

**For Claude Code:**

Check that `/src/app/api/outreach/webhooks/resend/route.ts` exists and handles these events:

```typescript
// Expected structure
export async function POST(req: Request) {
  const body = await req.json();
  const { type, data } = body;
  
  switch (type) {
    case 'email.delivered':
      // Update outreach_emails set delivered_at = now() where resend_email_id = data.email_id
      break;
    case 'email.opened':
      // Update outreach_emails set opened_at = now() where resend_email_id = data.email_id
      // Increment campaign emails_opened counter
      // Create outreach_events record
      break;
    case 'email.clicked':
      // Update outreach_emails set clicked_at = now() where resend_email_id = data.email_id
      // Increment campaign emails_clicked counter
      // Create outreach_events record with clicked URL
      break;
    case 'email.bounced':
      // Update outreach_emails set bounced_at = now(), status = 'bounced'
      // Increment campaign emails_bounced counter
      break;
    case 'email.complained':
      // Mark as spam complaint
      break;
  }
  
  return NextResponse.json({ received: true });
}
```

**Verify the webhook handler:**
1. Matches Resend email by `resend_email_id` (must be stored when sending)
2. Updates the correct timestamp fields
3. Increments campaign counters using RPC functions
4. Creates event records for audit trail

---

# PART 2: Reply Tracking (Inbound Email)

## Architecture

```
Customer replies to email
        ↓
Email goes to: reply@mact.au (hidden Reply-To header)
        ↓
DNS MX record routes to Resend
        ↓
Resend sends webhook to: /api/outreach/webhooks/inbound
        ↓
MACt Chatbot:
  1. Matches reply to original email
  2. Updates replied_at timestamp
  3. Increments emails_replied counter
  4. Forwards copy to Chris at c.born@mact.au
```

## Step 2.1: DNS Configuration

**Manual steps (Drew to do in DNS provider for mact.au):**

Add MX record for the `reply` subdomain:

```
Type:     MX
Host:     reply
Value:    inbound.resend.com
Priority: 10
TTL:      3600
```

This creates `reply@reply.mact.au` — but we can also use just `reply.mact.au` as the domain.

**Alternative:** If you can't do subdomain MX, use Resend's provided inbound domain.

## Step 2.2: Configure Resend Inbound

**Manual steps (Drew to do in Resend Dashboard):**

1. Go to https://resend.com/domains
2. Click "Add Domain" → Choose "Receiving"
3. Add: `reply.mact.au`
4. Add the MX record Resend provides
5. Once verified, go to Webhooks
6. Add inbound webhook:
   - **Endpoint URL:** `https://mact-chatbot.vercel.app/api/outreach/webhooks/inbound`
   - **Event:** Inbound email received

## Step 2.3: Update Email Sending to Use Reply-To

**For Claude Code:**

When sending outreach emails, ensure the Reply-To header is set:

```typescript
// In the email sending function
await resend.emails.send({
  from: 'Chris Born <c.born@mact.au>',
  replyTo: 'reply@reply.mact.au',  // ← ADD THIS
  to: recipient.email,
  subject: personalizedSubject,
  text: personalizedBody,
});
```

Find where emails are sent (likely `/src/app/api/outreach/send/route.ts` or similar) and add the `replyTo` parameter.

## Step 2.4: Verify Inbound Webhook Handler

**For Claude Code:**

Check that `/src/app/api/outreach/webhooks/inbound/route.ts` exists and:

```typescript
export async function POST(req: Request) {
  const body = await req.json();
  
  const {
    from,           // Customer's email
    to,             // reply@reply.mact.au
    subject,
    text,
    html,
    headers,        // Contains In-Reply-To with original message ID
  } = body.data;
  
  // 1. Extract original Resend message ID from In-Reply-To header
  const inReplyTo = headers?.['in-reply-to'] || headers?.['In-Reply-To'];
  const resendId = extractResendId(inReplyTo);
  
  // 2. Find the original outreach email
  const { data: originalEmail } = await supabase
    .from('outreach_emails')
    .select('*')
    .eq('resend_email_id', resendId)
    .single();
  
  if (originalEmail) {
    // 3. Update the email record
    await supabase
      .from('outreach_emails')
      .update({ 
        replied_at: new Date().toISOString(),
        status: 'replied'
      })
      .eq('id', originalEmail.id);
    
    // 4. Increment campaign counter
    await supabase.rpc('increment_campaign_replied', {
      p_campaign_id: originalEmail.campaign_id
    });
    
    // 5. Create event record
    await supabase.from('outreach_events').insert({
      email_id: originalEmail.id,
      campaign_id: originalEmail.campaign_id,
      event_type: 'replied',
      metadata: {
        from,
        subject,
        body_preview: text?.substring(0, 500)
      }
    });
  }
  
  // 6. Forward to Chris (always, even if not matched)
  await resend.emails.send({
    from: 'MACt Outreach <noreply@mact.au>',
    to: 'c.born@mact.au',
    subject: `[Customer Reply] ${subject}`,
    text: `
Reply from: ${from}
${originalEmail ? `Original campaign: ${originalEmail.campaign_id}` : 'Could not match to campaign'}

---

${text || stripHtml(html)}
    `.trim()
  });
  
  return NextResponse.json({ received: true });
}

function extractResendId(inReplyTo: string): string | null {
  if (!inReplyTo) return null;
  // Resend Message-ID format: <uuid@resend.dev>
  const match = inReplyTo.match(/<([a-f0-9-]+)@/);
  return match ? match[1] : null;
}

function stripHtml(html: string): string {
  return html?.replace(/<[^>]*>/g, '') || '';
}
```

---

# PART 3: Verification Checklist

## For Drew (Manual):

- [ ] Resend domain `mact.au` has Open Tracking enabled
- [ ] Resend domain `mact.au` has Click Tracking enabled
- [ ] Resend webhook configured for `email.sent`, `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`
- [ ] DNS MX record added for `reply.mact.au` pointing to Resend
- [ ] Resend inbound domain `reply.mact.au` verified
- [ ] Resend inbound webhook configured

## For Claude Code:

- [ ] `/api/outreach/webhooks/resend` handles all event types
- [ ] `/api/outreach/webhooks/inbound` handles reply emails
- [ ] Email sending includes `replyTo: 'reply@reply.mact.au'`
- [ ] `resend_email_id` is stored when sending emails
- [ ] Campaign counter RPC functions exist (`increment_campaign_opened`, `increment_campaign_clicked`, `increment_campaign_replied`)
- [ ] `outreach_emails` table has columns: `delivered_at`, `opened_at`, `clicked_at`, `replied_at`, `bounced_at`

---

# PART 4: Testing

## Test Open Tracking:

1. Send a test campaign to yourself
2. Open the email
3. Wait 1-2 minutes
4. Check Resend Dashboard → Logs (should show "opened" event)
5. Check MACt Outreach dashboard (Open Rate should update)

## Test Click Tracking:

1. Send a test campaign with a link in the body
2. Click the link in the email
3. Check Resend Dashboard → Logs (should show "clicked" event)
4. Check MACt Outreach dashboard (Click Rate should update)

## Test Reply Tracking:

1. Send a test campaign to yourself
2. Reply to the email
3. Check:
   - Resend Dashboard → Inbound (should show received email)
   - Chris's inbox (should receive forwarded reply)
   - MACt Outreach dashboard (Reply Rate should update)

---

# Summary: What Drew Needs to Do

| Step | Where | Action |
|------|-------|--------|
| 1 | Resend Dashboard | Enable Open Tracking on `mact.au` |
| 2 | Resend Dashboard | Enable Click Tracking on `mact.au` |
| 3 | Resend Dashboard | Add events webhook pointing to `/api/outreach/webhooks/resend` |
| 4 | DNS Provider | Add MX record: `reply.mact.au` → `inbound.resend.com` |
| 5 | Resend Dashboard | Add inbound domain `reply.mact.au` |
| 6 | Resend Dashboard | Add inbound webhook pointing to `/api/outreach/webhooks/inbound` |

# Summary: What Claude Code Needs to Verify/Fix

| Task | File | Check |
|------|------|-------|
| 1 | Email sending function | Add `replyTo: 'reply@reply.mact.au'` |
| 2 | Email sending function | Store `resend_email_id` from response |
| 3 | `/api/outreach/webhooks/resend` | Handles opened, clicked, bounced events |
| 4 | `/api/outreach/webhooks/inbound` | Handles reply emails, forwards to Chris |
| 5 | Database | Counter RPC functions exist |
| 6 | `outreach_emails` table | Has all timestamp columns |
