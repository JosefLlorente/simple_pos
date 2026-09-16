import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { csvToObjects, detectCsvType, toCsv } from './core/csv.ts';
import { asCents, changeDue, nextStock, parseMoney } from './core/money.ts';
import { hashPassword, verifyPassword } from './core/password.ts';
import { dayKey, eachDay } from './core/range.ts';
import type {
  CapitalCategory,
  CapitalEntry,
  CsvFile,
  DateRange,
  ImportResult,
  PaymentMethod,
  Product,
  ProductInput,
  Sale,
  Settings,
  StatsSummary,
} from './core/types.ts';
import { CAPITAL_CATEGORIES, DEFAULT_SETTINGS, isPalette, isPaymentMethod } from './core/types.ts';
import {
  csvTypeFromName,
  dbPath,
  defaultCsvDir,
  deleteCsv,
  listCsvFiles,
  readCsv,
  removeImage,
  writeCsv,
} from './files.ts';

let db: DatabaseSync;

type ProductRow = {
  id: string;
  title: string;
  subtitle: string;
  price: number;
  cost: number;
  image: string | null;
  category: string;
  stock: number;
};

type SaleRow = {
  id: string;
  timestamp: string;
  total: number;
  payment_method: string;
  voided: number;
  voided_at: string | null;
  amount_paid: number;
};

const LIVE_SALE = 'COALESCE(voided, 0) = 0';

export function openDb(): void {
  db = new DatabaseSync(dbPath(), { enableForeignKeyConstraints: true });
  db.exec('PRAGMA journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL DEFAULT '',
      price INTEGER NOT NULL,
      cost INTEGER NOT NULL DEFAULT 0,
      image TEXT,
      category TEXT NOT NULL DEFAULT '',
      stock INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      total INTEGER NOT NULL,
      payment_method TEXT NOT NULL,
      voided INTEGER NOT NULL DEFAULT 0,
      voided_at TEXT,
      amount_paid INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS sale_items (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL,
      qty INTEGER NOT NULL,
      price_at_sale INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS capital_entries (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      amount INTEGER NOT NULL,
      category TEXT NOT NULL,
      date TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sales_timestamp ON sales(timestamp);
    CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
    CREATE INDEX IF NOT EXISTS idx_capital_date ON capital_entries(date);
  `);
  ensureColumn('sales', 'voided', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('sales', 'voided_at', 'TEXT');
  if (ensureColumn('sales', 'amount_paid', 'INTEGER NOT NULL DEFAULT 0')) {
    db.exec('UPDATE sales SET amount_paid = total');
  }
  // ponytail: DEFAULT 0 on ALTER left older rows looking unpaid. Upgrade: drop after one release.
  db.exec('UPDATE sales SET amount_paid = total WHERE amount_paid = 0 AND total > 0');
}

function ensureColumn(table: string, column: string, ddl: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (rows.some((row) => row.name === column)) return false;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  return true;
}

export function closeDb(): void {
  db?.close();
}

function text(value: unknown, name: string, optional = false): string {
  if (typeof value !== 'string') throw new Error(`${name} is required`);
  const trimmed = value.trim();
  if (!trimmed && !optional) throw new Error(`${name} is required`);
  return trimmed;
}

function cents(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative amount`);
  }
  return value;
}

function qty(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return value;
}

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    price: row.price,
    cost: row.cost,
    image: row.image,
    category: row.category,
    stock: row.stock,
  };
}

export function listProducts(query?: {
  search?: string;
  category?: string;
}): Product[] {
  const search = query?.search?.trim() ?? '';
  const category = query?.category?.trim() ?? '';
  const rows = db
    .prepare(
      `SELECT * FROM products
       WHERE (? = '' OR title LIKE ? OR subtitle LIKE ? OR category LIKE ?)
         AND (? = '' OR category = ?)
       ORDER BY title COLLATE NOCASE`,
    )
    .all(
      search,
      `%${search}%`,
      `%${search}%`,
      `%${search}%`,
      category,
      category,
    ) as ProductRow[];
  return rows.map(mapProduct);
}

export function getProduct(id: string): Product | null {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as
    | ProductRow
    | undefined;
  return row ? mapProduct(row) : null;
}

export function createProduct(input: ProductInput): Product {
  const product: Product = {
    id: randomUUID(),
    title: text(input.title, 'Title'),
    subtitle: text(input.subtitle ?? '', 'Subtitle', true),
    price: cents(input.price, 'Price'),
    cost: cents(input.cost, 'Cost'),
    image: input.image,
    category: text(input.category ?? '', 'Category', true),
    stock: qty(input.stock, 'Stock'),
  };
  db.prepare(
    `INSERT INTO products (id, title, subtitle, price, cost, image, category, stock)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    product.id,
    product.title,
    product.subtitle,
    product.price,
    product.cost,
    product.image,
    product.category,
    product.stock,
  );
  return product;
}

export function updateProduct(id: string, input: ProductInput): Product {
  const existing = getProduct(id);
  if (!existing) throw new Error('Product not found');
  const product: Product = {
    id,
    title: text(input.title, 'Title'),
    subtitle: text(input.subtitle ?? '', 'Subtitle', true),
    price: cents(input.price, 'Price'),
    cost: cents(input.cost, 'Cost'),
    image: input.image,
    category: text(input.category ?? '', 'Category', true),
    stock: qty(input.stock, 'Stock'),
  };
  db.prepare(
    `UPDATE products SET title = ?, subtitle = ?, price = ?, cost = ?, image = ?, category = ?, stock = ?
     WHERE id = ?`,
  ).run(
    product.title,
    product.subtitle,
    product.price,
    product.cost,
    product.image,
    product.category,
    product.stock,
    id,
  );
  return product;
}

export function deleteProduct(id: string): void {
  const result = db.prepare('DELETE FROM products WHERE id = ?').run(id);
  if (result.changes !== 1) throw new Error('Product not found');
}

function saleItems(saleId: string): Sale['items'] {
  return (
    db.prepare(
      `SELECT si.id, si.sale_id, si.product_id, si.qty, si.price_at_sale, p.title
       FROM sale_items si
       LEFT JOIN products p ON p.id = si.product_id
       WHERE si.sale_id = ?`,
    ).all(saleId) as {
      id: string;
      sale_id: string;
      product_id: string;
      qty: number;
      price_at_sale: number;
      title: string | null;
    }[]
  ).map((row) => ({
    id: row.id,
    saleId: row.sale_id,
    productId: row.product_id,
    title: row.title ?? 'Deleted product',
    qty: row.qty,
    priceAtSale: row.price_at_sale,
  }));
}

function mapSale(row: SaleRow): Sale {
  const total = asCents(row.total);
  const amountPaid = asCents(row.amount_paid, total);
  return {
    id: row.id,
    timestamp: row.timestamp,
    total,
    paymentMethod: row.payment_method as PaymentMethod,
    voided: Boolean(row.voided),
    voidedAt: row.voided_at ?? null,
    amountPaid,
    change: amountPaid - total,
    items: saleItems(row.id),
  };
}

export function getSale(id: string): Sale {
  const row = db.prepare('SELECT * FROM sales WHERE id = ?').get(id) as
    | SaleRow
    | undefined;
  if (!row) throw new Error('Sale not found');
  return mapSale(row);
}

export function listSales(range?: DateRange): Sale[] {
  const rows = (
    range
      ? db
          .prepare(
            'SELECT * FROM sales WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp DESC',
          )
          .all(range.from, range.to)
      : db.prepare('SELECT * FROM sales ORDER BY timestamp DESC').all()
  ) as SaleRow[];
  return rows.map(mapSale);
}

export function checkout(input: {
  items: { productId: string; qty: number }[];
  paymentMethod: PaymentMethod;
  amountPaid: number;
}): Sale {
  if (!input.items.length) throw new Error('Cart is empty');
  if (!isPaymentMethod(input.paymentMethod)) {
    throw new Error('Invalid payment method');
  }
  const merged = new Map<string, number>();
  for (const item of input.items) {
    if (!Number.isInteger(item.qty) || item.qty <= 0) {
      throw new Error('Invalid quantity');
    }
    merged.set(item.productId, (merged.get(item.productId) ?? 0) + item.qty);
  }
  db.exec('BEGIN IMMEDIATE');
  try {
    const lines: { product: Product; qty: number }[] = [];
    let total = 0;
    for (const [productId, amount] of merged) {
      const product = getProduct(productId);
      if (!product) throw new Error('Product not found');
      nextStock(product.stock, amount);
      lines.push({ product, qty: amount });
      total += product.price * amount;
    }
    const saleId = randomUUID();
    const timestamp = new Date().toISOString();
    const amountPaid = cents(input.amountPaid, 'Amount paid');
    changeDue(total, amountPaid);
    db.prepare(
      'INSERT INTO sales (id, timestamp, total, payment_method, voided, amount_paid) VALUES (?, ?, ?, ?, 0, ?)',
    ).run(saleId, timestamp, total, input.paymentMethod, amountPaid);
    const insertItem = db.prepare(
      'INSERT INTO sale_items (id, sale_id, product_id, qty, price_at_sale) VALUES (?, ?, ?, ?, ?)',
    );
    const decrement = db.prepare(
      'UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?',
    );
    for (const line of lines) {
      insertItem.run(
        randomUUID(),
        saleId,
        line.product.id,
        line.qty,
        line.product.price,
      );
      const result = decrement.run(line.qty, line.product.id, line.qty);
      if (result.changes !== 1) {
        throw new Error(`Not enough stock for ${line.product.title}`);
      }
    }
    db.exec('COMMIT');
    return getSale(saleId);
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function ownerPasswordHash(): string {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('ownerPasswordHash') as
    | { value: string }
    | undefined;
  return row?.value ?? '';
}

function requireOwnerPassword(password: string): void {
  const stored = ownerPasswordHash();
  if (!stored) throw new Error('Set an owner password in Settings first');
  if (typeof password !== 'string' || !verifyPassword(password, stored)) {
    throw new Error('Wrong password');
  }
}

export function setOwnerPassword(current: string, next: string): void {
  const stored = ownerPasswordHash();
  if (stored) {
    if (!verifyPassword(current, stored)) throw new Error('Wrong password');
  }
  const hash = hashPassword(next);
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).run('ownerPasswordHash', hash);
}

function applyStockDelta(productId: string, delta: number, title: string): void {
  if (delta === 0) return;
  if (delta < 0) {
    db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(-delta, productId);
    return;
  }
  const product = getProduct(productId);
  if (!product) throw new Error('Product not found');
  nextStock(product.stock, delta);
  const result = db
    .prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?')
    .run(delta, productId, delta);
  if (result.changes !== 1) {
    throw new Error(`Not enough stock for ${title}`);
  }
}

export function voidSale(password: string, id: string): Sale {
  requireOwnerPassword(password);
  db.exec('BEGIN IMMEDIATE');
  try {
    const sale = getSale(id);
    if (sale.voided) throw new Error('Sale is already voided');
    for (const item of sale.items) {
      applyStockDelta(item.productId, -item.qty, item.title);
    }
    db.prepare('UPDATE sales SET voided = 1, voided_at = ? WHERE id = ?').run(
      new Date().toISOString(),
      id,
    );
    db.exec('COMMIT');
    return getSale(id);
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function updateSale(
  password: string,
  id: string,
  input: {
    paymentMethod: PaymentMethod;
    items: { id: string; qty: number }[];
  },
): Sale {
  requireOwnerPassword(password);
  if (!isPaymentMethod(input.paymentMethod)) {
    throw new Error('Invalid payment method');
  }
  db.exec('BEGIN IMMEDIATE');
  try {
    const sale = getSale(id);
    if (sale.voided) throw new Error('Sale is voided');
    const qtyById = new Map<string, number>();
    for (const item of input.items) {
      if (!sale.items.some((line) => line.id === item.id)) {
        throw new Error('Unknown sale item');
      }
      if (!Number.isInteger(item.qty) || item.qty < 0) {
        throw new Error('Invalid quantity');
      }
      qtyById.set(item.id, item.qty);
    }
    const nextItems = sale.items
      .map((item) => ({ ...item, qty: qtyById.get(item.id) ?? item.qty }))
      .filter((item) => item.qty > 0);
    if (!nextItems.length) throw new Error('Sale must have at least one item');
    for (const item of sale.items) {
      const nextQty = qtyById.get(item.id) ?? item.qty;
      applyStockDelta(item.productId, nextQty - item.qty, item.title);
      if (nextQty <= 0) {
        db.prepare('DELETE FROM sale_items WHERE id = ?').run(item.id);
      } else if (nextQty !== item.qty) {
        db.prepare('UPDATE sale_items SET qty = ? WHERE id = ?').run(nextQty, item.id);
      }
    }
    const total = nextItems.reduce((sum, item) => sum + item.qty * item.priceAtSale, 0);
    changeDue(total, sale.amountPaid);
    db.prepare('UPDATE sales SET payment_method = ?, total = ? WHERE id = ?').run(
      input.paymentMethod,
      total,
      id,
    );
    db.exec('COMMIT');
    return getSale(id);
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function mapCapital(row: {
  id: string;
  label: string;
  amount: number;
  category: string;
  date: string;
}): CapitalEntry {
  return {
    id: row.id,
    label: row.label,
    amount: row.amount,
    category: row.category as CapitalCategory,
    date: row.date,
  };
}

export function listCapital(query?: {
  category?: string;
  from?: string;
  to?: string;
}): CapitalEntry[] {
  const category = query?.category ?? '';
  const from = query?.from ?? '';
  const to = query?.to ?? '';
  const rows = db
    .prepare(
      `SELECT * FROM capital_entries
       WHERE (? = '' OR category = ?)
         AND (? = '' OR date >= ?)
         AND (? = '' OR date <= ?)
       ORDER BY date DESC, label COLLATE NOCASE`,
    )
    .all(category, category, from, from, to, to) as Parameters<
    typeof mapCapital
  >[0][];
  return rows.map(mapCapital);
}

export function createCapital(input: {
  label: string;
  amount: number;
  category: CapitalCategory;
  date: string;
}): CapitalEntry {
  if (!CAPITAL_CATEGORIES.includes(input.category)) {
    throw new Error('Invalid capital category');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    throw new Error('Date must be YYYY-MM-DD');
  }
  const entry: CapitalEntry = {
    id: randomUUID(),
    label: text(input.label, 'Label'),
    amount: cents(input.amount, 'Amount'),
    category: input.category,
    date: input.date,
  };
  db.prepare(
    'INSERT INTO capital_entries (id, label, amount, category, date) VALUES (?, ?, ?, ?, ?)',
  ).run(entry.id, entry.label, entry.amount, entry.category, entry.date);
  return entry;
}

export function deleteCapital(id: string): void {
  const result = db.prepare('DELETE FROM capital_entries WHERE id = ?').run(id);
  if (result.changes !== 1) throw new Error('Capital entry not found');
}

export function getSettings(): Settings {
  const rows = db.prepare('SELECT key, value FROM settings').all() as {
    key: string;
    value: string;
  }[];
  const raw = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  const csvDir = raw.csvDir || defaultCsvDir();
  return {
    businessName: raw.businessName || DEFAULT_SETTINGS.businessName,
    currencySymbol: raw.currencySymbol || DEFAULT_SETTINGS.currencySymbol,
    lowStockThreshold: Number(raw.lowStockThreshold) || DEFAULT_SETTINGS.lowStockThreshold,
    csvDir,
    palette: isPalette(raw.palette) ? raw.palette : DEFAULT_SETTINGS.palette,
    ownerPasswordSet: Boolean(raw.ownerPasswordHash),
    gcashNumber: raw.gcashNumber || '',
    gcashQr: raw.gcashQr || null,
    bankAccount: raw.bankAccount || '',
    bankQr: raw.bankQr || null,
  };
}

export function setSettings(patch: Partial<Settings>): Settings {
  if (patch.palette !== undefined && !isPalette(patch.palette)) {
    throw new Error('Invalid palette');
  }
  const current = getSettings();
  const next: Settings = {
    businessName:
      patch.businessName !== undefined
        ? text(patch.businessName, 'Business name')
        : current.businessName,
    currencySymbol:
      patch.currencySymbol !== undefined
        ? text(patch.currencySymbol, 'Currency symbol')
        : current.currencySymbol,
    lowStockThreshold:
      patch.lowStockThreshold !== undefined
        ? qty(patch.lowStockThreshold, 'Low-stock threshold')
        : current.lowStockThreshold,
    csvDir:
      patch.csvDir !== undefined
        ? text(patch.csvDir, 'CSV folder')
        : current.csvDir,
    palette: patch.palette ?? current.palette,
    ownerPasswordSet: current.ownerPasswordSet,
    gcashNumber:
      patch.gcashNumber !== undefined
        ? text(patch.gcashNumber, 'GCash number', true)
        : current.gcashNumber,
    gcashQr:
      patch.gcashQr !== undefined
        ? patch.gcashQr
          ? text(patch.gcashQr, 'GCash QR')
          : null
        : current.gcashQr,
    bankAccount:
      patch.bankAccount !== undefined
        ? text(patch.bankAccount, 'Account number', true)
        : current.bankAccount,
    bankQr:
      patch.bankQr !== undefined
        ? patch.bankQr
          ? text(patch.bankQr, 'Bank QR')
          : null
        : current.bankQr,
  };
  if (next.lowStockThreshold < 1) {
    throw new Error('Low-stock threshold must be at least 1');
  }
  const upsert = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  );
  upsert.run('businessName', next.businessName);
  upsert.run('currencySymbol', next.currencySymbol);
  upsert.run('lowStockThreshold', String(next.lowStockThreshold));
  upsert.run('csvDir', next.csvDir);
  upsert.run('palette', next.palette);
  upsert.run('gcashNumber', next.gcashNumber);
  upsert.run('gcashQr', next.gcashQr ?? '');
  upsert.run('bankAccount', next.bankAccount);
  upsert.run('bankQr', next.bankQr ?? '');
  if (next.gcashQr !== current.gcashQr) removeImage(current.gcashQr);
  if (next.bankQr !== current.bankQr) removeImage(current.bankQr);
  return next;
}

export function stats(range: DateRange): StatsSummary {
  const revenueRow = db
    .prepare(
      'SELECT COALESCE(SUM(total), 0) AS total FROM sales WHERE timestamp >= ? AND timestamp <= ? AND ' +
        LIVE_SALE,
    )
    .get(range.from, range.to) as { total: number };
  const fromDay = dayKey(range.from);
  const toDay = dayKey(range.to);
  const capitalRow = db
    .prepare(
      'SELECT COALESCE(SUM(amount), 0) AS total FROM capital_entries WHERE date >= ? AND date <= ?',
    )
    .get(fromDay, toDay) as { total: number };
  const revenueDays = db
    .prepare(
      `SELECT date(timestamp, 'localtime') AS day, SUM(total) AS total
       FROM sales WHERE timestamp >= ? AND timestamp <= ? AND ${LIVE_SALE}
       GROUP BY day`,
    )
    .all(range.from, range.to) as { day: string; total: number }[];
  const capitalDays = db
    .prepare(
      `SELECT date AS day, SUM(amount) AS total
       FROM capital_entries WHERE date >= ? AND date <= ?
       GROUP BY date`,
    )
    .all(fromDay, toDay) as { day: string; total: number }[];
  const revenueMap = new Map(revenueDays.map((row) => [row.day, row.total]));
  const capitalMap = new Map(capitalDays.map((row) => [row.day, row.total]));
  const best = db
    .prepare(
      `SELECT si.product_id AS productId, COALESCE(p.title, 'Deleted product') AS title,
              SUM(si.qty) AS qty, SUM(si.qty * si.price_at_sale) AS revenue
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       LEFT JOIN products p ON p.id = si.product_id
       WHERE s.timestamp >= ? AND s.timestamp <= ? AND COALESCE(s.voided, 0) = 0
       GROUP BY si.product_id
       ORDER BY qty DESC, revenue DESC
       LIMIT 5`,
    )
    .all(range.from, range.to) as StatsSummary['best'];
  const worst = db
    .prepare(
      `SELECT p.id AS productId, p.title AS title, COALESCE(sold.qty, 0) AS qty
       FROM products p
       LEFT JOIN (
         SELECT si.product_id, SUM(si.qty) AS qty
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         WHERE s.timestamp >= ? AND s.timestamp <= ? AND COALESCE(s.voided, 0) = 0
         GROUP BY si.product_id
       ) sold ON sold.product_id = p.id
       ORDER BY qty ASC, p.title COLLATE NOCASE
       LIMIT 5`,
    )
    .all(range.from, range.to) as StatsSummary['worst'];
  return {
    revenue: revenueRow.total,
    capital: capitalRow.total,
    net: revenueRow.total - capitalRow.total,
    byDay: eachDay(range.from, range.to).map((day) => ({
      day,
      revenue: revenueMap.get(day) ?? 0,
      capital: capitalMap.get(day) ?? 0,
    })),
    best,
    worst,
  };
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function dollars(centsValue: number): string {
  return (centsValue / 100).toFixed(2);
}

export function exportProducts(): string {
  const csv = toCsv(
    listProducts().map((product) => ({
      id: product.id,
      title: product.title,
      subtitle: product.subtitle,
      price: dollars(product.price),
      cost: dollars(product.cost),
      category: product.category,
      stock: product.stock,
      image: product.image ?? '',
    })),
  );
  return writeCsv(getSettings().csvDir, `products-${stamp()}.csv`, csv);
}

export function exportSales(range?: DateRange): string {
  const csv = toCsv(
    listSales(range).flatMap((sale) =>
      sale.items.map((item) => ({
        sale_id: sale.id,
        timestamp: sale.timestamp,
        payment_method: sale.paymentMethod,
        product_id: item.productId,
        title: item.title,
        qty: item.qty,
        price_at_sale: dollars(item.priceAtSale),
        line_total: dollars(item.qty * item.priceAtSale),
        sale_total: dollars(sale.total),
        amount_paid: dollars(sale.amountPaid),
        change: dollars(sale.change),
        voided: sale.voided ? 1 : 0,
      })),
    ),
  );
  return writeCsv(getSettings().csvDir, `sales-${stamp()}.csv`, csv);
}

export function exportCapital(range?: { from?: string; to?: string }): string {
  const csv = toCsv(
    listCapital(range).map((entry) => ({
      id: entry.id,
      date: entry.date,
      label: entry.label,
      category: entry.category,
      amount: dollars(entry.amount),
    })),
  );
  return writeCsv(getSettings().csvDir, `capital-${stamp()}.csv`, csv);
}

export function listExports(): CsvFile[] {
  return listCsvFiles(getSettings().csvDir).map((file) => ({
    ...file,
    type: csvTypeFromName(file.name),
  }));
}

export function removeExport(name: string): void {
  deleteCsv(getSettings().csvDir, name);
}

function moneyField(value: string, name: string): number {
  return parseMoney(value.replace(/^[^0-9]*/, ''));
}

export function importCsv(name: string): ImportResult {
  const contents = readCsv(getSettings().csvDir, name);
  const rows = csvToObjects(contents);
  if (!rows.length) throw new Error('CSV has no data rows');
  const type = detectCsvType(Object.keys(rows[0]));
  if (type === 'unknown') throw new Error('Unrecognized CSV headers');
  db.exec('BEGIN IMMEDIATE');
  try {
    if (type === 'products') {
      const upsert = db.prepare(
        `INSERT INTO products (id, title, subtitle, price, cost, image, category, stock)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title,
           subtitle = excluded.subtitle,
           price = excluded.price,
           cost = excluded.cost,
           category = excluded.category,
           stock = excluded.stock`,
      );
      for (const row of rows) {
        upsert.run(
          row.id || randomUUID(),
          text(row.title, 'Title'),
          text(row.subtitle ?? '', 'Subtitle', true),
          moneyField(row.price, 'Price'),
          moneyField(row.cost || '0', 'Cost'),
          row.image || null,
          text(row.category ?? '', 'Category', true),
          qty(Number(row.stock), 'Stock'),
        );
      }
    } else if (type === 'capital') {
      const insert = db.prepare(
        `INSERT OR REPLACE INTO capital_entries (id, label, amount, category, date)
         VALUES (?, ?, ?, ?, ?)`,
      );
      for (const row of rows) {
        const category = row.category as CapitalCategory;
        if (!CAPITAL_CATEGORIES.includes(category)) {
          throw new Error(`Invalid category: ${row.category}`);
        }
        insert.run(
          row.id || randomUUID(),
          text(row.label, 'Label'),
          moneyField(row.amount, 'Amount'),
          category,
          text(row.date, 'Date'),
        );
      }
    } else {
      // ponytail: sales CSV restores history only; stock is not replayed. Upgrade: inventory ledger.
      const groups = new Map<string, Record<string, string>[]>();
      for (const row of rows) {
        const saleId = row.sale_id || randomUUID();
        const group = groups.get(saleId) ?? [];
        group.push({ ...row, sale_id: saleId });
        groups.set(saleId, group);
      }
      const insertSale = db.prepare(
        `INSERT OR REPLACE INTO sales (id, timestamp, total, payment_method, voided, voided_at, amount_paid)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      );
      const clearItems = db.prepare('DELETE FROM sale_items WHERE sale_id = ?');
      const insertItem = db.prepare(
        `INSERT INTO sale_items (id, sale_id, product_id, qty, price_at_sale)
         VALUES (?, ?, ?, ?, ?)`,
      );
      for (const [saleId, items] of groups) {
        const first = items[0];
        const payment = first.payment_method as PaymentMethod;
        if (!isPaymentMethod(payment)) {
          throw new Error(`Invalid payment method: ${first.payment_method}`);
        }
        const total = items.reduce(
          (sum, item) =>
            sum + qty(Number(item.qty), 'qty') * moneyField(item.price_at_sale, 'price'),
          0,
        );
        insertSale.run(
          saleId,
          text(first.timestamp, 'timestamp'),
          total,
          payment,
          first.voided === '1' ? 1 : 0,
          first.voided === '1' ? text(first.voided_at || first.timestamp, 'voided_at', true) || null : null,
          first.amount_paid ? moneyField(first.amount_paid, 'amount_paid') : total,
        );
        clearItems.run(saleId);
        for (const item of items) {
          insertItem.run(
            randomUUID(),
            saleId,
            text(item.product_id, 'product_id'),
            qty(Number(item.qty), 'qty'),
            moneyField(item.price_at_sale, 'price'),
          );
        }
      }
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return { type, count: rows.length };
}

export function capitalTotals(range?: DateRange): {
  spent: number;
  revenue: number;
  net: number;
} {
  const summary = stats(
    range ?? {
      from: '0000-01-01T00:00:00.000Z',
      to: '9999-12-31T23:59:59.999Z',
    },
  );
  return { spent: summary.capital, revenue: summary.revenue, net: summary.net };
}
