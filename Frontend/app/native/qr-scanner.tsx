import { useState } from 'react';
import { Button } from '../../src/components/Button';
import { ErrorMessage, Loading } from '../../src/components/Feedback';
import { Screen } from '../../src/components/Screen';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { repairApi } from '../../src/services/repairs';
import { useTheme } from '../../src/theme/theme-context';
export default function QRScannerScreen() { const { colors } = useTheme(); const [permission, requestPermission] = useCameraPermissions(); const [scanned, setScanned] = useState(false); const [error, setError] = useState<string>(); if (!permission) return <Loading />; if (!permission.granted) return <Screen><Text style={[styles.title, { color: colors.text }]}>Lector QR</Text><Text style={{ color: colors.muted }}>La cámara se usa solo para leer una orden que ya tenés permitido consultar.</Text><Button title="Permitir cámara" onPress={requestPermission} /><Button title="Volver" variant="ghost" onPress={() => router.back()} /></Screen>; const scan = async ({ data }: { data: string }) => { if (scanned) return; setScanned(true); try { const url = new URL(data); if (url.protocol !== 'techfix:') throw new Error('QR no reconocido.'); const kind = url.hostname; const id = Number(url.pathname.replace('/', '')); if (!id || kind !== 'repair') throw new Error('QR no reconocido.'); await repairApi.get(id); router.replace(`/(app)/repairs/${id}`); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo abrir la orden. El QR no concede permisos.'); setScanned(false); } }; return <Screen padded={false}><View style={styles.cameraBox}><CameraView style={StyleSheet.absoluteFill} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={scanned ? undefined : scan} /></View>{error ? <ErrorMessage message={error} /> : null}<Text style={{ color: colors.muted, padding: 20, textAlign: 'center' }}>Apuntá a un QR de TechFix, por ejemplo `techfix://repair/123`. El backend verifica tu autorización.</Text><Button title="Volver" variant="ghost" onPress={() => router.back()} /></Screen>; }
const styles = StyleSheet.create({ title: { fontSize: 28, fontWeight: '900' }, cameraBox: { height: 480, overflow: 'hidden', backgroundColor: '#000' } });

