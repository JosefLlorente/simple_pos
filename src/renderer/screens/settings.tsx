import { ImagePlus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PALETTES, type Palette } from '../../core/types.ts';
import { Page } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { imageSrc } from '@/lib/format';
import { usePos } from '@/lib/pos-context';
import { cn } from '@/lib/utils';

export function SettingsScreen() {
  const { settings, refreshSettings, setPalette } = usePos();
  const [businessName, setBusinessName] = useState(settings.businessName);
  const [currencySymbol, setCurrencySymbol] = useState(settings.currencySymbol);
  const [lowStockThreshold, setLowStockThreshold] = useState(
    String(settings.lowStockThreshold),
  );
  const [gcashNumber, setGcashNumber] = useState(settings.gcashNumber);
  const [gcashQr, setGcashQr] = useState(settings.gcashQr);
  const [bankAccount, setBankAccount] = useState(settings.bankAccount);
  const [bankQr, setBankQr] = useState(settings.bankQr);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setBusinessName(settings.businessName);
    setCurrencySymbol(settings.currencySymbol);
    setLowStockThreshold(String(settings.lowStockThreshold));
    setGcashNumber(settings.gcashNumber);
    setGcashQr(settings.gcashQr);
    setBankAccount(settings.bankAccount);
    setBankQr(settings.bankQr);
  }, [
    settings.businessName,
    settings.currencySymbol,
    settings.lowStockThreshold,
    settings.gcashNumber,
    settings.gcashQr,
    settings.bankAccount,
    settings.bankQr,
  ]);

  async function selectPalette(palette: Palette) {
    setError('');
    try {
      await setPalette(palette);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function save() {
    setError('');
    setSaved(false);
    try {
      const threshold = Number(lowStockThreshold);
      if (!Number.isInteger(threshold) || threshold < 1) {
        throw new Error('Low-stock threshold must be a whole number of at least 1');
      }
      await window.pos.settings.set({
        businessName,
        currencySymbol,
        lowStockThreshold: threshold,
        gcashNumber,
        gcashQr,
        bankAccount,
        bankQr,
      });
      await refreshSettings();
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <Page title="Settings">
      <form
        className="grid max-w-lg gap-3 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <div className="grid gap-1">
          <Label htmlFor="biz-name">Business name</Label>
          <Input
            id="biz-name"
            value={businessName}
            onChange={(event) => setBusinessName(event.target.value)}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="currency">Currency symbol</Label>
          <Input
            id="currency"
            value={currencySymbol}
            onChange={(event) => setCurrencySymbol(event.target.value)}
            maxLength={4}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="low-stock">Low-stock threshold</Label>
          <Input
            id="low-stock"
            inputMode="numeric"
            value={lowStockThreshold}
            onChange={(event) => setLowStockThreshold(event.target.value)}
          />
        </div>
        <div className="grid gap-1">
          <Label id="palette-label">Palette</Label>
          <div
            role="radiogroup"
            aria-labelledby="palette-label"
            className="grid grid-cols-2 gap-2 sm:grid-cols-5"
          >
            {PALETTES.map((palette) => {
              const selected = settings.palette === palette;
              return (
                <Button
                  key={palette}
                  type="button"
                  variant="outline"
                  role="radio"
                  aria-checked={selected}
                  className={cn(
                    'h-auto min-h-11 flex-col gap-1 px-2 py-2',
                    selected && 'border-foreground',
                  )}
                  onClick={() => selectPalette(palette)}
                >
                  <span
                    data-theme={palette}
                    className="flex h-6 w-full items-end overflow-hidden rounded-md border border-border bg-background"
                  >
                    <span className="h-2 w-full bg-primary" />
                  </span>
                  <span className="capitalize">{palette}</span>
                </Button>
              );
            })}
          </div>
        </div>
        <div className="grid gap-1">
          <p className="text-sm font-medium">GCash</p>
          <p className="text-sm text-muted-foreground">
            Shown at checkout so the customer can scan or send to this number.
          </p>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="gcash-number">Mobile number</Label>
          <Input
            id="gcash-number"
            inputMode="tel"
            value={gcashNumber}
            onChange={(event) => setGcashNumber(event.target.value)}
          />
        </div>
        <QrField
          label="GCash QR"
          filename={gcashQr}
          onChange={setGcashQr}
        />
        <div className="grid gap-1">
          <p className="text-sm font-medium">Bank transfer</p>
          <p className="text-sm text-muted-foreground">
            Shown at checkout with the account number and QR.
          </p>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="bank-account">Account number</Label>
          <Input
            id="bank-account"
            value={bankAccount}
            onChange={(event) => setBankAccount(event.target.value)}
          />
        </div>
        <QrField
          label="Bank transfer QR"
          filename={bankQr}
          onChange={setBankQr}
        />
        <div className="grid gap-1">
          <Label>CSV folder</Label>
          <div className="grid grid-cols-[1fr_auto] items-center gap-2">
            <code className="truncate rounded-md bg-muted px-2 py-2 text-sm">
              {settings.csvDir}
            </code>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={async () => {
                const dir = await window.pos.files.pickFolder();
                if (dir) await refreshSettings();
              }}
            >
              Change
            </Button>
          </div>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {saved ? <p className="text-sm">Saved.</p> : null}
        <Button type="submit" className="h-11 w-fit">
          Save settings
        </Button>
      </form>
      <OwnerPasswordForm />
    </Page>
  );
}

function OwnerPasswordForm() {
  const { settings, refreshSettings } = usePos();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  async function save() {
    setError('');
    setSaved(false);
    try {
      if (next !== confirm) throw new Error('New passwords do not match');
      await window.pos.settings.setPassword(current, next);
      setCurrent('');
      setNext('');
      setConfirm('');
      await refreshSettings();
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <form
      className="grid max-w-lg gap-3 border-t border-border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <div className="grid gap-1">
        <p className="text-sm font-medium">Owner password</p>
        <p className="text-sm text-muted-foreground">
          Required to edit or void a sale. Set this once and keep it to yourself.
        </p>
      </div>
      {settings.ownerPasswordSet ? (
        <div className="grid gap-1">
          <Label htmlFor="owner-current">Current password</Label>
          <Input
            id="owner-current"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
          />
        </div>
      ) : null}
      <div className="grid gap-1">
        <Label htmlFor="owner-next">
          {settings.ownerPasswordSet ? 'New password' : 'Password'}
        </Label>
        <Input
          id="owner-next"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(event) => setNext(event.target.value)}
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="owner-confirm">Confirm password</Label>
        <Input
          id="owner-confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {saved ? <p className="text-sm">Password saved.</p> : null}
      <Button type="submit" className="h-11 w-fit">
        {settings.ownerPasswordSet ? 'Change password' : 'Set password'}
      </Button>
    </form>
  );
}

function QrField({
  label,
  filename,
  onChange,
}: {
  label: string;
  filename: string | null;
  onChange: (filename: string | null) => void;
}) {
  const src = imageSrc(filename);
  return (
    <div className="grid gap-1">
      <Label>{label}</Label>
      <div className="flex items-start gap-2">
        <button
          type="button"
          aria-label={`Upload ${label}`}
          onClick={async () => {
            const next = await window.pos.files.pickImage();
            if (next) onChange(next);
          }}
          className="flex size-40 items-center justify-center overflow-hidden rounded-md border border-border bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {src ? (
            <img src={src} alt="" className="size-full object-contain" />
          ) : (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <ImagePlus className="size-5" />
              Upload QR
            </span>
          )}
        </button>
        {filename ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11"
            aria-label={`Remove ${label}`}
            onClick={() => onChange(null)}
          >
            <Trash2 className="size-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
