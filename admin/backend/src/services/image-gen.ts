export async function generateImage(resolvedPrompt: string, model: string): Promise<string> {
  const apiKey = process.env['OPENROUTER_API_KEY'];
  if (!apiKey) {
    throw Object.assign(new Error('OpenRouter API key not configured'), { code: 'NO_API_KEY' });
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: resolvedPrompt }],
    }),
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json() as { error?: { message?: string } };
      if (body?.error?.message) detail = body.error.message;
    } catch { /* ignore */ }
    throw new Error(`OpenRouter API error (${response.status}): ${detail}`);
  }

  type ImagePart = { type: string; image_url?: { url: string } };
  type ChatResponse = {
    choices?: Array<{
      message?: {
        content?: string | ImagePart[];
        images?: ImagePart[];
      };
    }>;
  };

  const data = await response.json() as ChatResponse;
  const message = data?.choices?.[0]?.message;

  // Helper: extract base64 from a data URI or fetch from https URL
  async function extractBase64(url: string): Promise<string | null> {
    const match = url.match(/^data:image\/(?:png|jpeg|jpg|gif|webp);base64,([A-Za-z0-9+/=]+)/);
    if (match?.[1]) return match[1];
    if (url.startsWith('https://') || url.startsWith('http://')) {
      const r = await fetch(url);
      if (r.ok) return Buffer.from(await r.arrayBuffer()).toString('base64');
    }
    return null;
  }

  // Case 1: OpenRouter non-standard message.images field
  if (Array.isArray(message?.images)) {
    for (const part of message.images) {
      if (part.image_url?.url) {
        const b64 = await extractBase64(part.image_url.url);
        if (b64) return b64;
      }
    }
  }

  // Case 2: content is an array of content parts
  if (Array.isArray(message?.content)) {
    for (const part of message.content as ImagePart[]) {
      if (part.type === 'image_url' && part.image_url?.url) {
        const b64 = await extractBase64(part.image_url.url);
        if (b64) return b64;
      }
    }
  }

  // Case 3: content is a string containing an embedded data URI
  if (typeof message?.content === 'string') {
    const match = message.content.match(/data:image\/(?:png|jpeg|jpg|gif|webp);base64,([A-Za-z0-9+/=]+)/);
    if (match?.[1]) return match[1];
  }

  throw new Error('OpenRouter returned no image data');
}
