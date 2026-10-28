import { Linking, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { useTheme } from '../../src/theme/theme-context';

const localAddress = 'TechFix · Av. Siempre Viva 742, Buenos Aires';
const mapsUrl = 'https://www.google.com/maps/search/?api=1&query=Av.+Siempre+Viva+742,+Buenos+Aires';

export default function LocalLocationScreen() {
  const { colors } = useTheme();
  const openMaps = async () => { if (await Linking.canOpenURL(mapsUrl)) await Linking.openURL(mapsUrl); };
  return <Screen><Text style={[styles.title, { color: colors.text }]}>Ubicación del local</Text><Text style={{ color: colors.muted }}>Consultá la dirección de TechFix y abrí indicaciones en la aplicación de mapas del dispositivo.</Text><Text style={[styles.address, { color: colors.text }]}>{localAddress}</Text><Button title="Abrir indicaciones" onPress={openMaps} /><Button title="Volver" variant="ghost" onPress={() => router.back()} /></Screen>;
}

const styles = StyleSheet.create({ title: { fontSize: 28, fontWeight: '900' }, address: { fontSize: 18, fontWeight: '800', marginVertical: 24 } });
