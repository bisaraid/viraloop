const GROQ_API_BASE = 'https://api.groq.com/openai/v1';

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GroqCompletionParams {
  model: string;
  messages: GroqMessage[];
  max_tokens?: number;
  response_format?: { type: 'json_object' | 'text' };
  temperature?: number;
}

export interface GroqCompletionResult {
  content: string;
  finish_reason: 'stop' | 'length';
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export async function groqCompletion(params: GroqCompletionParams): Promise<GroqCompletionResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY tidak ditemukan di environment variables');
  }

  const response = await fetch(`${GROQ_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
      max_tokens: params.max_tokens ?? 8192,
      response_format: params.response_format ?? { type: 'json_object' },
      temperature: params.temperature ?? 0.7,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Groq API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();

  return {
    content: data.choices[0].message.content,
    finish_reason: data.choices[0].finish_reason,
    usage: {
      prompt_tokens: data.usage.prompt_tokens,
      completion_tokens: data.usage.completion_tokens,
      total_tokens: data.usage.total_tokens,
    },
  };
}