// ─── Embed snippet generator ──────────────────────────────────────────────────
//
// Returns a self-contained HTML form that POSTs to the Channel Capture ingest
// endpoint. Drop this into any website to start capturing leads into Vytal.

export function generateEmbedSnippet(options: {
  baseUrl: string
  orgId: string
  redirectUrl?: string
  buttonLabel?: string
}): string {
  const { baseUrl, orgId, redirectUrl, buttonLabel = 'Send message' } = options
  const action = `${baseUrl.replace(/\/$/, '')}/api/ingest/web-form?org_id=${orgId}`

  return `<!-- Vytal Channel Capture — https://github.com/hareev/vytal -->
<form
  action="${action}"
  method="POST"
  enctype="application/x-www-form-urlencoded"
  style="display:flex;flex-direction:column;gap:8px;max-width:400px"
  ${redirectUrl ? `onsubmit="this.action+='&_redirect=${encodeURIComponent(redirectUrl)}'"` : ''}
>
  <input name="name"    placeholder="Name"         type="text"  />
  <input name="email"   placeholder="Email"        type="email" />
  <input name="phone"   placeholder="Phone"        type="tel"   />
  <textarea name="message" placeholder="Message" rows="4"></textarea>
  <button type="submit">${buttonLabel}</button>
</form>`
}

// ─── Pre-built default snippet ────────────────────────────────────────────────

export const EMBED_SNIPPET_EXAMPLE = `<!-- Replace YOUR_VYTAL_URL and YOUR_ORG_ID -->
<form
  action="https://YOUR_VYTAL_URL/api/ingest/web-form?org_id=YOUR_ORG_ID"
  method="POST"
  enctype="application/x-www-form-urlencoded"
>
  <input name="name"    placeholder="Name"  />
  <input name="email"   placeholder="Email" type="email" required />
  <input name="phone"   placeholder="Phone" />
  <textarea name="message" placeholder="Message" rows="4"></textarea>
  <button type="submit">Send</button>
</form>`
