import { describe, expect, it } from 'vitest';

import {
  mapHeaders,
  matchStockRow,
  parseStockSheet,
  toDateString,
  type StockCodeLike,
} from '@/lib/stockImport';

const stockCodes: StockCodeLike[] = [
  { id: '1', stock_code: 'CUM-001', description: 'Cumin Powder', unit_of_measure: 'kg' },
  { id: '2', stock_code: 'PAP-002', description: 'Paprika Powder', unit_of_measure: 'kg' },
  { id: '3', stock_code: 'TAR-003', description: 'Turmeric Powder', unit_of_measure: 'kg' },
];

const header = ['Stock Code', 'Description', 'Quantity', 'UOM', 'Batch', 'Expiry'];

describe('mapHeaders', () => {
  it('maps friendly header spellings to fields', () => {
    const map = mapHeaders(header);
    expect(map[0]).toBe('stock_code');
    expect(map[1]).toBe('description');
    expect(map[2]).toBe('quantity');
  });

  it('ignores case, spaces and underscores', () => {
    expect(mapHeaders(['STOCK_CODE', 'DESCRIPTION', 'QTY'])[0]).toBe('stock_code');
    expect(mapHeaders(['stock code', 'description', 'Qty'])[2]).toBe('quantity');
  });

  it('recognises common alternatives', () => {
    expect(mapHeaders(['Item', 'Weight'])[0]).toBe('description');
    expect(mapHeaders(['Item', 'Weight'])[1]).toBe('quantity');
    expect(mapHeaders(['Supplier Batch No'])[0]).toBe('supplier_batch_number');
    expect(mapHeaders(['Use By'])[0]).toBe('expiry_date');
  });
});

describe('toDateString', () => {
  it('passes through ISO dates', () => {
    expect(toDateString('2026-03-15')).toBe('2026-03-15');
    expect(toDateString('2026/3/5')).toBe('2026-03-05');
  });

  it('reads South African day-first dates', () => {
    expect(toDateString('15/03/2026')).toBe('2026-03-15');
    expect(toDateString('5-3-26')).toBe('2026-03-05');
  });

  it('reads an Excel serial date', () => {
    // 45000 is 2023-03-15 in the spreadsheet epoch.
    expect(toDateString(45000)).toBe('2023-03-15');
  });

  it('returns blank for junk', () => {
    expect(toDateString('')).toBe('');
    expect(toDateString(null)).toBe('');
  });
});

describe('matchStockRow', () => {
  it('matches an exact stock code', () => {
    expect(matchStockRow('CUM-001', '', stockCodes)?.id).toBe('1');
  });

  it('matches a stock code regardless of case or padding', () => {
    expect(matchStockRow('  cum-001 ', '', stockCodes)?.id).toBe('1');
  });

  it('falls back to the description when no code is given', () => {
    expect(matchStockRow('', 'Paprika Powder', stockCodes)?.id).toBe('2');
  });

  it('does NOT guess when the description is ambiguous', () => {
    // Two paprika products exist, so "Paprika" alone must not silently pick one.
    const withFlakes = [
      ...stockCodes,
      { id: '4', stock_code: 'PAP-004', description: 'Paprika Flakes', unit_of_measure: 'kg' },
    ];
    expect(matchStockRow('', 'Paprika', withFlakes)).toBeNull();
  });

  it('accepts a partial description only when it is unambiguous', () => {
    // Only one paprika product exists, so this is safe to import.
    expect(matchStockRow('', 'Paprika', stockCodes)?.id).toBe('2');
  });

  it('refuses a description that matches nothing', () => {
    expect(matchStockRow('', 'Something else entirely', stockCodes)).toBeNull();
    expect(matchStockRow('', '', stockCodes)).toBeNull();
  });
});

describe('parseStockSheet', () => {
  it('reads a well-formed sheet', () => {
    const result = parseStockSheet(
      [
        header,
        ['CUM-001', 'Cumin Powder', '25', 'kg', 'B-9', '15/03/2026'],
        ['PAP-002', 'Paprika Powder', '10', 'kg', 'B-9', '01/12/2027'],
      ],
      stockCodes,
    );

    expect(result.headerRow).toBe(1);
    expect(result.lines).toHaveLength(2);
    expect(result.unmatched).toHaveLength(0);
    expect(result.lines[0]).toMatchObject({
      stock_code: 'CUM-001',
      quantity_received: '25',
      supplier_batch_number: 'B-9',
      expiry_date: '2026-03-15',
    });
  });

  it('finds the header below a title row', () => {
    const result = parseStockSheet(
      [
        ['Delivery 1234 - Maharaja Spices'],
        [],
        header,
        ['CUM-001', 'Cumin Powder', '5', 'kg', '', ''],
      ],
      stockCodes,
    );

    expect(result.headerRow).toBe(3);
    expect(result.lines).toHaveLength(1);
  });

  it('flags an unknown product instead of guessing', () => {
    const result = parseStockSheet(
      [header, ['ZZZ-999', 'Mystery Spice', '5', 'kg', '', '']],
      stockCodes,
    );

    expect(result.lines).toHaveLength(0);
    expect(result.unmatched).toHaveLength(1);
    expect(result.unmatched[0].reason).toBe('unknown-product');
  });

  it('flags a missing or non-positive quantity', () => {
    const result = parseStockSheet(
      [
        header,
        ['CUM-001', 'Cumin Powder', '', 'kg', '', ''],
        ['PAP-002', 'Paprika Powder', '0', 'kg', '', ''],
        ['TAR-003', 'Turmeric Powder', 'abc', 'kg', '', ''],
      ],
      stockCodes,
    );

    expect(result.lines).toHaveLength(0);
    expect(result.unmatched.map((u) => u.reason)).toEqual([
      'no-quantity',
      'bad-quantity',
      'no-quantity',
    ]);
  });

  it('sums repeated rows for the same product, batch and dates', () => {
    const result = parseStockSheet(
      [
        header,
        ['CUM-001', 'Cumin Powder', '10', 'kg', 'B-9', '15/03/2026'],
        ['CUM-001', 'Cumin Powder', '5', 'kg', 'B-9', '15/03/2026'],
      ],
      stockCodes,
    );

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].quantity_received).toBe('15');
  });

  it('keeps rows apart when the batch differs', () => {
    const result = parseStockSheet(
      [
        header,
        ['CUM-001', 'Cumin Powder', '10', 'kg', 'B-9', '15/03/2026'],
        ['CUM-001', 'Cumin Powder', '5', 'kg', 'B-10', '15/03/2026'],
      ],
      stockCodes,
    );

    expect(result.lines).toHaveLength(2);
  });

  it('skips blank rows', () => {
    const result = parseStockSheet(
      [header, ['CUM-001', 'Cumin Powder', '5', 'kg', '', ''], [], ['', '', '', '', '', '']],
      stockCodes,
    );
    expect(result.lines).toHaveLength(1);
  });

  it('reports no header when the sheet has no recognisable columns', () => {
    const result = parseStockSheet([['a', 'b'], ['c', 'd']], stockCodes);
    expect(result.headerRow).toBe(-1);
    expect(result.lines).toHaveLength(0);
  });

  it('leaves the lot blank so the Receiving Log generates one', () => {
    const result = parseStockSheet(
      [['Stock Code', 'Description', 'Quantity'], ['CUM-001', 'Cumin Powder', '5']],
      stockCodes,
    );
    expect(result.lines[0].supplier_batch_number).toBe('');
  });
});

