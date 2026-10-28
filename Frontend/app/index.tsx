import { Redirect, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { Loading } from '../src/components/Feedback';
import { useAuth } from '../src/context/auth-context';
import { navigationDiagnostic, roleDetails } from '../src/utils/navigation-diagnostics';
export default function Index() { const { user, isLoading } = useAuth(); const pathname = usePathname(); useEffect(() => { if (!isLoading) navigationDiagnostic('root-redirect', { from: pathname, to: user ? '/(app)' : '/(auth)/welcome', reason: user ? 'session-present' : 'session-missing', ...roleDetails(user) }); }, [isLoading, pathname, user]); if (isLoading) return <Loading label="Restaurando sesión…" />; return <Redirect href={user ? '/(app)' : '/(auth)/welcome'} />; }

