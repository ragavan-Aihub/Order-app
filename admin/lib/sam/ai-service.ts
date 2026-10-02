import { fallbackParse } from '@/lib/sam/fallback-parser';
import { buildCorrectionPrompt, buildIntentSystemPrompt } from '@/lib/sam/intent-prompt';
import { normalizeParsedIntent, stripJsonFences } from '@/lib/sam/normalize-intent';
import type { CatalogProduct, ParsedIntent, PromptContext } from '@/lib/sam/types';

export interface LLMProvider {
  parse(ctx: PromptContext): Promise<ParsedIntent>;
}

function hasIntentField(raw: unknown) {
  return Boolean(raw && typeof raw === 'object' && 'intent' in (raw as object));
}

export class LocalLLMProvider implements LLMProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
  ) {}

  private async chat(messages: { role: string; content: string }[]) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(new URL('/api/chat', this.baseUrl).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          stream: false,
          format: 'json',
          messages,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error('ollama failed');
      }
      const body = (await response.json()) as { message?: { content?: string } };
      return JSON.parse(stripJsonFences(body.message?.content ?? '{}')) as unknown;
    } finally {
      clearTimeout(timer);
    }
  }

  async parse(ctx: PromptContext): Promise<ParsedIntent> {
    const system = buildIntentSystemPrompt(ctx);
    const user = ctx.transcript;
    let raw = await this.chat([
      { role: 'system', content: system },
      { role: 'user', content: user },
    ]);
    if (!hasIntentField(raw)) {
      raw = await this.chat([
        { role: 'system', content: system },
        { role: 'user', content: user },
        { role: 'assistant', content: '{}' },
        { role: 'user', content: buildCorrectionPrompt() },
      ]);
    }
    if (!hasIntentField(raw)) {
      throw new Error('bad json');
    }
    const normalized = normalizeParsedIntent(raw);
    if (!normalized.intent) {
      throw new Error('bad json');
    }
    return normalized;
  }
}

export class AIService {
  constructor(private readonly provider: LLMProvider | null) {}

  async parse(transcript: string, catalog: CatalogProduct[], ctx: PromptContext): Promise<ParsedIntent> {
    if (this.provider) {
      try {
        return await this.provider.parse({ ...ctx, catalogNames: catalog.map((p) => p.name) });
      } catch {
        // Fall through to deterministic parser.
      }
    }
    return fallbackParse(transcript);
  }
}

export function createAIService() {
  const url = process.env.OLLAMA_URL?.trim();
  const model = process.env.OLLAMA_MODEL?.trim() || 'llama3.2';
  const provider = url ? new LocalLLMProvider(url.replace(/\/$/, ''), model) : null;
  return new AIService(provider);
}
