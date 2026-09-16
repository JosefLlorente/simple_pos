import type { ReactNode } from 'react';
import { Package } from 'lucide-react';
import type { Product } from '../../core/types.ts';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { imageSrc, money } from '@/lib/format';
import { cn } from '@/lib/utils';

export function ProductCard({
  product,
  currency,
  lowStockThreshold,
  onSelect,
  disabled,
  footer,
}: {
  product: Product;
  currency: string;
  lowStockThreshold: number;
  onSelect?: () => void;
  disabled?: boolean;
  footer?: ReactNode;
}) {
  const src = imageSrc(product.image);
  const low = product.stock <= lowStockThreshold;
  return (
    <Card className="gap-2 overflow-hidden p-0">
      <button
        type="button"
        disabled={disabled}
        onClick={onSelect}
        className={cn(
          'grid w-full gap-2 p-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring',
          disabled && 'opacity-50',
          !onSelect && 'cursor-default',
        )}
      >
        {src ? (
          <img
            src={src}
            alt=""
            className="aspect-square w-full rounded-md object-cover"
          />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center rounded-md bg-muted">
            <Package className="size-6 text-muted-foreground" />
          </div>
        )}
        <div className="grid gap-1">
          <p className="truncate font-medium">{product.title}</p>
          {product.subtitle ? (
            <p className="truncate text-sm text-muted-foreground">
              {product.subtitle}
            </p>
          ) : null}
          <div className="flex items-center gap-2">
            <span className="text-sm tabular-nums">
              {money(product.price, currency)}
            </span>
            <Badge variant={low ? 'destructive' : 'secondary'}>
              {product.stock} in stock
            </Badge>
          </div>
        </div>
      </button>
      {footer ? <div className="grid grid-cols-2 gap-2 border-t border-border p-2">{footer}</div> : null}
    </Card>
  );
}
