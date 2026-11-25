const model = process.env.LLM_MODEL || 'openai/gpt-oss-120b';
const baseUrl = (process.env.LLM_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/+$/, '');

export class GroqError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'GroqError';
    this.status = status;
  }
}

export async function groqChat(messages, { json = false, temperature = 0.4 } = {}) {
  if ((process.env.LLM_PROVIDER || 'groq').toLowerCase() !== 'groq') {
    throw new GroqError('LLM_PROVIDER must be set to groq to use this integration.', 503);
  }

  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    throw new GroqError('Groq is not configured. Add LLM_API_KEY to your local .env file.', 503);
  }

  let response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        ...(json ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: AbortSignal.timeout(45000),
    });
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw new GroqError('Groq did not respond in time. Please try again.', 504);
    }
    throw new GroqError('Could not reach Groq. Check the server network and try again.', 502);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new GroqError('Groq rejected the API key. Check your local .env configuration.', 502);
    }
    if (response.status === 404) {
      throw new GroqError(`Groq could not find model "${model}". Check LLM_MODEL in .env.`, 502);
    }
    if (response.status === 429) {
      throw new GroqError('Groq rate limit or quota reached. Please try again later.', 429);
    }
    throw new GroqError(`Groq request failed with status ${response.status}.`, 502);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new GroqError('Groq returned an invalid response.', 502);
  }

  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new GroqError('Groq returned an empty response. Please try again.', 502);
  }
  return content.trim();
}

export function parseGroqJson(content) {
  try {
    return JSON.parse(content);
  } catch {
    throw new GroqError('Groq returned a response in an unexpected format. Please retry.', 502);
  }
}
