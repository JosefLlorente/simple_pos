import type { ReactNode } from 'react';

export function Page({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_1fr]">
      <header className="flex items-center gap-2 border-b border-border bg-card px-4 py-3">
        <h1 className="text-lg font-semibold">{title}</h1>
        <div className="ml-auto flex items-center gap-2">{actions}</div>
      </header>
      <div className="min-h-0 overflow-auto">{children}</div>
    </div>
  );
}
