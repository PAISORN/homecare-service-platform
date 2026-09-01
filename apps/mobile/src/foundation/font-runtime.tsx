import { createContext, useContext } from 'react';

export type FontStartupState = 'loading' | 'ready' | 'fallback';

export type AppFontFamilies = Readonly<{
  regular: string | undefined;
  semiBold: string | undefined;
  bold: string | undefined;
}>;

const loadedFontFamilies: AppFontFamilies = {
  regular: 'NotoSansThai_400Regular',
  semiBold: 'NotoSansThai_600SemiBold',
  bold: 'NotoSansThai_700Bold',
};

const fallbackFontFamilies: AppFontFamilies = {
  regular: undefined,
  semiBold: undefined,
  bold: undefined,
};

const AppFontContext = createContext<AppFontFamilies>(fallbackFontFamilies);

export const AppFontProvider = AppFontContext.Provider;

export function resolveFontStartupState(
  loaded: boolean,
  error: Error | null | undefined,
): FontStartupState {
  if (loaded) return 'ready';
  if (error) return 'fallback';
  return 'loading';
}

export function fontFamiliesFor(
  state: Exclude<FontStartupState, 'loading'>,
): AppFontFamilies {
  return state === 'ready' ? loadedFontFamilies : fallbackFontFamilies;
}

export function useAppFontFamilies(): AppFontFamilies {
  return useContext(AppFontContext);
}
