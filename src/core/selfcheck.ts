import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { csvToObjects, detectCsvType, parseCsv, toCsv } from './csv.ts';
import { asCents, cartTotal, changeDue, formatMoney, nextStock, parseMoney } from './money.ts';
import { eachDay, rangePreset } from './range.ts';
import { hashPassword, verifyPassword } from './password.ts';
import { PALETTES, isPalette, isPaymentMethod, PAYMENT_METHODS } from './types.ts';

describe('money', () => {
  it('parses dollars to integer cents without float drift', () => {
    assert.equal(parseMoney('19.99'), 1999);
    assert.equal(parseMoney('0.10'), 10);
    assert.equal(parseMoney('12'), 1200);
  });

  it('rejects invalid amounts', () => {
    assert.throws(() => parseMoney('12.999'));
    assert.throws(() => parseMoney('-1'));
    assert.throws(() => parseMoney('abc'));
  });

  it('formats cents and totals a cart', () => {
    assert.equal(formatMoney(1999, '₱'), '₱19.99');
    assert.equal(
      cartTotal([
        { price: 1999, qty: 2 },
        { price: 50, qty: 1 },
      ]),
      4048,
    );
  });

  it('decrements stock and refuses oversell', () => {
    assert.equal(nextStock(5, 2), 3);
    assert.throws(() => nextStock(1, 2));
  });

  it('gives change only when the tender covers the total', () => {
    assert.equal(changeDue(1250, 2000), 750);
    assert.equal(changeDue(1250, 1250), 0);
    assert.throws(() => changeDue(1250, 1249));
  });

  it('coerces missing cents to a fallback so history can render old sales', () => {
    assert.equal(asCents(1999), 1999);
    assert.equal(asCents(undefined, 500), 500);
    assert.equal(asCents(10n), 10);
  });
});

describe('csv', () => {
  it('round-trips quoted cells and detects export type', () => {
    const csv = toCsv([
      { title: 'Coffee, hot', subtitle: 'Says "medium"', price: '3.50' },
    ]);
    const rows = parseCsv(csv);
    assert.deepEqual(rows[1], ['Coffee, hot', 'Says "medium"', '3.50']);
    assert.equal(detectCsvType(Object.keys(csvToObjects(csv)[0])), 'unknown');
    assert.equal(detectCsvType(['id', 'label', 'amount', 'category', 'date']), 'capital');
    assert.equal(detectCsvType(['id', 'title', 'price', 'stock']), 'products');
    assert.equal(detectCsvType(['sale_id', 'payment_method', 'qty']), 'sales');
  });
});

describe('range', () => {
  it('starts the week on local Monday and lists days', () => {
    const week = rangePreset('week', new Date('2026-09-15T12:00:00'));
    assert.equal(new Date(week.from).getDay(), 1);
    assert.ok(eachDay(week.from, week.to).includes('2026-09-15'));
  });
});

describe('password', () => {
  it('hashes with scrypt and rejects a wrong guess', () => {
    const stored = hashPassword('owner-secret');
    assert.equal(verifyPassword('owner-secret', stored), true);
    assert.equal(verifyPassword('owner-secreT', stored), false);
    assert.equal(verifyPassword('owner-secret', 'not-a-hash'), false);
    assert.throws(() => hashPassword('abc'));
  });
});

describe('payment method', () => {
  it('accepts cash, GCash, and bank transfer', () => {
    assert.deepEqual([...PAYMENT_METHODS], ['cash', 'gcash', 'bank']);
    for (const id of PAYMENT_METHODS) assert.equal(isPaymentMethod(id), true);
    assert.equal(isPaymentMethod('paypal'), false);
    assert.equal(isPaymentMethod(''), false);
  });
});

describe('palette', () => {
  it('accepts the five ids and rejects anything else', () => {
    assert.deepEqual([...PALETTES], ['light', 'dark', 'dracula', 'cream', 'slate']);
    for (const id of PALETTES) assert.equal(isPalette(id), true);
    assert.equal(isPalette('solarized'), false);
    assert.equal(isPalette(''), false);
    assert.equal(isPalette(null), false);
  });
});
