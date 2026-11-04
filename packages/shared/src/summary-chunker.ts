/**
 * Utility for intelligent text chunking for long-form email summaries.
 */

export function chunkTextForSummary(text: string, maxChunkChars = 2000): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const clean = text.trim();
  if (clean.length <= maxChunkChars) {
    return [clean];
  }

  const chunks: string[] = [];
  // Split on paragraph boundaries first
  const paragraphs = clean.split(/\n\s*\n/);
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChunkChars) {
      // Paragraph itself is larger than maxChunkChars, split on sentences
      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }

      const sentences = paragraph.split(/(?<=[.?!])\s+/);
      let sentenceChunk = '';

      for (const sentence of sentences) {
        if ((sentenceChunk + ' ' + sentence).length <= maxChunkChars) {
          sentenceChunk = sentenceChunk ? `${sentenceChunk} ${sentence}` : sentence;
        } else {
          if (sentenceChunk) chunks.push(sentenceChunk.trim());
          sentenceChunk = sentence;
        }
      }

      if (sentenceChunk) {
        chunks.push(sentenceChunk.trim());
      }
    } else {
      if ((currentChunk + '\n\n' + paragraph).length <= maxChunkChars) {
        currentChunk = currentChunk ? `${currentChunk}\n\n${paragraph}` : paragraph;
      } else {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = paragraph;
      }
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}
