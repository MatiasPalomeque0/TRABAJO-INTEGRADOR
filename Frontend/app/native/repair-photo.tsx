import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, type CameraView as CameraViewType } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '../../src/components/Button';
import { ErrorMessage, Loading } from '../../src/components/Feedback';
import { Screen } from '../../src/components/Screen';
import { repairApi } from '../../src/services/repairs';
import { useTheme } from '../../src/theme/theme-context';

export default function RepairPhotoScreen() {
  const { repairId } = useLocalSearchParams<{ repairId: string }>();
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [photo, setPhoto] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const camera = useRef<CameraViewType>(null);

  if (!permission) return <Loading />;
  if (!permission.granted) return <Screen><Text style={[styles.title, { color: colors.text }]}>Foto del equipo</Text><Text style={{ color: colors.muted }}>La cámara permite documentar el estado del equipo durante el diagnóstico.</Text><Button title="Permitir cámara" onPress={requestPermission} /><Button title="Cancelar" variant="ghost" onPress={() => router.back()} /></Screen>;

  const takePhoto = async () => { const result = await camera.current?.takePictureAsync({ quality: 0.7 }); if (result?.uri) setPhoto(result.uri); };
  const save = async () => { if (!photo) return; setBusy(true); try { const fileData = await FileSystem.readAsStringAsync(photo, { encoding: FileSystem.EncodingType.Base64 }); await repairApi.photo(Number(repairId), { fileData, mimeType: 'image/jpeg', description: 'Fotografía capturada durante el diagnóstico.' }); router.back(); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar la fotografía.'); } finally { setBusy(false); } };

  return <Screen padded={false}><View style={styles.cameraBox}>{photo ? <Text style={[styles.preview, { color: colors.text }]}>Foto capturada y lista para guardar.</Text> : <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" />}</View>{error ? <ErrorMessage message={error} /> : null}<Button title={photo ? 'Guardar fotografía' : 'Tomar fotografía'} loading={busy} onPress={photo ? save : takePhoto} /><Button title="Cancelar" variant="ghost" onPress={() => router.back()} /></Screen>;
}

const styles = StyleSheet.create({ title: { fontSize: 28, fontWeight: '900' }, cameraBox: { height: 440, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, preview: { padding: 20 } });
