import { Stack, usePathname, useRootNavigationState, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../src/context/auth-context';
import { ThemeProvider, useTheme } from '../src/theme/theme-context';
import { navigationDiagnostic } from '../src/utils/navigation-diagnostics';

function AppStack() { const { isDark } = useTheme(); const pathname = usePathname(); const segments = useSegments(); const navigationState = useRootNavigationState(); useEffect(() => { navigationDiagnostic('route-state', { path: pathname }); navigationDiagnostic('root-navigation-state', { path: pathname, segments: segments.join('/'), rootIndex: navigationState?.index, rootRoutes: navigationState?.routes?.map((route) => route.name).join('|') }); }, [pathname, segments, navigationState]); return <><StatusBar style={isDark ? 'light' : 'dark'} /><Stack screenOptions={{ headerShown: false, animation: 'fade' }} /></>; }
export default function RootLayout() { return <ThemeProvider><AuthProvider><AppStack /></AuthProvider></ThemeProvider>; }

