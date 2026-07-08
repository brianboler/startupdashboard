import { describe, it, expect } from 'vitest';
import { parseFormIndex, dailyIndexUrl } from '../src/sources/edgar.js';

const idxSample = `Description:           Daily Index of EDGAR Dissemination Feed by Form Type
Last Data Received:    July 7, 2026

Form Type   Company Name                     CIK         Date Filed  File Name
---------------------------------------------------------------------------------
10-K        BigCo Inc                        0000320193  20260707    edgar/data/320193/0000320193-26-000001.txt
D           Acme Ventures Fund II LP         0001234567  20260707    edgar/data/1234567/0001234567-26-000042.txt
D/A         Beta Robotics Inc                0007654321  20260707    edgar/data/7654321/0007654321-26-000007.txt
S-1         SomeCo                           0001111111  20260707    edgar/data/1111111/0001111111-26-000003.txt
`;

describe('parseFormIndex', () => {
  it('extracts only Form D and D/A filings', () => {
    const filings = parseFormIndex(idxSample);
    expect(filings).toHaveLength(2);
    expect(filings[0]).toEqual({
      formType: 'D',
      company: 'Acme Ventures Fund II LP',
      cik: '0001234567',
      dateFiled: '20260707',
      url: 'https://www.sec.gov/Archives/edgar/data/1234567/0001234567-26-000042.txt',
    });
    expect(filings[1].formType).toBe('D/A');
  });

  it('returns [] for text without D filings', () => {
    expect(parseFormIndex('Form Type Company\n10-K X 1 2 y.txt')).toEqual([]);
  });
});

describe('dailyIndexUrl', () => {
  it('builds the correct quarter path', () => {
    expect(dailyIndexUrl(new Date('2026-07-07T12:00:00Z'))).toBe(
      'https://www.sec.gov/Archives/edgar/daily-index/2026/QTR3/form.20260707.idx'
    );
  });
});
