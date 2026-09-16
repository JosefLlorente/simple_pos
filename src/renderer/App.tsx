import {
  BarChart3,
  History,
  Package,
  Settings,
  ShoppingCart,
  Wallet,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Palette, Settings as AppSettings } from '../core/types.ts';
import { DEFAULT_SETTINGS, isPalette } from '../core/types.ts';
import { Button } from '@/components/ui/button';
import { PosContext } from '@/lib/pos-context';
import { applyTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { CapitalScreen } from '@/screens/capital';
import { HistoryScreen } from '@/screens/history';
import { InventoryScreen } from '@/screens/inventory';
import { SaleScreen } from '@/screens/sale';
import { SettingsScreen } from '@/screens/settings';
import { StatisticsScreen } from '@/screens/statistics';

const SCREENS = [
  { id: 'sale', label: 'Sale', icon: ShoppingCart },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'capital', label: 'Capital', icon: Wallet },
  { id: 'statistics', label: 'Statistics', icon: BarChart3 },
  { id: 'history', label: 'History', icon: History },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const;

type ScreenId = (typeof SCREENS)[number]['id'];

function readScreen(): ScreenId {
  const id = location.hash.replace(/^#\/?/, '');
  return SCREENS.some((screen) => screen.id === id) ? (id as ScreenId) : 'sale';
}

export function App() {
  const [screen, setScreen] = useState<ScreenId>(readScreen);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [bootError, setBootError] = useState('');

  async function refreshSettings() {
    const next = await window.pos.settings.get();
    setSettings((prev) => ({
      ...DEFAULT_SETTINGS,
      ...next,
      palette: isPalette(next.palette) ? next.palette : prev.palette,
    }));
  }

  async function setPalette(palette: Palette) {
    applyTheme(palette);
    setSettings((prev) => ({ ...prev, palette }));
    await window.pos.settings.set({ palette });
  }

  useEffect(() => {
    refreshSettings().catch((err) => setBootError(String(err)));
    const onHash = () => setScreen(readScreen());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    applyTheme(settings.palette);
  }, [settings.palette]);

  function go(id: ScreenId) {
    location.hash = id;
    setScreen(id);
  }

  return (
    <PosContext.Provider value={{ settings, refreshSettings, setPalette }}>
      <div
        data-theme={settings.palette}
        className="grid h-svh grid-rows-[1fr_auto] bg-background text-foreground md:grid-cols-[13rem_1fr] md:grid-rows-1"
      >
        <main className="min-h-0 overflow-hidden [grid-area:1/1] md:[grid-area:1/2]">
          {bootError ? (
            <p className="p-4 text-sm text-destructive">{bootError}</p>
          ) : null}
          <div className={cn('h-full', screen !== 'sale' && 'hidden')}>
            <SaleScreen active={screen === 'sale'} />
          </div>
          <div className={cn('h-full', screen !== 'inventory' && 'hidden')}>
            <InventoryScreen active={screen === 'inventory'} />
          </div>
          <div className={cn('h-full', screen !== 'capital' && 'hidden')}>
            <CapitalScreen active={screen === 'capital'} />
          </div>
          <div className={cn('h-full', screen !== 'statistics' && 'hidden')}>
            <StatisticsScreen active={screen === 'statistics'} />
          </div>
          <div className={cn('h-full', screen !== 'history' && 'hidden')}>
            <HistoryScreen active={screen === 'history'} />
          </div>
          <div className={cn('h-full', screen !== 'settings' && 'hidden')}>
            <SettingsScreen />
          </div>
        </main>
        <nav className="grid grid-cols-6 border-t border-border bg-card md:grid-cols-1 md:grid-rows-[auto_1fr] md:border-t-0 md:border-r">
          <p className="hidden truncate px-4 py-4 text-sm font-semibold md:block">
            {settings.businessName}
          </p>
          <div className="grid grid-cols-6 md:grid-cols-1 md:content-start">
            {SCREENS.map((item) => {
              const Icon = item.icon;
              const current = screen === item.id;
              return (
                <Button
                  key={item.id}
                  variant={current ? 'default' : 'ghost'}
                  className="h-14 flex-col gap-1 rounded-none md:h-11 md:flex-row md:justify-start md:px-4"
                  onClick={() => go(item.id)}
                >
                  <Icon className="size-5 md:size-4" />
                  <span className="text-[10px] md:text-sm">{item.label}</span>
                </Button>
              );
            })}
          </div>
        </nav>
      </div>
    </PosContext.Provider>
  );
}
