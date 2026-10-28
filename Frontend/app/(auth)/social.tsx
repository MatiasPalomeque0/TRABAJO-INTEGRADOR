import { router } from 'expo-router';
import { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { Button } from '../../src/components/Button';
import { ErrorMessage } from '../../src/components/Feedback';
import { Screen } from '../../src/components/Screen';
import { useAuth } from '../../src/context/auth-context';
import { useTheme } from '../../src/theme/theme-context';
export default function SocialScreen() { const { colors } = useTheme(); const { socialLogin, isSubmitting } = useAuth(); const [error, setError] = useState<string>(); const login = async (provider: 'google' | 'github' | 'discord') => { setError(undefined); try { await socialLogin(provider); router.replace('/(app)'); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo completar OAuth.'); } }; return <Screen><Text style={[styles.title, { color: colors.text }]}>Iniciar sesión social</Text><Text style={{ color: colors.muted }}>El proveedor verifica tu identidad. Los secretos permanecen en el backend.</Text>{error ? <ErrorMessage message={error} /> : null}<Button title="Continuar con Google" loading={isSubmitting} onPress={() => login('google')} /><Button title="Continuar con GitHub" variant="secondary" loading={isSubmitting} onPress={() => login('github')} /><Button title="Continuar con Discord" variant="secondary" loading={isSubmitting} onPress={() => login('discord')} /><Button title="Volver" variant="ghost" onPress={() => router.back()} /></Screen>; }
const styles = StyleSheet.create({ title: { fontSize: 28, fontWeight: '900', marginTop: 20 } });

