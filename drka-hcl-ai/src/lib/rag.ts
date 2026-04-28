export type KnowledgeDocument = {
  id: string;
  name: string;
  content: string;
  uploadedAt: string;
  chunkCount: number;
};

export type RetrievedChunk = {
  documentId: string;
  documentName: string;
  content: string;
  score: number;
};

const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'has',
  'have',
  'how',
  'if',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'that',
  'the',
  'to',
  'was',
  'what',
  'when',
  'where',
  'which',
  'who',
  'will',
  'with',
]);

function normalizeWhitespace(value: string) {
  return value.replace(/\r/g, '').replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();
}

function chunkText(content: string, maxLength = 600) {
  const blocks = content
    .split(/\n\s*\n/g)
    .map((block) => normalizeWhitespace(block))
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';

  for (const block of blocks) {
    const next = current ? `${current}\n\n${block}` : block;

    if (next.length <= maxLength) {
      current = next;
      continue;
    }

    if (current) {
      chunks.push(current);
    }

    if (block.length <= maxLength) {
      current = block;
      continue;
    }

    for (let index = 0; index < block.length; index += maxLength) {
      chunks.push(block.slice(index, index + maxLength).trim());
    }
    current = '';
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.filter(Boolean);
}

function tokenize(value: string) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((token) => token && !STOPWORDS.has(token));
}

function scoreChunk(queryTokens: string[], chunk: string) {
  const chunkTokens = tokenize(chunk);
  if (!queryTokens.length || !chunkTokens.length) {
    return 0;
  }

  const chunkSet = new Set(chunkTokens);
  let hits = 0;
  for (const token of queryTokens) {
    if (chunkSet.has(token)) {
      hits += 1;
    }
  }

  const density = hits / Math.max(queryTokens.length, 1);
  const lengthPenalty = Math.min(chunk.length / 800, 1);
  return density * 100 - lengthPenalty * 8;
}

export function createKnowledgeDocument(name: string, content: string): KnowledgeDocument {
  const normalized = content.split('\0').join('').trim();
  const chunkCount = chunkText(normalized).length;

  return {
    id: Math.random().toString(36).slice(2, 10),
    name,
    content: normalized,
    uploadedAt: new Date().toISOString(),
    chunkCount,
  };
}

export function retrieveRelevantChunks(
  documents: KnowledgeDocument[],
  query: string,
  maxResults = 4
): RetrievedChunk[] {
  const queryTokens = tokenize(query);

  return documents
    .flatMap((document) =>
      chunkText(document.content).map((content) => ({
        documentId: document.id,
        documentName: document.name,
        content,
        score: scoreChunk(queryTokens, content),
      }))
    )
    .filter((chunk) => chunk.score > 6)
    .sort((left, right) => right.score - left.score)
    .slice(0, maxResults);
}

export function buildRagContext(chunks: RetrievedChunk[]) {
  if (!chunks.length) {
    return '';
  }

  return chunks
    .map(
      (chunk, index) =>
        `Source ${index + 1} - ${chunk.documentName}\n${chunk.content}`
    )
    .join('\n\n');
}
