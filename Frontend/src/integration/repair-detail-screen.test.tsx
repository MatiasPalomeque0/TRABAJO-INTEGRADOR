import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Repair } from '../types/api';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  getRepair: vi.fn(),
  getTechnicians: vi.fn(),
  useAuth: vi.fn()
}));

async function host(name: string) {
  const ReactModule = await import('react');
  return ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => ReactModule.createElement(name, props, children);
}

vi.mock('react-native', async () => ({
  Pressable: await host('Pressable'),
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: await host('Text'),
  View: await host('View')
}));

vi.mock('expo-router', async () => {
  const ReactModule = await import('react');
  return {
    router: { push: vi.fn() },
    useLocalSearchParams: () => ({ id: '2' }),
    useFocusEffect: (effect: () => void | (() => void)) => ReactModule.useEffect(effect, [effect])
  };
});

vi.mock('../components/Button', async () => ({ Button: await host('Button') }));
vi.mock('../components/Card', async () => ({ Card: await host('Card') }));
vi.mock('../components/ChoiceSelector', async () => ({ ChoiceSelector: await host('ChoiceSelector') }));
vi.mock('../components/Feedback', async () => ({
  EmptyState: await host('EmptyState'),
  ErrorMessage: await host('ErrorMessage'),
  Loading: await host('Loading')
}));
vi.mock('../components/Input', async () => ({ Input: await host('Input') }));
vi.mock('../components/Screen', async () => ({ Screen: await host('Screen') }));
vi.mock('../components/StatusBadge', async () => ({ StatusBadge: await host('StatusBadge') }));
vi.mock('../components/PresentialEstimateCard', async () => ({ PresentialEstimateCard: await host('PresentialEstimateCard') }));
vi.mock('../context/auth-context', () => ({ useAuth: mocks.useAuth }));
vi.mock('../theme/theme-context', () => ({ useTheme: () => ({ colors: { text: '#111', muted: '#666', primary: '#05c', danger: '#c00' } }) }));
vi.mock('../services/repairs', () => ({ repairApi: { get: mocks.getRepair } }));
vi.mock('../services/misc', () => ({ miscApi: { technicians: mocks.getTechnicians } }));
vi.mock('../utils/navigation-diagnostics', () => ({ navigationDiagnostic: vi.fn() }));

const deliveredRepair: Repair = {
  id: 2,
  deviceId: 2,
  deviceName: 'HP Pavilion 15',
  clientId: null,
  clientName: 'Juan Pérez',
  customerId: 2,
  customerName: 'Juan Pérez',
  createdBy: 1,
  technicianId: 2,
  technicianName: 'Técnico Asignado',
  problemDescription: 'No enciende.',
  status: 'entregado' as const,
  receivedAt: '2026-10-28 10:00:00',
  updatedAt: '2026-10-28 12:00:00',
  completedAt: '2026-10-28 11:30:00',
  diagnoses: [{ id: 1, description: 'Diagnóstico histórico.', recommendation: null, technicianName: 'Técnico Asignado', createdAt: '2026-10-28 10:10:00' }],
  estimates: [{ id: 2, repairRequestId: 2, createdBy: 2, status: 'aprobado' as const, notes: 'Presupuesto histórico.', laborCost: 20000, partsCost: 20000, total: 40000, createdAt: '2026-10-28 10:20:00', approvedAt: '2026-10-28 10:30:00', items: [] }],
  estimateDecisions: [{ id: 1, estimateId: 2, decision: 'aprobado' as const, decidedBy: 1, decidedByName: 'Administrador', channel: 'presencial' as const, observation: 'Aceptado.', decidedAt: '2026-10-28 10:30:00' }],
  workLogs: [{ id: 1, repairRequestId: 2, recordedBy: 2, recordedByName: 'Técnico Asignado', description: 'Trabajo histórico documentado.', createdAt: '2026-10-28 11:20:00' }],
  history: [{ id: 1, previousStatus: 'listo_para_retirar', newStatus: 'entregado' as const, observation: 'Entrega presencial.', createdAt: '2026-10-28 12:00:00', changedByName: 'Administrador' }],
  photos: [{ id: 1, mimeType: 'image/jpeg', description: 'Foto histórica.', createdAt: '2026-10-28 11:00:00', hasFile: true }],
  delivery: { id: 1, repairRequestId: 2, deliveredBy: 1, deliveredByName: 'Administrador', pickedUpByName: 'Juan Pérez', deliveredAt: '2026-10-28 12:00:00', observations: 'Entregado.', idempotencyKey: 'fixture', items: [] }
};

const activeTechnicians = [{ id: 2, email: 'tecnico@example.test', firstName: 'Técnico', lastName: 'Asignado', isActive: true, roles: ['tecnico' as const] }];

let RepairDetailScreen: React.ComponentType;

function collectRenderedText(node: unknown): string[] {
  if (node === null || node === undefined) return [];
  if (typeof node === 'string' || typeof node === 'number') return [String(node)];
  if (Array.isArray(node)) return node.flatMap(collectRenderedText);
  if (typeof node !== 'object') return [];
  const typedNode = node as { props?: { title?: unknown; children?: unknown }; children?: unknown };
  return [
    typeof typedNode.props?.title === 'string' ? typedNode.props.title : '',
    ...collectRenderedText(typedNode.props?.children ?? typedNode.children)
  ].filter(Boolean);
}

async function renderDetailFor(roles: 'admin' | 'tecnico' | 'recepcionista', repair: Repair = deliveredRepair): Promise<{ renderer: ReactTestRenderer; text: string }> {
  mocks.useAuth.mockReturnValue({ user: { id: roles === 'tecnico' ? 2 : 1, email: `${roles}@example.test`, firstName: roles, lastName: 'Test', isActive: true, roles: [roles] } });
  mocks.getRepair.mockResolvedValue(repair);
  mocks.getTechnicians.mockResolvedValue(activeTechnicians);
  let renderer: ReactTestRenderer | undefined;
  await act(async () => {
    renderer = create(React.createElement(RepairDetailScreen));
    await Promise.resolve();
    await Promise.resolve();
  });
  if (!renderer) throw new Error('No se pudo montar el detalle de reparación.');
  return { renderer, text: collectRenderedText(renderer.toJSON()).join(' ') };
}

describe('pantalla completa de detalle de orden entregada', () => {
  beforeAll(async () => {
    ({ default: RepairDetailScreen } = await import('../../app/(app)/repairs/[id]'));
  });

  it.each(['admin', 'tecnico', 'recepcionista'] as const)('es de solo lectura para %s', async (role) => {
    const { renderer, text } = await renderDetailFor(role);
    expect(text).toContain('Orden entregada y cerrada');
    expect(text).not.toContain('Registrar diagnóstico');
    expect(text).not.toContain('Guardar diagnóstico');
    expect(text).not.toContain('Preparar presupuesto');
    expect(text).not.toContain('Reasignar técnico');
    expect(text).not.toContain('Registrar trabajo');
    expect(text).not.toContain('Adjuntar fotografía');
    expect(text).toContain('Diagnóstico histórico.');
    expect(text).toContain('Presupuesto histórico.');
    expect(text).toContain('Trabajo histórico documentado.');
    expect(text).toContain('Constancia de entrega');
    await act(async () => { renderer.unmount(); });
  });

  it('conserva las acciones autorizadas cuando la orden sigue abierta', async () => {
    const openRepair: Repair = { ...deliveredRepair, status: 'en_diagnostico', completedAt: null, estimates: [], estimateDecisions: [], workLogs: [], photos: [], delivery: null };
    const { renderer, text } = await renderDetailFor('admin', openRepair);
    expect(text).toContain('Registrar diagnóstico');
    expect(text).toContain('Guardar diagnóstico');
    expect(text).toContain('Preparar presupuesto');
    expect(text).toContain('Reasignar técnico');
    expect(text).not.toContain('Orden entregada y cerrada');
    await act(async () => { renderer.unmount(); });
  });
});
