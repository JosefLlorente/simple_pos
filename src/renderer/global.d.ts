export {};

declare global {
  interface Window {
    pos: {
      products: {
        list: (query?: { search?: string; category?: string }) => Promise<
          import('../core/types.ts').Product[]
        >;
        create: (
          input: import('../core/types.ts').ProductInput,
        ) => Promise<import('../core/types.ts').Product>;
        update: (
          id: string,
          input: import('../core/types.ts').ProductInput,
        ) => Promise<import('../core/types.ts').Product>;
        remove: (id: string) => Promise<void>;
      };
      sales: {
        list: (
          range?: import('../core/types.ts').DateRange,
        ) => Promise<import('../core/types.ts').Sale[]>;
        get: (id: string) => Promise<import('../core/types.ts').Sale>;
        checkout: (input: {
          items: { productId: string; qty: number }[];
          paymentMethod: import('../core/types.ts').PaymentMethod;
          amountPaid: number;
        }) => Promise<import('../core/types.ts').Sale>;
        update: (
          password: string,
          id: string,
          input: {
            paymentMethod: import('../core/types.ts').PaymentMethod;
            items: { id: string; qty: number }[];
          },
        ) => Promise<import('../core/types.ts').Sale>;
        void: (password: string, id: string) => Promise<import('../core/types.ts').Sale>;
      };
      capital: {
        list: (query?: {
          category?: string;
          from?: string;
          to?: string;
        }) => Promise<import('../core/types.ts').CapitalEntry[]>;
        create: (input: {
          label: string;
          amount: number;
          category: import('../core/types.ts').CapitalCategory;
          date: string;
        }) => Promise<import('../core/types.ts').CapitalEntry>;
        remove: (id: string) => Promise<void>;
        totals: (
          range?: import('../core/types.ts').DateRange,
        ) => Promise<{ spent: number; revenue: number; net: number }>;
      };
      stats: {
        summary: (
          range: import('../core/types.ts').DateRange,
        ) => Promise<import('../core/types.ts').StatsSummary>;
      };
      settings: {
        get: () => Promise<import('../core/types.ts').Settings>;
        set: (
          patch: Partial<import('../core/types.ts').Settings>,
        ) => Promise<import('../core/types.ts').Settings>;
        setPassword: (current: string, next: string) => Promise<void>;
      };
      files: {
        pickImage: () => Promise<string | null>;
        pickFolder: () => Promise<string | null>;
        listCsv: () => Promise<import('../core/types.ts').CsvFile[]>;
        exportProducts: () => Promise<string>;
        exportSales: (
          range?: import('../core/types.ts').DateRange,
        ) => Promise<string>;
        exportCapital: (range?: {
          from?: string;
          to?: string;
        }) => Promise<string>;
        importCsv: (
          name: string,
        ) => Promise<import('../core/types.ts').ImportResult>;
        deleteCsv: (name: string) => Promise<void>;
      };
    };
  }
}
