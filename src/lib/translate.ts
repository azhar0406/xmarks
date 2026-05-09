// Free, no-API-key translation using Google Translate's public unofficial endpoint.
// Same endpoint used by Lingva and many open-source translation tools.

const ENDPOINT = 'https://translate.googleapis.com/translate_a/single';

export async function translateToEnglish(text: string): Promise<string> {
  const params = new URLSearchParams({
    client: 'gtx',
    sl: 'auto',
    tl: 'en',
    dt: 't',
    q: text,
  });
  const res = await fetch(`${ENDPOINT}?${params.toString()}`);
  if (!res.ok) throw new Error(`Translation failed: HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    throw new Error('Unexpected translation response');
  }
  return data[0].map((seg: any[]) => seg[0]).join('');
}

// Heuristic: does text look like it's not primarily English?
// Strips emojis, URLs, mentions, hashtags, then checks for non-ASCII letters.
export function looksNonEnglish(text: string): boolean {
  const cleaned = text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[@#]\w+/g, '')
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '');
  return /[^\x00-\x7F]/.test(cleaned);
}
