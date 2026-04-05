import { z } from 'zod';
import type { LlmOptions } from './llm';
import { structuredCompletion } from './llm';

const summaryResultSchema = z.object({
  summary: z.string(),
  topics: z.array(z.string()),
  regions: z.array(z.string()),
});

export type ArticleSummaryInput = {
  title: string;
  sourceName: string;
  bodyText?: string;
  rawSummary?: string;
  topics?: string[];
  regions?: string[];
};

export type ArticleSummaryResult = z.infer<typeof summaryResultSchema>;

const SYSTEM_PROMPT = `You are an editorial assistant for a personal news briefing service.
Your job is to write concise, informative summaries of news articles suitable for reading aloud on a BBC-style news podcast.

Rules:
- Write exactly 2-3 sentences
- Focus on: what happened, who is involved, why it matters
- Use active voice, present tense where natural
- Never include HTML, URLs, navigation text, ads, or markdown
- Never start with the article title or "This article..."
- Write as if explaining to an intelligent listener who hasn't seen the headline
- Preserve factual accuracy — do not invent details not in the source material`;

export async function summarizeArticle(
  input: ArticleSummaryInput,
  options: LlmOptions = {},
): Promise<ArticleSummaryResult> {
  const bodyContent = input.bodyText?.slice(0, 8000)?.trim() ?? '';

  if (!bodyContent) {
    return {
      summary: input.rawSummary ?? input.title,
      topics: input.topics ?? [],
      regions: input.regions ?? [],
    };
  }

  const { object } = await structuredCompletion({
    ...options,
    system: SYSTEM_PROMPT,
    prompt: `Article title: ${input.title}
Source: ${input.sourceName}
Existing topics: ${(input.topics ?? []).join(', ') || 'none'}
Existing regions: ${(input.regions ?? []).join(', ') || 'none'}

Article body:
${bodyContent}

Write a 2-3 sentence editorial summary. Also return the most relevant topics and regions as arrays.`,
    schema: summaryResultSchema,
  });

  return object;
}

export async function summarizeArticleBatch(
  articles: ArticleSummaryInput[],
  options: LlmOptions = {},
): Promise<ArticleSummaryResult[]> {
  const results = await Promise.allSettled(
    articles.map((article) => summarizeArticle(article, options)),
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') return result.value;

    console.error(
      `Summary failed for "${articles[index].title}":`,
      result.reason,
    );

    return {
      summary: articles[index].rawSummary ?? articles[index].title,
      topics: articles[index].topics ?? [],
      regions: articles[index].regions ?? [],
    };
  });
}
