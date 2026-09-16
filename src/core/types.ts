export const PAYMENT_METHODS = ['cash', 'gcash', 'bank'] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  gcash: 'GCash',
  bank: 'Bank transfer',
};

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === 'string' && (PAYMENT_METHODS as readonly string[]).includes(value);
}

export type CapitalCategory = 'inventory' | 'rent' | 'utilities' | 'misc';

export type Product = {
  id: string;
  title: string;
  subtitle: string;
  price: number;
  cost: number;
  image: string | null;
  category: string;
  stock: number;
};

export type ProductInput = {
  title: string;
  subtitle: string;
  price: number;
  cost: number;
  image: string | null;
  category: string;
  stock: number;
};

export type SaleItem = {
  id: string;
  saleId: string;
  productId: string;
  title: string;
  qty: number;
  priceAtSale: number;
};

export type Sale = {
  id: string;
  timestamp: string;
  total: number;
  amountPaid: number;
  change: number;
  paymentMethod: PaymentMethod;
  voided: boolean;
  voidedAt: string | null;
  items: SaleItem[];
};

export type CapitalEntry = {
  id: string;
  label: string;
  amount: number;
  category: CapitalCategory;
  date: string;
};

export const PALETTES = ['light', 'dark', 'dracula', 'cream', 'slate'] as const;

export type Palette = (typeof PALETTES)[number];

export type Settings = {
  businessName: string;
  currencySymbol: string;
  lowStockThreshold: number;
  csvDir: string;
  palette: Palette;
  ownerPasswordSet: boolean;
  gcashNumber: string;
  gcashQr: string | null;
  bankAccount: string;
  bankQr: string | null;
};

export function isPalette(value: unknown): value is Palette {
  return typeof value === 'string' && (PALETTES as readonly string[]).includes(value);
}

export type CsvFile = {
  name: string;
  type: 'sales' | 'capital' | 'products' | 'unknown';
  createdAt: string;
  size: number;
};

export type DateRange = { from: string; to: string };

export type StatsSummary = {
  revenue: number;
  capital: number;
  net: number;
  byDay: { day: string; revenue: number; capital: number }[];
  best: { productId: string; title: string; qty: number; revenue: number }[];
  worst: { productId: string; title: string; qty: number }[];
};

export type ImportResult = {
  type: 'sales' | 'capital' | 'products';
  count: number;
};

export const CAPITAL_CATEGORIES: CapitalCategory[] = [
  'inventory',
  'rent',
  'utilities',
  'misc',
];

export const DEFAULT_SETTINGS: Settings = {
  businessName: 'Simple POS',
  currencySymbol: '$',
  lowStockThreshold: 5,
  csvDir: '',
  palette: 'light',
  ownerPasswordSet: false,
  gcashNumber: '',
  gcashQr: null,
  bankAccount: '',
  bankQr: null,
};
