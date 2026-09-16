import { ImagePlus } from 'lucide-react';
import { useState } from 'react';
import type { Product, ProductInput } from '../../core/types.ts';
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
import { Textarea } from '@/components/ui/textarea';
import { imageSrc, parseMoney } from '@/lib/format';

type Draft = {
  title: string;
  subtitle: string;
  price: string;
  cost: string;
  image: string | null;
  category: string;
  stock: string;
};

function fromProduct(product?: Product | null): Draft {
  return {
    title: product?.title ?? '',
    subtitle: product?.subtitle ?? '',
    price: product ? (product.price / 100).toFixed(2) : '',
    cost: product ? (product.cost / 100).toFixed(2) : '0.00',
    image: product?.image ?? null,
    category: product?.category ?? '',
    stock: product ? String(product.stock) : '0',
  };
}

export function ProductFormDialog({
  open,
  product,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  product?: Product | null;
  onOpenChange: (open: boolean) => void;
  onSave: (
    input: ProductInput,
    previous: Product | null,
  ) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Draft>(() => fromProduct(product));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const src = imageSrc(draft.image);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function pickImage() {
    const filename = await window.pos.files.pickImage();
    if (filename) set('image', filename);
  }

  async function submit() {
    setError('');
    setBusy(true);
    try {
      const stock = Number(draft.stock);
      if (!Number.isInteger(stock) || stock < 0) {
        throw new Error('Stock must be a whole number');
      }
      await onSave(
        {
          title: draft.title,
          subtitle: draft.subtitle,
          price: parseMoney(draft.price),
          cost: parseMoney(draft.cost || '0'),
          image: draft.image,
          category: draft.category,
          stock,
        },
        product ?? null,
      );
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setDraft(fromProduct(product));
          setError('');
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{product ? 'Edit product' : 'Add product'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <button
            type="button"
            onClick={pickImage}
            className="flex aspect-video items-center justify-center overflow-hidden rounded-md border border-border bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {src ? (
              <img src={src} alt="" className="size-full object-cover" />
            ) : (
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <ImagePlus className="size-5" />
                Choose image
              </span>
            )}
          </button>
          <div className="grid gap-1">
            <Label htmlFor="product-title">Title</Label>
            <Input
              id="product-title"
              value={draft.title}
              onChange={(event) => set('title', event.target.value)}
              required
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="product-subtitle">Subtitle</Label>
            <Textarea
              id="product-subtitle"
              value={draft.subtitle}
              onChange={(event) => set('subtitle', event.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1">
              <Label htmlFor="product-price">Price</Label>
              <Input
                id="product-price"
                inputMode="decimal"
                value={draft.price}
                onChange={(event) => set('price', event.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="product-cost">Cost</Label>
              <Input
                id="product-cost"
                inputMode="decimal"
                value={draft.cost}
                onChange={(event) => set('cost', event.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1">
              <Label htmlFor="product-category">Category</Label>
              <Input
                id="product-category"
                value={draft.category}
                onChange={(event) => set('category', event.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="product-stock">Stock</Label>
              <Input
                id="product-stock"
                inputMode="numeric"
                value={draft.stock}
                onChange={(event) => set('stock', event.target.value)}
              />
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter className="grid grid-cols-2">
          <Button
            variant="outline"
            className="h-11"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button className="h-11" disabled={busy} onClick={submit}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
