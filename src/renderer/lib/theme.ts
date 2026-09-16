import type { Palette } from '../../core/types.ts';

const DARK = new Set<Palette>(['dark', 'dracula', 'slate']);

export function applyTheme(palette: Palette): void {
  const root = document.documentElement;
  root.dataset.theme = palette;
  root.classList.toggle('dark', DARK.has(palette));
}
