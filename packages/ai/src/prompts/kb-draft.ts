// SPDX-License-Identifier: AGPL-3.0-only

export interface KbDraftContext {
  /** Article title the author typed (may be blank on a brand-new article). */
  title: string;
  /** Free-text topic/category (e.g. "Hardware", "Access"), or null. */
  category: string | null;
  /** Category group label/key (IT, HR, FAC), or null. */
  categoryGroup: string | null;
  /** Existing article body HTML when improving/expanding, else null for a fresh draft. */
  existingHtml: string | null;
}

/**
 * Prompt for the "Draft with Tess" knowledge-base authoring assist. Tess writes
 * (or revises) a self-serve help article and returns it as a small, fixed subset
 * of HTML the article editor knows how to parse (`<h2>`, `<p>`, `<ol>`, `<ul>`).
 */
export function buildKbDraftPrompt(input: { article: KbDraftContext; botName?: string }): {
  system: string;
  prompt: string;
} {
  const { article } = input;
  const improving = !!article.existingHtml?.trim();
  const system =
    `You are ${input.botName || 'Tess'}, a friendly, professional IT service-desk assistant writing a ` +
    `knowledge-base article for non-technical end users. Write clear, practical, self-serve help: a short ` +
    `overview, concrete numbered steps for the fix, and a closing "still stuck" path to opening a ticket. ` +
    `Be specific but do not invent product names, URLs, ticket numbers, or policies you were not given. ` +
    `Output ONLY the article body as simple HTML using these tags: <h2> for section headings, <p> for ` +
    `paragraphs, <ol><li> for step-by-step instructions, and <ul><li> for unordered lists. Do not include a ` +
    `title or <h1>, links, images, tables, scripts, inline styles, code fences, or any other tags.`;
  const lines = [
    `Title: ${article.title.trim() || '(untitled — infer a helpful topic from the category)'}`,
    `Category group: ${article.categoryGroup || 'IT'}`,
    `Topic: ${article.category || '(general)'}`,
  ];
  if (improving) {
    lines.push(
      '',
      'Improve and expand the existing draft below: keep what is useful, fix and structure it, and fill gaps. Return the full revised article.',
      '',
      'Existing draft:',
      article.existingHtml as string,
    );
  } else {
    lines.push('', 'Write a complete first draft of this article.');
  }
  return { system, prompt: lines.join('\n') };
}
