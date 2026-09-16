import { Delete } from 'lucide-react';
import { Button } from '@/components/ui/button';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', 'done'] as const;

export function NumericKeypad({
  value,
  onChange,
  onDone,
}: {
  value: string;
  onChange: (value: string) => void;
  onDone: () => void;
}) {
  function press(key: (typeof KEYS)[number]) {
    if (key === 'done') {
      onDone();
      return;
    }
    if (key === 'back') {
      onChange(value.slice(0, -1));
      return;
    }
    onChange(value === '0' ? key : `${value}${key}`);
  }

  return (
    <div className="grid grid-cols-3 gap-1">
      {KEYS.map((key) => (
        <Button
          key={key}
          type="button"
          variant={key === 'done' ? 'default' : 'outline'}
          className="h-11 text-base"
          aria-label={key === 'back' ? 'Backspace' : key}
          onClick={() => press(key)}
        >
          {key === 'back' ? <Delete className="size-4" /> : key === 'done' ? 'OK' : key}
        </Button>
      ))}
    </div>
  );
}
