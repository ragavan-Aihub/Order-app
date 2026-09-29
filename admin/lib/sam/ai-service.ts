import { fallbackParse } from '@/lib/sam/fallback-parser';
import type { CatalogProduct, ParsedIntent } from '@/lib/sam/types';

export interface LLMProvider {
  parse(transcript: string, catalogNames: string[]): Promise<ParsedIntent>;
}

export class LocalLLMProvider implements LLMProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
  ) {}

  async parse(transcript: string, catalogNames: string[]): Promise<ParsedIntent> {
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
          messages: [
            {
              role: 'system',
              content: `You extract grocery order intent for Farm2Flavours. Tamil, English, and Tanglish.
Return JSON only: {"intent":"ADD_ITEMS|REMOVE_ITEM|CHANGE_QUANTITY|CLEAR_DRAFT|CONFIRM|CANCEL|PRODUCT_INFORMATION|INGREDIENTS|ORDER_STATUS|GENERAL_HELP|UNKNOWN","items":[{"product_name":"string","quantity":number}]}
Use only these product names when possible: ${catalogNames.join('; ')}.
Never include prices, product ids, or totals. Quantity defaults to 1.`,
            },
            { role: 'user', content: transcript },
          ],
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error('ollama failed');
      }
      const body = (await response.json()) as { message?: { content?: string } };
      const parsed = JSON.parse(body.message?.content ?? '{}') as ParsedIntent;
      if (!parsed?.intent) {
        throw new Error('bad json');
      }
      return {
        intent: parsed.intent,
        items: Array.isArray(parsed.items) ? parsed.items : [],
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

export class AIService {
  constructor(private readonly provider: LLMProvider | null) {}

  async parse(transcript: string, catalog: CatalogProduct[]): Promise<ParsedIntent> {
    const names = catalog.map((p) => p.name);
    if (this.provider) {
      try {
        return await this.provider.parse(transcript, names);
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
