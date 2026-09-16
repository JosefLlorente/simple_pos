import { Minus, Plus, Receipt } from 'lucide-react';
import { useEffect, useState } from 'react';
import { asCents } from '../../core/money.ts';
import type { PaymentMethod, Sale } from '../../core/types.ts';
import { PAYMENT_LABELS, PAYMENT_METHODS } from '../../core/types.ts';
import { EmptyState } from '@/components/empty-state';
import { Page } from '@/components/page';
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
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { money } from '@/lib/format';
import { usePos } from '@/lib/pos-context';

function summary(sale: Sale): string {
  return (sale.items ?? []).map((item) => `${item.title} × ${item.qty}`).join(', ');
}

function displaySale(sale: Sale): Sale {
  const total = asCents(sale.total);
  const amountPaid = asCents(sale.amountPaid, total);
  return {
    ...sale,
    total,
    amountPaid,
    change: asCents(sale.change, amountPaid - total),
    items: sale.items ?? [],
    voided: Boolean(sale.voided),
  };
}

export function HistoryScreen({ active }: { active: boolean }) {
  const { settings } = usePos();
  const [sales, setSales] = useState<Sale[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [editing, setEditing] = useState<Sale | null>(null);
  const [voiding, setVoiding] = useState<Sale | null>(null);
  const [payment, setPayment] = useState<PaymentMethod>('cash');
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setSales(
      (
        await window.pos.sales.list(
          from && to ? { from: `${from}T00:00:00.000`, to: `${to}T23:59:59.999` } : undefined,
        )
      ).map(displaySale),
    );
  }

  useEffect(() => {
    if (active) load().catch((err) => setError(String(err)));
  }, [active, from, to]);

  function openEdit(sale: Sale) {
    setError('');
    setPassword('');
    setPayment(sale.paymentMethod);
    setQtys(Object.fromEntries(sale.items.map((item) => [item.id, item.qty])));
    setEditing(sale);
  }

  function openVoid(sale: Sale) {
    setError('');
    setPassword('');
    setVoiding(sale);
  }

  const editTotal = editing
    ? editing.items.reduce(
        (sum, item) => sum + (qtys[item.id] ?? item.qty) * item.priceAtSale,
        0,
      )
    : 0;
  const remaining = editing
    ? editing.items.some((item) => (qtys[item.id] ?? item.qty) > 0)
    : false;

  return (
    <Page
      title="Transaction history"
      actions={
        <>
          <Input
            type="date"
            aria-label="From date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
          <Input
            type="date"
            aria-label="To date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </>
      }
    >
      <div className={sales.length === 0 ? 'h-full p-4' : 'p-4'}>
        {error && !editing && !voiding ? (
          <p className="mb-3 text-sm text-destructive">{error}</p>
        ) : null}
        {sales.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No sales yet"
            body="Completed checkouts show up here. Edit or void a sale with the owner password."
          />
        ) : (
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Pay</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(sale.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{summary(sale)}</TableCell>
                    <TableCell>
                      <p>{PAYMENT_LABELS[sale.paymentMethod] ?? sale.paymentMethod}</p>
                      <p className="text-sm tabular-nums text-muted-foreground">
                        Paid {money(sale.amountPaid, settings.currencySymbol)} ·
                        Change {money(sale.change, settings.currencySymbol)}
                      </p>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {money(sale.total, settings.currencySymbol)}
                      {sale.voided ? (
                        <Badge variant="secondary" className="ml-2">
                          Voided
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {sale.voided ? null : (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="outline"
                            className="h-11"
                            onClick={() => openEdit(sale)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            className="h-11"
                            onClick={() => openVoid(sale)}
                          >
                            Void
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit sale</DialogTitle>
          </DialogHeader>
          {editing ? (
            <div className="grid gap-3">
              {editing.items.map((item) => {
                const qty = qtys[item.id] ?? item.qty;
                return (
                  <div
                    key={item.id}
                    className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-lg border border-border bg-card p-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.title}</p>
                      <p className="text-sm tabular-nums text-muted-foreground">
                        {money(item.priceAtSale, settings.currencySymbol)} each
                      </p>
                    </div>
                    <div className="grid grid-cols-[auto_auto_auto] items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Decrease quantity"
                        onClick={() =>
                          setQtys((current) => ({
                            ...current,
                            [item.id]: Math.max(0, qty - 1),
                          }))
                        }
                      >
                        <Minus className="size-4" />
                      </Button>
                      <span className="w-8 text-center tabular-nums">{qty}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Increase quantity"
                        onClick={() =>
                          setQtys((current) => ({ ...current, [item.id]: qty + 1 }))
                        }
                      >
                        <Plus className="size-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map((method) => (
                  <Button
                    key={method}
                    type="button"
                    variant={payment === method ? 'default' : 'outline'}
                    className="h-11"
                    onClick={() => setPayment(method)}
                  >
                    {PAYMENT_LABELS[method]}
                  </Button>
                ))}
              </div>
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span className="tabular-nums">
                  {money(editTotal, settings.currencySymbol)}
                </span>
              </div>
              <div className="grid gap-1 text-sm">
                <div className="flex justify-between">
                  <span>Paid</span>
                  <span className="tabular-nums">
                    {money(editing.amountPaid, settings.currencySymbol)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Change</span>
                  <span className="tabular-nums">
                    {money(editing.amountPaid - editTotal, settings.currencySymbol)}
                  </span>
                </div>
              </div>
              <div className="grid gap-1">
                <Label htmlFor="edit-password">Owner password</Label>
                <Input
                  id="edit-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </div>
          ) : null}
          <DialogFooter className="grid grid-cols-2">
            <Button
              variant="outline"
              className="h-11"
              onClick={() => setEditing(null)}
            >
              Cancel
            </Button>
            <Button
              className="h-11"
              disabled={!remaining}
              onClick={async () => {
                if (!editing) return;
                setError('');
                try {
                  await window.pos.sales.update(password, editing.id, {
                    paymentMethod: payment,
                    items: editing.items.map((item) => ({
                      id: item.id,
                      qty: qtys[item.id] ?? item.qty,
                    })),
                  });
                  setEditing(null);
                  await load();
                } catch (err) {
                  setError(err instanceof Error ? err.message : String(err));
                }
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(voiding)}
        onOpenChange={(open) => {
          if (!open) setVoiding(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void sale?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Stock is restored. The sale stays in history as voided.
          </p>
          <div className="grid gap-1">
            <Label htmlFor="void-password">Owner password</Label>
            <Input
              id="void-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter className="grid grid-cols-2">
            <Button
              variant="outline"
              className="h-11"
              onClick={() => setVoiding(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="h-11"
              onClick={async () => {
                if (!voiding) return;
                setError('');
                try {
                  await window.pos.sales.void(password, voiding.id);
                  setVoiding(null);
                  await load();
                } catch (err) {
                  setError(err instanceof Error ? err.message : String(err));
                }
              }}
            >
              Void
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
