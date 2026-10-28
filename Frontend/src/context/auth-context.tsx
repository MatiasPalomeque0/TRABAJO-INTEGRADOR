import { createContext, useContext, useEffect, useMemo, useReducer, type PropsWithChildren } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import { authApi, socialLogin as socialLoginApi } from '../services/auth';
import { clearSession, getBiometricUnlocked, getSession, saveSession } from '../services/storage';
import type { AuthResponse, User } from '../types/api';
import { navigationDiagnostic, roleDetails, safeErrorDetails } from '../utils/navigation-diagnostics';

type State = { user: User | null; isLoading: boolean; isSubmitting: boolean };
type Action = { type: 'loading'; value: boolean } | { type: 'submitting'; value: boolean } | { type: 'signedIn'; user: User } | { type: 'signedOut' };
const initialState: State = { user: null, isLoading: true, isSubmitting: false };
function reducer(state: State, action: Action): State { switch (action.type) { case 'loading': return { ...state, isLoading: action.value }; case 'submitting': return { ...state, isSubmitting: action.value }; case 'signedIn': return { ...state, user: action.user, isLoading: false, isSubmitting: false }; case 'signedOut': return { ...initialState, isLoading: false }; } }

type AuthContextValue = State & { login: (email: string, password: string) => Promise<void>; register: (body: Parameters<typeof authApi.register>[0]) => Promise<void>; socialLogin: (provider: 'google' | 'github' | 'discord') => Promise<void>; logout: () => Promise<void>; refreshUser: () => Promise<void>; };
const AuthContext = createContext<AuthContextValue | undefined>(undefined);
async function persist(response: AuthResponse) { await saveSession(response); return response.user; }

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(reducer, initialState);
  useEffect(() => { (async () => { navigationDiagnostic('session-restore-start'); const session = await getSession(); if (!session) { navigationDiagnostic('session-restore-empty', { reason: 'no-session' }); dispatch({ type: 'signedOut' }); return; } try { if (await getBiometricUnlocked()) { navigationDiagnostic('biometric-check-start'); const biometric = await LocalAuthentication.authenticateAsync({ promptMessage: 'Desbloqueá TechFix para continuar' }); if (!biometric.success) { navigationDiagnostic('session-restore-rejected', { reason: 'biometric' }); dispatch({ type: 'signedOut' }); return; } } const user = await authApi.me(); await saveSession({ ...session, user }); navigationDiagnostic('session-restore-success', roleDetails(user)); dispatch({ type: 'signedIn', user }); } catch (error) { navigationDiagnostic('session-restore-error', safeErrorDetails(error)); await clearSession(); dispatch({ type: 'signedOut' }); } })(); }, []);
  const value = useMemo<AuthContextValue>(() => ({ ...state,
    login: async (email, password) => { dispatch({ type: 'submitting', value: true }); try { dispatch({ type: 'signedIn', user: await persist(await authApi.login({ email, password })) }); } finally { dispatch({ type: 'submitting', value: false }); } },
    register: async (body) => { dispatch({ type: 'submitting', value: true }); try { dispatch({ type: 'signedIn', user: await persist(await authApi.register(body)) }); } finally { dispatch({ type: 'submitting', value: false }); } },
    socialLogin: async (provider) => { dispatch({ type: 'submitting', value: true }); try { dispatch({ type: 'signedIn', user: await persist(await socialLoginApi(provider)) }); } finally { dispatch({ type: 'submitting', value: false }); } },
    logout: async () => { const session = await getSession(); try { if (session) await authApi.logout(session.refreshToken); } finally { await clearSession(); dispatch({ type: 'signedOut' }); } },
    refreshUser: async () => { const user = await authApi.me(); const session = await getSession(); if (session) await saveSession({ ...session, user }); dispatch({ type: 'signedIn', user }); }
  }), [state]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider'); return context; }

