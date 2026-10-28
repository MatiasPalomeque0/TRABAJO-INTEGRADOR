import type { ErrorBoundaryProps } from 'expo-router';
import type { User } from '../types/api';

type DiagnosticDetails = Record<string, boolean | number | string | string[] | undefined>;

function redact(value: string): string {
  return value
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/(password|token|secret|authorization|refreshToken)\s*[:=]\s*\S+/gi, '$1=[redacted]')
    .slice(0, 240);
}

export function safeErrorDetails(error: unknown): DiagnosticDetails {
  if (error instanceof Error) return { name: error.name, message: redact(error.message) };
  return { name: 'UnknownError', message: 'Se recibió un error no estándar.' };
}

export function roleDetails(user: User | null): DiagnosticDetails {
  return { hasUser: Boolean(user), roles: user?.roles ?? [] };
}

export function navigationDiagnostic(event: string, details: DiagnosticDetails = {}): void {
  if (!__DEV__) return;
  console.log(`[TechFixNav] ${event}`, details);
}

export function routeErrorBoundary(route: string, { error, retry }: ErrorBoundaryProps) {
  navigationDiagnostic('render-error', { route, ...safeErrorDetails(error) });
  return { error, retry };
}
