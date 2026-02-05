# Google Ads API Authentication

## Prerequisites

1. **Google Cloud Project** with Google Ads API enabled
2. **Google Ads Developer Token** (from API Center in Google Ads)
3. **OAuth 2.0 Client Credentials** (Web application type)

## Setup Steps

### 1. Google Cloud Console

1. Create project at https://console.cloud.google.com
2. Enable "Google Ads API"
3. Configure OAuth consent screen (External, for testing)
4. Create OAuth 2.0 Client ID (Web application)
5. Add authorized redirect URI: `https://your-domain.com/api/integrations/google-ads/callback`

### 2. Google Ads API Center

1. Sign in at https://ads.google.com/aw/apicenter
2. Apply for Developer Token (Basic access for <15,000 operations/day)
3. Note: Test accounts work immediately; production requires approval

### 3. Environment Variables

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_ADS_DEVELOPER_TOKEN=your-developer-token
GOOGLE_REDIRECT_URI=https://your-domain.com/api/integrations/google-ads/callback
```

## OAuth 2.0 Flow

### Step 1: Authorization URL

```javascript
const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID);
authUrl.searchParams.set('redirect_uri', process.env.GOOGLE_REDIRECT_URI);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/adwords');
authUrl.searchParams.set('access_type', 'offline');  // Required for refresh token
authUrl.searchParams.set('prompt', 'consent');       // Force consent to get refresh token
authUrl.searchParams.set('state', generateStateToken()); // CSRF protection
```

### Step 2: Handle Callback

```javascript
// POST to https://oauth2.googleapis.com/token
const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    code: authorizationCode,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    grant_type: 'authorization_code',
  }),
});

const { access_token, refresh_token, expires_in } = await tokenResponse.json();
```

### Step 3: Store Tokens

```javascript
// Encrypt tokens before storing
const encryptedRefreshToken = encrypt(refresh_token, process.env.PPC_TOKEN_ENCRYPTION_KEY);
const tokenExpiresAt = new Date(Date.now() + expires_in * 1000);

await supabase
  .from('ppc_connections')
  .upsert({
    organization_id: orgId,
    customer_id: customerId,
    refresh_token: encryptedRefreshToken,
    access_token: encrypt(access_token, process.env.PPC_TOKEN_ENCRYPTION_KEY),
    token_expires_at: tokenExpiresAt,
  });
```

### Step 4: Refresh Token

```javascript
async function refreshAccessToken(connection) {
  const decryptedRefreshToken = decrypt(
    connection.refresh_token, 
    process.env.PPC_TOKEN_ENCRYPTION_KEY
  );

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: decryptedRefreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const { access_token, expires_in } = await response.json();
  
  // Update stored access token
  await supabase
    .from('ppc_connections')
    .update({
      access_token: encrypt(access_token, process.env.PPC_TOKEN_ENCRYPTION_KEY),
      token_expires_at: new Date(Date.now() + expires_in * 1000),
    })
    .eq('id', connection.id);

  return access_token;
}
```

## Customer ID Discovery

After OAuth, discover accessible accounts:

```javascript
const client = new GoogleAdsApi({
  client_id: process.env.GOOGLE_CLIENT_ID,
  client_secret: process.env.GOOGLE_CLIENT_SECRET,
  developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
});

// List accessible customers
const customers = await client.listAccessibleCustomers(refreshToken);
// Returns array of customer IDs: ['1234567890', '0987654321']

// Get customer details
for (const customerId of customers) {
  const customer = client.Customer({
    customer_id: customerId,
    refresh_token: refreshToken,
  });
  
  const details = await customer.query(`
    SELECT customer.descriptive_name, customer.id
    FROM customer
    LIMIT 1
  `);
}
```

## MCC (Manager Account) Handling

If connecting via an MCC:

```javascript
const customer = client.Customer({
  customer_id: targetAccountId,        // The account to query
  refresh_token: refreshToken,
  login_customer_id: mccAccountId,     // The MCC that has access
});
```

## Token Encryption

Use AES-256-GCM for token encryption:

```javascript
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function encrypt(text, key) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(key, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decrypt(encryptedText, key) {
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(key, 'hex'),
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

## Error Handling

Common errors and solutions:

| Error | Cause | Solution |
|-------|-------|----------|
| `INVALID_GRANT` | Refresh token revoked | Re-authenticate user |
| `DEVELOPER_TOKEN_NOT_APPROVED` | Token pending approval | Use test account or wait |
| `CUSTOMER_NOT_FOUND` | Wrong customer ID | Verify ID format (no dashes) |
| `USER_PERMISSION_DENIED` | No access to account | Check account permissions |

## Security Checklist

- [ ] Store tokens encrypted at rest
- [ ] Use HTTPS for all API calls
- [ ] Implement CSRF protection (state parameter)
- [ ] Validate redirect URI server-side
- [ ] Log access but not token values
- [ ] Implement token rotation on security events
