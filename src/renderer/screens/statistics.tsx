import { BarChart3 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { DateRange, StatsSummary } from '../../core/types.ts';
import { rangePreset } from '../../core/range.ts';
import { BarList, DualBars } from '@/components/chart';
import { EmptyState } from '@/components/empty-state';
import { Page } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { money } from '@/lib/format';
import { usePos } from '@/lib/pos-context';

type Preset = 'today' | 'week' | 'month' | 'custom';

export function StatisticsScreen({ active }: { active: boolean }) {
  const { settings } = usePos();
  const [preset, setPreset] = useState<Preset>('today');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<StatsSummary | null>(null);
  const [error, setError] = useState('');

  function range(): DateRange {
    if (preset === 'custom' && from && to) {
      return { from: `${from}T00:00:00.000`, to: `${to}T23:59:59.999` };
    }
    return rangePreset(preset === 'custom' ? 'today' : preset);
  }

  async function load() {
    setData(await window.pos.stats.summary(range()));
  }

  useEffect(() => {
    if (active) load().catch((err) => setError(String(err)));
  }, [active, preset, from, to]);

  const empty = data && data.revenue === 0 && data.capital === 0;

  return (
    <Page
      title="Statistics"
      actions={
        <>
          <Button
            variant="outline"
            onClick={() => window.pos.files.exportSales(range())}
          >
            Export sales
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              window.pos.files.exportCapital({
                from: range().from.slice(0, 10),
                to: range().to.slice(0, 10),
              })
            }
          >
            Export capital
          </Button>
        </>
      }
    >
      <div className="grid gap-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={preset} onValueChange={(value) => setPreset(value as Preset)}>
            <TabsList>
              <TabsTrigger value="today">Today</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="custom">Custom</TabsTrigger>
            </TabsList>
          </Tabs>
          {preset === 'custom' ? (
            <>
              <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
              <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </>
          ) : null}
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {empty ? (
          <EmptyState
            icon={BarChart3}
            title="No activity in this range"
            body="Complete a sale or add a capital entry to see totals, trends, and best sellers."
          />
        ) : data ? (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="gap-1 p-4">
                <p className="text-sm text-muted-foreground">Revenue</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {money(data.revenue, settings.currencySymbol)}
                </p>
              </Card>
              <Card className="gap-1 p-4">
                <p className="text-sm text-muted-foreground">Capital</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {money(data.capital, settings.currencySymbol)}
                </p>
              </Card>
              <Card className="gap-1 p-4">
                <p className="text-sm text-muted-foreground">Net</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {money(data.net, settings.currencySymbol)}
                </p>
              </Card>
            </div>
            <Card className="gap-3 p-4">
              <p className="font-medium">Revenue vs capital</p>
              <div className="mb-2 flex gap-4 text-sm text-muted-foreground">
                <span>Foreground: revenue</span>
                <span>Muted: capital</span>
              </div>
              <DualBars
                rows={data.byDay.map((day) => ({
                  label: day.day,
                  a: day.revenue,
                  b: day.capital,
                }))}
              />
            </Card>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="gap-3 p-4">
                <p className="font-medium">Best sellers</p>
                {data.best.length ? (
                  <BarList
                    rows={data.best.map((row) => ({
                      label: row.title,
                      value: row.qty,
                    }))}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">No sales in range.</p>
                )}
              </Card>
              <Card className="gap-3 p-4">
                <p className="font-medium">Slowest products</p>
                {data.worst.length ? (
                  <BarList
                    rows={data.worst.map((row) => ({
                      label: row.title,
                      value: row.qty,
                    }))}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Add products to compare.</p>
                )}
              </Card>
            </div>
          </>
        ) : null}
      </div>
    </Page>
  );
}
