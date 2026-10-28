import { useEffect, useState } from 'react';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { useTheme } from '../../src/theme/theme-context';
type Reading = { x: number; y: number; z: number };
export default function SensorDemoScreen() { const { colors } = useTheme(); const [accelerometer, setAccelerometer] = useState<Reading>({ x: 0, y: 0, z: 0 }); const [gyroscope, setGyroscope] = useState<Reading>({ x: 0, y: 0, z: 0 }); const [available, setAvailable] = useState(true); useEffect(() => { let a: ReturnType<typeof Accelerometer.addListener> | undefined; let g: ReturnType<typeof Gyroscope.addListener> | undefined; (async () => { const [hasA, hasG] = await Promise.all([Accelerometer.isAvailableAsync(), Gyroscope.isAvailableAsync()]); setAvailable(hasA || hasG); if (hasA) { Accelerometer.setUpdateInterval(250); a = Accelerometer.addListener(setAccelerometer); } if (hasG) { Gyroscope.setUpdateInterval(250); g = Gyroscope.addListener(setGyroscope); } })(); return () => { a?.remove(); g?.remove(); }; }, []); return <Screen><Text style={[styles.title, { color: colors.text }]}>Sensores del dispositivo</Text><Text style={{ color: colors.muted }}>Lecturas reales. El acelerómetro mide aceleración lineal; el giroscopio mide velocidad angular. No se envían al backend.</Text>{!available ? <Card><Text style={{ color: colors.muted }}>Este dispositivo no expone estos sensores.</Text></Card> : <><Card><Text style={[styles.section, { color: colors.text }]}>Acelerómetro</Text><Text style={{ color: colors.text }}>x {accelerometer.x.toFixed(3)} · y {accelerometer.y.toFixed(3)} · z {accelerometer.z.toFixed(3)}</Text></Card><Card><Text style={[styles.section, { color: colors.text }]}>Giroscopio</Text><Text style={{ color: colors.text }}>x {gyroscope.x.toFixed(3)} · y {gyroscope.y.toFixed(3)} · z {gyroscope.z.toFixed(3)}</Text></Card></>}<Button title="Volver" variant="ghost" onPress={() => router.back()} /></Screen>; }
const styles = StyleSheet.create({ title: { fontSize: 28, fontWeight: '900' }, section: { fontSize: 18, fontWeight: '800' } });

