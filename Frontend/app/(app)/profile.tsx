import { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { useAuth } from '../../src/context/auth-context';
import { useTheme } from '../../src/theme/theme-context';
import { setBiometricUnlocked } from '../../src/services/storage';
export default function ProfileScreen() { const { colors } = useTheme(); const { user, logout } = useAuth(); const [busy, setBusy] = useState(false); const enableBiometrics = async () => { setBusy(true); try { const hardware = await LocalAuthentication.hasHardwareAsync(); const enrolled = await LocalAuthentication.isEnrolledAsync(); if (!hardware || !enrolled) { Alert.alert('Biometría no disponible', 'Este dispositivo no tiene un método biométrico configurado.'); return; } const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Confirmá para proteger tu sesión local' }); if (result.success) { await setBiometricUnlocked(true); Alert.alert('Listo', 'La biometría quedó habilitada para desbloquear la sesión local.'); } } finally { setBusy(false); } }; return <Screen><Text style={[styles.title, { color: colors.text }]}>Mi perfil</Text><Card><Text style={[styles.name, { color: colors.text }]}>{user?.firstName} {user?.lastName}</Text><Text style={{ color: colors.muted }}>{user?.email}</Text><Text style={{ color: colors.primary, fontWeight: '800' }}>{user?.roles.join(' · ')}</Text></Card><Button title="Proteger sesión con biometría" loading={busy} variant="secondary" onPress={enableBiometrics} /><Button title="Ver notificaciones" variant="secondary" onPress={() => router.push('/(app)/notifications')} /><Button title="Cerrar sesión" variant="danger" onPress={logout} /></Screen>; }
const styles = StyleSheet.create({ title: { fontSize: 28, fontWeight: '900' }, name: { fontSize: 22, fontWeight: '900' } });

