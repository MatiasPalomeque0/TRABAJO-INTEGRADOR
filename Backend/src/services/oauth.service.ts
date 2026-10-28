import { env } from '../config/env.js';
import { pool, withTransaction } from '../config/db.js';
import { AppError } from '../utils/errors.js';
import { pkceChallenge, randomToken, sha256 } from '../utils/crypto.js';
import { createRefreshToken, signAccessToken } from '../utils/jwt.js';
import { findUserByEmail, findUserById, toAuthUser } from '../repositories/user.repository.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type { AuthUser, Role } from '../types/domain.js';

export type OAuthProvider = 'google' | 'github' | 'discord';
type OAuthConfig = { clientId: string; clientSecret: string; authorizeUrl: string; tokenUrl: string; userUrl: string; scope: string };
type OAuthProfile = { providerUserId: string; email: string; firstName: string; lastName: string; avatarUrl: string | null; verified: boolean };

function configFor(provider: OAuthProvider): OAuthConfig {
  const values: Record<OAuthProvider, OAuthConfig> = {
    google: { clientId: env.OAUTH_GOOGLE_CLIENT_ID, clientSecret: env.OAUTH_GOOGLE_CLIENT_SECRET, authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth', tokenUrl: 'https://oauth2.googleapis.com/token', userUrl: 'https://openidconnect.googleapis.com/v1/userinfo', scope: 'openid email profile' },
    github: { clientId: env.OAUTH_GITHUB_CLIENT_ID, clientSecret: env.OAUTH_GITHUB_CLIENT_SECRET, authorizeUrl: 'https://github.com/login/oauth/authorize', tokenUrl: 'https://github.com/login/oauth/access_token', userUrl: 'https://api.github.com/user', scope: 'read:user user:email' },
    discord: { clientId: env.OAUTH_DISCORD_CLIENT_ID, clientSecret: env.OAUTH_DISCORD_CLIENT_SECRET, authorizeUrl: 'https://discord.com/oauth2/authorize', tokenUrl: 'https://discord.com/api/oauth2/token', userUrl: 'https://discord.com/api/users/@me', scope: 'identify email' }
  };
  const config = values[provider];
  if (!config.clientId || !config.clientSecret) throw new AppError(503, 'OAUTH_NOT_CONFIGURED', `OAuth ${provider} todavía no está configurado en el backend.`);
  return config;
}

function safeProvider(value: string): OAuthProvider {
  if (value === 'google' || value === 'github' || value === 'discord') return value;
  throw new AppError(404, 'OAUTH_PROVIDER_NOT_FOUND', 'Proveedor OAuth no soportado.');
}

export async function startOAuth(providerInput: string, redirectUri: string): Promise<{ authorizeUrl: string; state: string }> {
  const provider = safeProvider(providerInput);
  const config = configFor(provider);
  if (redirectUri !== env.MOBILE_OAUTH_REDIRECT_URI) throw new AppError(400, 'REDIRECT_URI_NOT_ALLOWED', 'La URL de redirección no está permitida.');
  const state = randomToken(32);
  const verifier = randomToken(48);
  const params = new URLSearchParams({ client_id: config.clientId, redirect_uri: `${env.PUBLIC_BASE_URL}/api/auth/oauth/${provider}/callback`, response_type: 'code', scope: config.scope, state, code_challenge: pkceChallenge(verifier), code_challenge_method: 'S256' });
  if (provider === 'google') params.set('access_type', 'offline');
  await pool.execute('INSERT INTO oauth_states (state_hash, provider, redirect_uri, code_verifier, expires_at) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))', [sha256(state), provider, redirectUri, verifier]);
  return { authorizeUrl: `${config.authorizeUrl}?${params.toString()}`, state };
}

async function getJson(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok) throw new AppError(502, 'OAUTH_PROVIDER_ERROR', 'El proveedor OAuth rechazó la solicitud.');
  return await response.json() as Record<string, unknown>;
}

async function fetchProfile(provider: OAuthProvider, code: string, verifier: string): Promise<OAuthProfile> {
  const config = configFor(provider);
  const callback = `${env.PUBLIC_BASE_URL}/api/auth/oauth/${provider}/callback`;
  const body = new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, code, redirect_uri: callback, grant_type: 'authorization_code', code_verifier: verifier });
  const tokenResponse = await fetch(config.tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body });
  const tokens = await getJson(tokenResponse);
  const accessToken = String(tokens.access_token ?? '');
  if (!accessToken) throw new AppError(502, 'OAUTH_TOKEN_MISSING', 'El proveedor no devolvió un token válido.');
  const profileResponse = await fetch(config.userUrl, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json', 'User-Agent': 'TechFix/1.0' } });
  const profile = await getJson(profileResponse);
  if (provider === 'google') {
    return { providerUserId: String(profile.sub), email: String(profile.email ?? '').toLowerCase(), firstName: String(profile.given_name ?? 'Usuario'), lastName: String(profile.family_name ?? 'OAuth'), avatarUrl: typeof profile.picture === 'string' ? profile.picture : null, verified: profile.email_verified === true };
  }
  if (provider === 'discord') {
    return { providerUserId: String(profile.id), email: String(profile.email ?? '').toLowerCase(), firstName: String(profile.global_name ?? profile.username ?? 'Usuario'), lastName: 'Discord', avatarUrl: profile.avatar && profile.id ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png` : null, verified: profile.verified === true };
  }
  let email = typeof profile.email === 'string' ? profile.email.toLowerCase() : '';
  if (!email) {
    const emailsResponse = await fetch('https://api.github.com/user/emails', { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json', 'User-Agent': 'TechFix/1.0' } });
    const emails = await emailsResponse.json() as Array<{ email: string; primary: boolean; verified: boolean }>;
    const primary = emails.find((entry) => entry.primary && entry.verified) ?? emails.find((entry) => entry.verified);
    email = primary?.email.toLowerCase() ?? '';
  }
  const nameParts = String(profile.name ?? profile.login ?? 'Usuario').trim().split(/\s+/);
  return { providerUserId: String(profile.id), email, firstName: nameParts[0] || 'Usuario', lastName: nameParts.slice(1).join(' ') || 'GitHub', avatarUrl: typeof profile.avatar_url === 'string' ? profile.avatar_url : null, verified: Boolean(email) };
}

export async function handleCallback(providerInput: string, code: string, state: string): Promise<string> {
  const provider = safeProvider(providerInput);
  const [stateRows] = await pool.query<(RowDataPacket & { redirect_uri: string; code_verifier: string; expires_at: string })[]>('SELECT redirect_uri, code_verifier, expires_at FROM oauth_states WHERE state_hash = ? AND provider = ?', [sha256(state), provider]);
  const stateRow = stateRows[0];
  if (!stateRow || new Date(stateRow.expires_at).getTime() <= Date.now()) throw new AppError(400, 'OAUTH_STATE_INVALID', 'El estado OAuth expiró o no es válido.');
  const profile = await fetchProfile(provider, code, stateRow.code_verifier);
  if (!profile.email || !profile.verified) throw new AppError(403, 'OAUTH_EMAIL_UNVERIFIED', 'El proveedor no entregó un correo verificado.');
  const handoffCode = randomToken(32);
  const existingAccount = await pool.query<RowDataPacket[]>('SELECT user_id FROM oauth_accounts WHERE provider = ? AND provider_user_id = ?', [provider, profile.providerUserId]);
  let userId: number;
  if (existingAccount[0][0]) {
    userId = Number(existingAccount[0][0].user_id);
  } else {
    const existingUser = await findUserByEmail(profile.email);
    if (existingUser) {
      userId = existingUser.id;
    } else {
      userId = await withTransaction(async (connection) => {
        const [userResult] = await connection.execute<ResultSetHeader>('INSERT INTO users (first_name, last_name, email, avatar_url) VALUES (?, ?, ?, ?)', [profile.firstName, profile.lastName, profile.email, profile.avatarUrl]);
        await connection.execute('INSERT INTO user_roles (user_id, role_id) SELECT ?, id FROM roles WHERE slug = \'cliente\'', [userResult.insertId]);
        return Number(userResult.insertId);
      });
    }
    await pool.execute('INSERT INTO oauth_accounts (user_id, provider, provider_user_id, provider_email) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE provider_email = VALUES(provider_email)', [userId, provider, profile.providerUserId, profile.email]);
  }
  await pool.execute('DELETE FROM oauth_states WHERE state_hash = ?', [sha256(state)]);
  await pool.execute('INSERT INTO oauth_handoffs (code_hash, state_hash, user_id, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 2 MINUTE))', [sha256(handoffCode), sha256(state), userId]);
  const redirect = new URL(stateRow.redirect_uri);
  redirect.searchParams.set('code', handoffCode);
  redirect.searchParams.set('state', state);
  return redirect.toString();
}

export async function exchangeHandoff(code: string, state: string): Promise<{ user: AuthUser; accessToken: string; refreshToken: string }> {
  const codeHash = sha256(code);
  const stateHash = sha256(state);
  const result = await withTransaction(async (connection) => {
    const [rows] = await connection.query<(RowDataPacket & { id: number; user_id: number; expires_at: string; used_at: string | null })[]>('SELECT id, user_id, expires_at, used_at FROM oauth_handoffs WHERE code_hash = ? AND state_hash = ? FOR UPDATE', [codeHash, stateHash]);
    const row = rows[0];
    if (!row || row.used_at || new Date(row.expires_at).getTime() <= Date.now()) throw new AppError(401, 'OAUTH_HANDOFF_INVALID', 'El código OAuth no es válido o ya fue utilizado.');
    await connection.execute('UPDATE oauth_handoffs SET used_at = NOW() WHERE id = ?', [row.id]);
    return row.user_id;
  });
  const user = await findUserById(result);
  if (!user || !user.isActive) throw new AppError(401, 'ACCOUNT_DISABLED', 'La cuenta no está disponible.');
  const refresh = createRefreshToken();
  await pool.execute('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)', [user.id, refresh.hash, refresh.expiresAt]);
  return { user: toAuthUser(user), accessToken: signAccessToken(user.id), refreshToken: refresh.raw };
}

