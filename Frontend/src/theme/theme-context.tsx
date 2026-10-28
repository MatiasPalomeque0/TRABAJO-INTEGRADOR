import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { darkColors, lightColors } from './colors';
import type { ThemeMode } from '../types/api';

const STORAGE_KEY = 'techfix.theme';
type ThemeContextValue = { mode: ThemeMode; setMode: (mode: ThemeMode) => Promise<void>; isDark: boolean; colors: typeof lightColors };
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  useEffect(() => { AsyncStorage.getItem(STORAGE_KEY).then((value) => { if (value === 'system' || value === 'light' || value === 'dark') setModeState(value); }); }, []);
  const setMode = async (next: ThemeMode) => { setModeState(next); await AsyncStorage.setItem(STORAGE_KEY, next); };
  const isDark = mode === 'dark' || (mode === 'system' && systemScheme === 'dark');
  const value = useMemo(() => ({ mode, setMode, isDark, colors: isDark ? darkColors : lightColors }), [mode, isDark]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() { const context = useContext(ThemeContext); if (!context) throw new Error('useTheme debe usarse dentro de ThemeProvider'); return context; }

