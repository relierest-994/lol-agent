import { HttpClient } from '../http-client';

export interface LlmChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmChatResponse {
  text: string;
  raw: unknown;
}

export class LlmClient {
  constructor(
    private readonly http: HttpClient,
    private readonly model: string,
    private readonly apiKey?: string
  ) {}

  async chat(
    messages: LlmChatMessage[],
    temperature = 0.3,
    extraHeaders?: Record<string, string>
  ): Promise<LlmChatResponse> {
    const payload = {
      model: this.model,
      temperature,
      response_format: { type: 'json_object' },
      messages,
    };

    const response = await this.http.request<{
      choices?: Array<{ message?: { content?: string } }>;
    }>({
      path: '',
      method: 'POST',
      headers: {
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        ...(extraHeaders ?? {}),
      },
      body: payload,
    });

    const text = response.choices?.[0]?.message?.content ?? '{}';
    return { text, raw: response };
  }
}
