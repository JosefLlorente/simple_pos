import { Package, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Product } from '../../core/types.ts';
import { EmptyState } from '@/components/empty-state';
import { Page } from '@/components/page';
import { ProductCard } from '@/components/product-card';
import { ProductFormDialog } from '@/components/product-form';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { money, today } from '@/lib/format';
import { usePos } from '@/lib/pos-context';

export function InventoryScreen({ active }: { active: boolean }) {
  const { settings } = usePos();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [editing, setEditing] = useState<Product | null | undefined>(undefined);
  const [removing, setRemoving] = useState<Product | null>(null);
  const [suggest, setSuggest] = useState<{
    label: string;
    amount: number;
  } | null>(null);
  const [error, setError] = useState('');

  async function load() {
    setProducts(await window.pos.products.list({ search }));
  }

  useEffect(() => {
    if (active) load().catch((err) => setError(String(err)));
  }, [active, search]);

  const categories = [
    ...new Set(products.map((product) => product.category).filter(Boolean)),
  ];
  const visible =
    category === 'all'
      ? products
      : products.filter((product) => product.category === category);

  return (
    <Page
      title="Inventory"
      actions={
        <>
          <div className="relative w-40 sm:w-56">
            <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-11 pl-8"
              placeholder="Search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-11 w-36 data-[size=default]:h-11">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {categories.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button className="h-11" onClick={() => setEditing(null)}>
            <Plus className="size-4" />
            Add
          </Button>
        </>
      }
    >
      <div className={visible.length === 0 ? 'h-full p-4' : 'p-4'}>
        {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
        {visible.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No products yet"
            body="Add your catalog with prices, cost, and stock before opening the till."
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {visible.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                currency={settings.currencySymbol}
                lowStockThreshold={settings.lowStockThreshold}
                footer={
                  <>
                    <Button
                      variant="outline"
                      className="h-11"
                      onClick={() => setEditing(product)}
                    >
                      <Pencil className="size-4" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      className="h-11"
                      onClick={() => setRemoving(product)}
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </Button>
                  </>
                }
              />
            ))}
          </div>
        )}
      </div>
      {editing !== undefined ? (
        <ProductFormDialog
          open
          product={editing}
          onOpenChange={(open) => {
            if (!open) setEditing(undefined);
          }}
          onSave={async (input, previous) => {
            const saved = previous
              ? await window.pos.products.update(previous.id, input)
              : await window.pos.products.create(input);
            const added = saved.stock - (previous?.stock ?? 0);
            await load();
            if (added > 0 && saved.cost > 0) {
              setSuggest({
                label: `Restock ${saved.title} × ${added}`,
                amount: added * saved.cost,
              });
            }
          }}
        />
      ) : null}
      <AlertDialog open={Boolean(removing)} onOpenChange={() => setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {removing?.title}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the product from inventory. Past sales keep the name
              they were sold under.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="grid grid-cols-2">
            <AlertDialogCancel className="h-11">Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="h-11"
              onClick={async () => {
                if (!removing) return;
                await window.pos.products.remove(removing.id);
                setRemoving(null);
                await load();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={Boolean(suggest)} onOpenChange={() => setSuggest(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log restock as capital?</DialogTitle>
          </DialogHeader>
          {suggest ? (
            <p className="text-sm text-muted-foreground">
              {suggest.label} cost {money(suggest.amount, settings.currencySymbol)}.
              Add this to capital so profit is not double-counted from inventory
              cost.
            </p>
          ) : null}
          <DialogFooter className="grid grid-cols-2">
            <Button
              variant="outline"
              className="h-11"
              onClick={() => setSuggest(null)}
            >
              Skip
            </Button>
            <Button
              className="h-11"
              onClick={async () => {
                if (!suggest) return;
                await window.pos.capital.create({
                  label: suggest.label,
                  amount: suggest.amount,
                  category: 'inventory',
                  date: today(),
                });
                setSuggest(null);
              }}
            >
              Add capital entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
