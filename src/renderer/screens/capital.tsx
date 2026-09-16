import { Plus, Trash2, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { CapitalCategory, CapitalEntry } from '../../core/types.ts';
import { CAPITAL_CATEGORIES } from '../../core/types.ts';
import { EmptyState } from '@/components/empty-state';
import { Page } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { money, parseMoney, today } from '@/lib/format';
import { usePos } from '@/lib/pos-context';

const LABELS: Record<CapitalCategory, string> = {
  inventory: 'Inventory',
  rent: 'Rent',
  utilities: 'Utilities',
  misc: 'Misc',
};

export function CapitalScreen({ active }: { active: boolean }) {
  const { settings } = usePos();
  const [entries, setEntries] = useState<CapitalEntry[]>([]);
  const [totals, setTotals] = useState({ spent: 0, revenue: 0, net: 0 });
  const [category, setCategory] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [entryCategory, setEntryCategory] = useState<CapitalCategory>('inventory');
  const [date, setDate] = useState(today());
  const [error, setError] = useState('');

  async function load() {
    const query = {
      category: category === 'all' ? '' : category,
      from,
      to,
    };
    const [list, nextTotals] = await Promise.all([
      window.pos.capital.list(query),
      window.pos.capital.totals(
        from && to
          ? { from: `${from}T00:00:00.000Z`, to: `${to}T23:59:59.999Z` }
          : undefined,
      ),
    ]);
    setEntries(list);
    setTotals(nextTotals);
  }

  useEffect(() => {
    if (active) load().catch((err) => setError(String(err)));
  }, [active, category, from, to]);

  async function add() {
    setError('');
    try {
      await window.pos.capital.create({
        label,
        amount: parseMoney(amount),
        category: entryCategory,
        date,
      });
      setLabel('');
      setAmount('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <Page title="Capital">
      <div className="grid gap-4 p-4">
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="gap-1 p-4">
            <p className="text-sm text-muted-foreground">Capital spent</p>
            <p className="text-2xl font-semibold tabular-nums">
              {money(totals.spent, settings.currencySymbol)}
            </p>
          </Card>
          <Card className="gap-1 p-4">
            <p className="text-sm text-muted-foreground">Sales revenue</p>
            <p className="text-2xl font-semibold tabular-nums">
              {money(totals.revenue, settings.currencySymbol)}
            </p>
          </Card>
          <Card className="gap-1 p-4">
            <p className="text-sm text-muted-foreground">Net</p>
            <p className="text-2xl font-semibold tabular-nums">
              {money(totals.net, settings.currencySymbol)}
            </p>
          </Card>
        </div>
        <form
          className="grid gap-2 rounded-lg border border-border bg-card p-4 md:grid-cols-[1fr_8rem_9rem_9rem_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            add();
          }}
        >
          <div className="grid gap-1">
            <Label htmlFor="cap-label">Label</Label>
            <Input
              id="cap-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              required
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="cap-amount">Amount</Label>
            <Input
              id="cap-amount"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
          </div>
          <div className="grid gap-1">
            <Label>Category</Label>
            <Select
              value={entryCategory}
              onValueChange={(value) => setEntryCategory(value as CapitalCategory)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CAPITAL_CATEGORIES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {LABELS[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="cap-date">Date</Label>
            <Input
              id="cap-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </div>
          <Button type="submit" className="h-11 self-end">
            <Plus className="size-4" />
            Add
          </Button>
        </form>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Filter category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CAPITAL_CATEGORIES.map((item) => (
                <SelectItem key={item} value={item}>
                  {LABELS[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {entries.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No capital entries"
            body="Record stock purchases, rent, and other money put into the business."
          />
        ) : (
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{entry.date}</TableCell>
                    <TableCell>{entry.label}</TableCell>
                    <TableCell>{LABELS[entry.category]}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(entry.amount, settings.currencySymbol)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Delete entry"
                        onClick={async () => {
                          await window.pos.capital.remove(entry.id);
                          await load();
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </Page>
  );
}
