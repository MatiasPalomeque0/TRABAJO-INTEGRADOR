import type { DeviceType } from '../types/api';

export const DEVICE_TYPE_OPTIONS: readonly { value: DeviceType; label: string }[] = [
  { value: 'notebook', label: 'Notebook' },
  { value: 'desktop', label: 'Computadora de escritorio' },
  { value: 'all_in_one', label: 'All-in-one' },
  { value: 'impresora', label: 'Impresora' },
  { value: 'otro', label: 'Otro dispositivo' }
];
