import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Card } from '../../src/components/Card';
import { EmptyState, ErrorMessage, Loading } from '../../src/components/Feedback';
import { Screen } from '../../src/components/Screen';
import { miscApi } from '../../src/services/misc';
import { useTheme } from '../../src/theme/theme-context';
import type { Notification } from '../../src/types/api';
export default function NotificationsScreen() { const { colors } = useTheme(); const [items, setItems] = useState<Notification[]>(); const [error, setError] = useState<string>(); const load = useCallback(async () => { try { setItems(await miscApi.notifications()); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron cargar las notificaciones.'); } }, []); useEffect(() => { load(); }, [load]); if (!items && !error) return <Loading />; return <Screen><Text style={[styles.title, { color: colors.text }]}>Notificaciones</Text>{error ? <ErrorMessage message={error} /> : items?.length === 0 ? <EmptyState title="Todo al día" description="No tenés notificaciones nuevas." /> : items?.map((item) => <Pressable key={item.id} onPress={() => miscApi.markNotificationRead(item.id).then(load)}><Card><Text style={[styles.itemTitle, { color: colors.text }]}>{item.title}</Text><Text style={{ color: colors.muted }}>{item.body}</Text><Text style={{ color: item.readAt ? colors.muted : colors.primary, fontSize: 12 }}>{item.readAt ? 'Leída' : 'Nueva'}</Text></Card></Pressable>)}</Screen>; }
const styles = StyleSheet.create({ title: { fontSize: 28, fontWeight: '900' }, itemTitle: { fontSize: 17, fontWeight: '800' } });

