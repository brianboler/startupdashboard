import { fetchText } from '../lib/http.js';

export function dailyIndexUrl(date) {
  const y = date.getUTCFullYear();
  const q = Math.floor(date.getUTCMonth() / 3) + 1;
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, '');
  return `https://www.sec.gov/Archives/edgar/daily-index/${y}/QTR${q}/form.${ymd}.idx`;
}

export function parseFormIndex(idxText) {
  const filings = [];
  for (const line of idxText.split('\n')) {
    // Columns are separated by runs of 2+ spaces; company names may contain single spaces.
    const cols = line.trim().split(/\s{2,}/);
    if (cols.length < 5) continue;
    const [formType, company, cik, dateFiled, fileName] = cols;
    if (formType !== 'D' && formType !== 'D/A') continue;
    filings.push({
      formType,
      company,
      cik,
      dateFiled,
      url: `https://www.sec.gov/Archives/${fileName}`,
    });
  }
  return filings;
}

export async function fetchRecentFormD() {
  for (let back = 0; back <= 4; back++) {
    const date = new Date(Date.now() - back * 24 * 3600 * 1000);
    try {
      const text = await fetchText(dailyIndexUrl(date), {}, { retries: 1 });
      const filings = parseFormIndex(text);
      if (filings.length > 0) return filings;
    } catch {
      // Index not published yet (or weekend/holiday) — walk back a day.
    }
  }
  console.warn('edgar: no daily index with Form D filings found in last 5 days');
  return [];
}
