export function BarList({
  rows,
  format,
}: {
  rows: { label: string; value: number }[];
  format?: (value: number) => string;
}) {
  const max = Math.max(1, ...rows.map((row) => Math.abs(row.value)));
  return (
    <div className="grid gap-2">
      {rows.map((row) => (
        <div
          key={row.label}
          className="grid grid-cols-[8rem_1fr_auto] items-center gap-2"
        >
          <span className="truncate text-sm">{row.label}</span>
          <div className="h-6 rounded-md bg-muted">
            <div
              className="h-full rounded-md bg-foreground"
              style={{ width: `${(Math.abs(row.value) / max) * 100}%` }}
            />
          </div>
          <span className="text-sm tabular-nums">
            {format ? format(row.value) : row.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function DualBars({
  rows,
}: {
  rows: { label: string; a: number; b: number }[];
}) {
  const max = Math.max(1, ...rows.flatMap((row) => [row.a, row.b]));
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(2.5rem,1fr))] items-end gap-2 h-48">
      {rows.map((row) => (
        <div key={row.label} className="grid h-full grid-rows-[1fr_auto] gap-1">
          <div className="grid grid-cols-2 items-end gap-px">
            <div
              className="rounded-t-md bg-foreground"
              style={{ height: `${(row.a / max) * 100}%` }}
              title={`Revenue ${row.a}`}
            />
            <div
              className="rounded-t-md bg-muted-foreground"
              style={{ height: `${(row.b / max) * 100}%` }}
              title={`Capital ${row.b}`}
            />
          </div>
          <span className="truncate text-center text-xs text-muted-foreground">
            {row.label.slice(5)}
          </span>
        </div>
      ))}
    </div>
  );
}
