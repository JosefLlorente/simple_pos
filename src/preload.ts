import { contextBridge, ipcRenderer } from 'electron';
import type {
  CapitalCategory,
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

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, ...args)) as Result<T>;
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

const api = {
  products: {
    list: (query?: { search?: string; category?: string }) =>
      invoke<Product[]>('products:list', query),
    create: (input: ProductInput) => invoke<Product>('products:create', input),
    update: (id: string, input: ProductInput) =>
      invoke<Product>('products:update', id, input),
    remove: (id: string) => invoke<void>('products:remove', id),
  },
  sales: {
    list: (range?: DateRange) => invoke<Sale[]>('sales:list', range),
    get: (id: string) => invoke<Sale>('sales:get', id),
        checkout: (input: {
          items: { productId: string; qty: number }[];
          paymentMethod: PaymentMethod;
          amountPaid: number;
        }) => invoke<Sale>('sales:checkout', input),
    update: (
      password: string,
      id: string,
      input: { paymentMethod: PaymentMethod; items: { id: string; qty: number }[] },
    ) => invoke<Sale>('sales:update', password, id, input),
    void: (password: string, id: string) => invoke<Sale>('sales:void', password, id),
  },
  capital: {
    list: (query?: { category?: string; from?: string; to?: string }) =>
      invoke<import('./core/types.ts').CapitalEntry[]>('capital:list', query),
    create: (input: {
      label: string;
      amount: number;
      category: CapitalCategory;
      date: string;
    }) => invoke<import('./core/types.ts').CapitalEntry>('capital:create', input),
    remove: (id: string) => invoke<void>('capital:remove', id),
    totals: (range?: DateRange) =>
      invoke<{ spent: number; revenue: number; net: number }>('capital:totals', range),
  },
  stats: {
    summary: (range: DateRange) => invoke<StatsSummary>('stats:summary', range),
  },
  settings: {
    get: () => invoke<Settings>('settings:get'),
    set: (patch: Partial<Settings>) => invoke<Settings>('settings:set', patch),
    setPassword: (current: string, next: string) =>
      invoke<void>('settings:setPassword', current, next),
  },
  files: {
    pickImage: () => invoke<string | null>('files:pickImage'),
    pickFolder: () => invoke<string | null>('files:pickFolder'),
    listCsv: () => invoke<CsvFile[]>('files:listCsv'),
    exportProducts: () => invoke<string>('files:exportProducts'),
    exportSales: (range?: DateRange) => invoke<string>('files:exportSales', range),
    exportCapital: (range?: { from?: string; to?: string }) =>
      invoke<string>('files:exportCapital', range),
    importCsv: (name: string) => invoke<ImportResult>('files:importCsv', name),
    deleteCsv: (name: string) => invoke<void>('files:deleteCsv', name),
  },
};

contextBridge.exposeInMainWorld('pos', api);

export type PosApi = typeof api;
