import { apiRequest } from './api';
import type { Service } from '../types/api';
export const serviceApi = { list: () => apiRequest<Service[]>('/services') };

