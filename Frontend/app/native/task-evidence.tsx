import { useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, type CameraView as CameraViewType } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '../../src/components/Button';
import { ErrorMessage, Loading } from '../../src/components/Feedback';
import { Screen } from '../../src/components/Screen';
import { taskApi } from '../../src/services/tasks';
import { useTheme } from '../../src/theme/theme-context';

export default function TaskEvidenceScreen() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [photo, setPhoto] = useState<string>();
  const [withLocation, setWithLocation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const camera = useRef<CameraViewType>(null);

  if (!permission) return <Loading />;
  if (!permission.granted) return <Screen><Text style={[styles.title, { color: colors.text }]}>Evidencia</Text><Text style={{ color: colors.muted }}>La cámara permite adjuntar una foto como evidencia de esta tarea.</Text><Button title="Permitir cámara" onPress={requestPermission} /></Screen>;

  const takePhoto = async () => {
    const result = await camera.current?.takePictureAsync({ quality: 0.7 });
    if (result?.uri) setPhoto(result.uri);
  };

  const save = async () => {
    if (!photo) return;
    setBusy(true);
    try {
      let coords: { latitude: number; longitude: number } | undefined;
      if (withLocation) {
        const locationPermission = await Location.requestForegroundPermissionsAsync();
        if (locationPermission.status !== 'granted') {
          Alert.alert('Ubicación no disponible', 'La evidencia se guardará sin ubicación.');
        } else {
          const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          coords = current.coords;
        }
      }
      const fileData = await FileSystem.readAsStringAsync(photo, { encoding: FileSystem.EncodingType.Base64 });
      await taskApi.evidence(Number(taskId), { fileData, mimeType: 'image/jpeg', latitude: coords?.latitude, longitude: coords?.longitude, note: 'Evidencia capturada desde la aplicación' });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la evidencia.');
    } finally {
      setBusy(false);
    }
  };

  return <Screen padded={false}><View style={styles.cameraBox}>{photo ? <Text style={[styles.preview, { color: colors.text }]}>Foto capturada y lista para guardar.</Text> : <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" />}</View>{error ? <ErrorMessage message={error} /> : null}<Text onPress={() => setWithLocation((value) => !value)} style={[styles.location, { color: colors.primary }]}>{withLocation ? '✓ Asociar ubicación actual' : '＋ Asociar ubicación actual'}</Text><Button title={photo ? 'Guardar evidencia' : 'Tomar fotografía'} loading={busy} onPress={photo ? save : takePhoto} /><Button title="Cancelar" variant="ghost" onPress={() => router.back()} /></Screen>;
}

const styles = StyleSheet.create({ title: { fontSize: 28, fontWeight: '900' }, cameraBox: { height: 440, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, preview: { padding: 20 }, location: { padding: 18, textAlign: 'center', fontWeight: '800' } });

