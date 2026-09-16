import { Minus, Plus, Package, Search, ShoppingCart, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { PaymentMethod, Product, Sale } from '../../core/types.ts';
import { PAYMENT_LABELS } from '../../core/types.ts';
import { cartTotal } from '../../core/money.ts';
import { EmptyState } from '@/components/empty-state';
import { NumericKeypad } from '@/components/numeric-keypad';
import { ProductCard } from '@/components/product-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { imageSrc, money } from '@/lib/format';
import { usePos } from '@/lib/pos-context';

type Line = { product: Product; qty: number };

function CartPanel({
  lines,
  currency,
  onQty,
  onKeypad,
  onRemove,
  onCheckout,
}: {
  lines: Line[];
  currency: string;
  onQty: (id: string, qty: number) => void;
  onKeypad: (id: string) => void;
  onRemove: (id: string) => void;
  onCheckout: () => void;
}) {
  const total = cartTotal(lines.map((line) => ({ price: line.product.price, qty: line.qty })));
  if (!lines.length) {
    return (
      <EmptyState
        icon={ShoppingCart}
        title="Cart is empty"
        body="Tap a product to add it."
      />
    );
  }
  return (
    <div className="grid h-full min-h-0 grid-rows-[1fr_auto]">
      <ScrollArea className="min-h-0">
        <div className="grid gap-2 p-3">
          {lines.map((line) => (
            <div
              key={line.product.id}
              className="grid grid-cols-[1fr_auto] gap-2 rounded-lg border border-border bg-card p-2"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{line.product.title}</p>
                <p className="text-sm tabular-nums text-muted-foreground">
                  {money(line.product.price, currency)} each
                </p>
              </div>
              <div className="grid grid-cols-[auto_auto_auto_auto] items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Decrease quantity"
                  onClick={() => onQty(line.product.id, line.qty - 1)}
                >
                  <Minus className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  className="h-9 min-w-11 tabular-nums"
                  onClick={() => onKeypad(line.product.id)}
                >
                  {line.qty}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Increase quantity"
                  disabled={line.qty >= line.product.stock}
                  onClick={() => onQty(line.product.id, line.qty + 1)}
                >
                  <Plus className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Remove item"
                  onClick={() => onRemove(line.product.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      <div className="grid gap-2 border-t border-border p-3">
        <div className="flex items-center justify-between text-lg font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{money(total, currency)}</span>
        </div>
        <Button className="h-11" onClick={onCheckout}>
          Checkout
        </Button>
      </div>
    </div>
  );
}

function CashlessPay({
  qr,
  label,
  value,
  error,
  onPaid,
}: {
  qr: string | null;
  label: string;
  value: string;
  error: string;
  onPaid: () => void;
}) {
  const src = imageSrc(qr);
  return (
    <div className="grid gap-2">
      {src ? (
        <img
          src={src}
          alt={`${label} QR`}
          className="mx-auto aspect-square w-full max-w-56 rounded-lg border border-border object-contain bg-card"
        />
      ) : (
        <p className="rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground">
          No QR yet. Add one in Settings, or read the {label.toLowerCase()} aloud.
        </p>
      )}
      <div className="rounded-lg border border-border bg-card p-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold tabular-nums">{value || '—'}</p>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button className="h-11" onClick={onPaid}>
        Paid
      </Button>
    </div>
  );
}

export function SaleScreen({ active }: { active: boolean }) {
  const { settings } = usePos();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payMethod, setPayMethod] = useState<PaymentMethod | null>(null);
  const [tender, setTender] = useState('');
  const [receipt, setReceipt] = useState<Sale | null>(null);
  const [keypadId, setKeypadId] = useState<string | null>(null);
  const [keypadValue, setKeypadValue] = useState('');

  async function load() {
    const list = await window.pos.products.list({ search });
    setProducts(list);
  }

  useEffect(() => {
    if (active) load().catch((err) => setError(String(err)));
  }, [active, search]);

  const count = lines.reduce((sum, line) => sum + line.qty, 0);
  const total = cartTotal(
    lines.map((line) => ({ price: line.product.price, qty: line.qty })),
  );
  const paid = Number(tender || '0');

  function add(product: Product) {
    setError('');
    setLines((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      const qty = (existing?.qty ?? 0) + 1;
      if (qty > product.stock) return current;
      if (!existing) return [...current, { product, qty: 1 }];
      return current.map((line) =>
        line.product.id === product.id ? { ...line, qty, product } : line,
      );
    });
  }

  function setQty(id: string, qty: number) {
    setLines((current) =>
      current.flatMap((line) => {
        if (line.product.id !== id) return [line];
        if (qty <= 0) return [];
        return [{ ...line, qty: Math.min(qty, line.product.stock) }];
      }),
    );
  }

  async function pay(method: PaymentMethod, amountPaid: number) {
    setError('');
    try {
      const sale = await window.pos.sales.checkout({
        items: lines.map((line) => ({ productId: line.product.id, qty: line.qty })),
        paymentMethod: method,
        amountPaid,
      });
      setLines([]);
      setPayOpen(false);
      setPayMethod(null);
      setTender('');
      setCartOpen(false);
      setReceipt(sale);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const keypadLine = useMemo(
    () => lines.find((line) => line.product.id === keypadId) ?? null,
    [lines, keypadId],
  );

  const cart = (
    <CartPanel
      lines={lines}
      currency={settings.currencySymbol}
      onQty={setQty}
      onKeypad={(id) => {
        const line = lines.find((item) => item.product.id === id);
        setKeypadId(id);
        setKeypadValue(String(line?.qty ?? 1));
      }}
      onRemove={(id) => setQty(id, 0)}
      onCheckout={() => {
        setError('');
        setPayMethod(null);
        setTender('');
        setPayOpen(true);
      }}
    />
  );

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_1fr] md:grid-cols-[minmax(0,1fr)_22rem] md:grid-rows-[auto_1fr] md:[grid-template-areas:'header_header'_'products_cart']">
      <header className="flex items-center gap-2 border-b border-border bg-card px-4 py-3 md:[grid-area:header]">
        <h1 className="text-lg font-semibold">Sale</h1>
        <div className="relative ml-auto w-full max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search products"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Button
          variant="outline"
          className="h-11 md:hidden"
          onClick={() => setCartOpen(true)}
        >
          <ShoppingCart className="size-4" />
          Cart
          {count ? <Badge>{count}</Badge> : null}
        </Button>
      </header>
      <div
        className={
          products.length === 0
            ? 'h-full min-h-0 overflow-auto p-4 md:[grid-area:products]'
            : 'min-h-0 overflow-auto p-4 md:[grid-area:products]'
        }
      >
        {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
        {products.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No products yet"
            body="Add items in Inventory before starting a sale."
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                currency={settings.currencySymbol}
                lowStockThreshold={settings.lowStockThreshold}
                disabled={product.stock <= 0}
                onSelect={() => add(product)}
              />
            ))}
          </div>
        )}
      </div>
      <aside className="hidden min-h-0 border-l border-border bg-card md:grid md:[grid-area:cart]">
        {cart}
      </aside>
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="bottom" className="h-[80vh] rounded-t-lg p-0">
          <SheetHeader className="border-b border-border p-4">
            <SheetTitle>Cart</SheetTitle>
          </SheetHeader>
          {cart}
        </SheetContent>
      </Sheet>
      <Dialog
        open={payOpen}
        onOpenChange={(open) => {
          setPayOpen(open);
          if (!open) {
            setPayMethod(null);
            setTender('');
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Payment</DialogTitle>
          </DialogHeader>
          <p className="text-center text-3xl font-semibold tabular-nums">
            {money(total, settings.currencySymbol)}
          </p>
          <div className="grid gap-2">
            <Button
              className="h-11"
              variant={payMethod === 'cash' ? 'default' : 'outline'}
              onClick={() => {
                setError('');
                setPayMethod('cash');
              }}
            >
              Cash
            </Button>
            <Button
              className="h-11"
              variant={payMethod === 'gcash' ? 'default' : 'outline'}
              onClick={() => {
                setError('');
                setPayMethod('gcash');
              }}
            >
              GCash
            </Button>
            <Button
              className="h-11"
              variant={payMethod === 'bank' ? 'default' : 'outline'}
              onClick={() => {
                setError('');
                setPayMethod('bank');
              }}
            >
              Bank transfer
            </Button>
          </div>
          {payMethod === 'cash' ? (
            <div className="grid gap-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border bg-card p-2">
                  <p className="text-sm text-muted-foreground">Paid</p>
                  <p className="text-xl font-semibold tabular-nums">
                    {money(paid, settings.currencySymbol)}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-2">
                  <p className="text-sm text-muted-foreground">Change</p>
                  <p className="text-xl font-semibold tabular-nums">
                    {paid >= total
                      ? money(paid - total, settings.currencySymbol)
                      : '—'}
                  </p>
                </div>
              </div>
              {paid < total ? (
                <p className="text-sm text-muted-foreground">
                  Need {money(total - paid, settings.currencySymbol)} more
                </p>
              ) : null}
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <NumericKeypad
                value={tender}
                onChange={setTender}
                onDone={() => {
                  if (paid < total) {
                    setError('Amount paid is less than total');
                    return;
                  }
                  pay('cash', paid);
                }}
              />
              <Button
                variant="outline"
                className="h-11"
                onClick={() => pay('cash', total)}
              >
                Exact
              </Button>
            </div>
          ) : payMethod === 'gcash' || payMethod === 'bank' ? (
            <CashlessPay
              qr={payMethod === 'gcash' ? settings.gcashQr : settings.bankQr}
              label={payMethod === 'gcash' ? 'Mobile number' : 'Account number'}
              value={
                payMethod === 'gcash' ? settings.gcashNumber : settings.bankAccount
              }
              error={error}
              onPaid={() => pay(payMethod, total)}
            />
          ) : error && payOpen ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(receipt)} onOpenChange={() => setReceipt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sale complete</DialogTitle>
          </DialogHeader>
          {receipt ? (
            <div className="grid gap-2 text-sm">
              <p className="text-muted-foreground">
                {new Date(receipt.timestamp).toLocaleString()} ·{' '}
                {PAYMENT_LABELS[receipt.paymentMethod]}
              </p>
              {receipt.items.map((item) => (
                <div key={item.id} className="flex justify-between gap-2">
                  <span>
                    {item.title} × {item.qty}
                  </span>
                  <span className="tabular-nums">
                    {money(item.qty * item.priceAtSale, settings.currencySymbol)}
                  </span>
                </div>
              ))}
              <div className="grid gap-1 border-t border-border pt-2">
                <div className="flex justify-between">
                  <span>Total</span>
                  <span className="tabular-nums">
                    {money(receipt.total, settings.currencySymbol)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Paid</span>
                  <span className="tabular-nums">
                    {money(receipt.amountPaid, settings.currencySymbol)}
                  </span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Change</span>
                  <span className="tabular-nums">
                    {money(receipt.change, settings.currencySymbol)}
                  </span>
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button className="h-11" onClick={() => setReceipt(null)}>
              New sale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(keypadLine)} onOpenChange={() => setKeypadId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quantity</DialogTitle>
          </DialogHeader>
          <p className="text-center text-3xl tabular-nums">{keypadValue || '0'}</p>
          <NumericKeypad
            value={keypadValue}
            onChange={setKeypadValue}
            onDone={() => {
              if (keypadId) setQty(keypadId, Number(keypadValue || '0'));
              setKeypadId(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
