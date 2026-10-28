import * as SecureStore from 'expo-secure-store';
import type { AuthResponse } from '../types/api';

const ACCESS = 'techfix.access';
const REFRESH = 'techfix.refresh';
const USER = 'techfix.user';
export async function saveSession(session: AuthResponse) { await Promise.all([SecureStore.setItemAsync(ACCESS, session.accessToken), SecureStore.setItemAsync(REFRESH, session.refreshToken), SecureStore.setItemAsync(USER, JSON.stringify(session.user))]); }
export async function getSession() { const [accessToken, refreshToken, userJson] = await Promise.all([SecureStore.getItemAsync(ACCESS), SecureStore.getItemAsync(REFRESH), SecureStore.getItemAsync(USER)]); return accessToken && refreshToken && userJson ? { accessToken, refreshToken, user: JSON.parse(userJson) as AuthResponse['user'] } : null; }
export async function saveTokens(accessToken: string, refreshToken: string) { await Promise.all([SecureStore.setItemAsync(ACCESS, accessToken), SecureStore.setItemAsync(REFRESH, refreshToken)]); }
export async function clearSession() { await Promise.all([SecureStore.deleteItemAsync(ACCESS), SecureStore.deleteItemAsync(REFRESH), SecureStore.deleteItemAsync(USER)]); }
export async function setBiometricUnlocked(value: boolean) { await SecureStore.setItemAsync('techfix.biometric-unlocked', String(value)); }
export async function getBiometricUnlocked() { return (await SecureStore.getItemAsync('techfix.biometric-unlocked')) === 'true'; }

