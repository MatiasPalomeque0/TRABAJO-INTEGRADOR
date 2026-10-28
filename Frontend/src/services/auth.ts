import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { APP_SCHEME, API_URL } from '../constants/config';
import { apiRequest } from './api';
import type { AuthResponse, User } from '../types/api';

export const authApi = {
  register: (body: { firstName: string; lastName: string; email: string; password: string; passwordConfirmation: string }) => apiRequest<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) => apiRequest<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me: () => apiRequest<User>('/auth/me'),
  logout: (refreshToken: string) => apiRequest<null>('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) })
};

export async function socialLogin(provider: 'google' | 'github' | 'discord'): Promise<AuthResponse> {
  const start = await fetch(`${API_URL}/auth/oauth/${provider}/start?redirectUri=${encodeURIComponent(APP_SCHEME)}`);
  if (!start.ok) throw new Error('El proveedor social no está disponible.');
  const startJson = await start.json() as { data: { authorizeUrl: string; state: string } };
  const result = await WebBrowser.openAuthSessionAsync(startJson.data.authorizeUrl, APP_SCHEME);
  if (result.type !== 'success' || !result.url) throw new Error('Autenticación social cancelada.');
  const parsed = Linking.parse(result.url);
  const code = typeof parsed.queryParams?.code === 'string' ? parsed.queryParams.code : '';
  const state = typeof parsed.queryParams?.state === 'string' ? parsed.queryParams.state : '';
  if (!code || !state) throw new Error('La respuesta OAuth no contiene un código válido.');
  return apiRequest<AuthResponse>(`/auth/oauth/${provider}/exchange`, { method: 'POST', body: JSON.stringify({ code, state }) }, false);
}

