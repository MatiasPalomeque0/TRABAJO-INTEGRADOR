import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Card } from '../../src/components/Card';
import { ErrorMessage, Loading } from '../../src/components/Feedback';
import { Screen } from '../../src/components/Screen';
import { miscApi } from '../../src/services/misc';
import { useTheme } from '../../src/theme/theme-context';
import type { Stats } from '../../src/types/api';
export default function StatsScreen() { const { colors } = useTheme(); const [stats, setStats] = useState<Stats>(); const [error, setError] = useState<string>(); useEffect(() => { miscApi.stats().then(setStats).catch((e) => setError(e instanceof Error ? e.message : 'No se pudieron cargar las estadísticas.')); }, []); if (!stats && !error) return <Loading />; return <Screen><Text style={[styles.title, { color: colors.text }]}>Estadísticas</Text>{error ? <ErrorMessage message={error} /> : <><Card><Text style={{ color: colors.muted }}>Reparaciones</Text><Text style={[styles.value, { color: colors.primary }]}>{stats?.repairs}</Text><Text style={{ color: colors.muted }}>{stats?.completedRepairs} finalizadas</Text></Card><Card><Text style={{ color: colors.muted }}>Presupuestos pendientes</Text><Text style={[styles.value, { color: colors.warning }]}>{stats?.pendingEstimates}</Text><Text style={{ color: colors.muted }}>{stats?.readyForPickup} listos para retirar</Text></Card><Card><Text style={{ color: colors.muted }}>Equipos registrados</Text><Text style={[styles.value, { color: colors.primary }]}>{stats?.devices}</Text></Card></>}</Screen>; }
const styles = StyleSheet.create({ title: { fontSize: 28, fontWeight: '900' }, value: { fontSize: 40, fontWeight: '900' } });

