import { createContext, useContext } from 'react';
import type { Palette, Settings } from '../../core/types.ts';
import { DEFAULT_SETTINGS } from '../../core/types.ts';

type Ctx = {
  settings: Settings;
  refreshSettings: () => Promise<void>;
  setPalette: (palette: Palette) => Promise<void>;
};

export const PosContext = createContext<Ctx>({
  settings: DEFAULT_SETTINGS,
  refreshSettings: async () => {},
  setPalette: async () => {},
});

export function usePos() {
  return useContext(PosContext);
}
