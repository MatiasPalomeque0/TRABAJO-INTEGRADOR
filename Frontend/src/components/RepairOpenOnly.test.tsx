import { act, create } from 'react-test-renderer';
import { describe, expect, it } from 'vitest';
import { RepairOpenOnly } from './RepairOpenOnly';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('renderizado de acciones de una reparación', () => {
  it('no renderiza acciones operativas cuando el estado es entregado', () => {
    let renderer: ReturnType<typeof create> | undefined;
    act(() => {
      renderer = create(
        <RepairOpenOnly status="entregado">
          <>
            <button>Reasignar técnico</button>
            <button>Guardar diagnóstico</button>
            <button>Preparar presupuesto</button>
            <button>Registrar trabajo</button>
            <button>Adjuntar fotografía</button>
            <button>Aprobar</button>
            <button>Registrar entrega</button>
          </>
        </RepairOpenOnly>
      );
    });

    expect(renderer?.toJSON()).toBeNull();
  });

  it('renderiza las acciones cuando la reparación sigue abierta', () => {
    let renderer: ReturnType<typeof create> | undefined;
    act(() => {
      renderer = create(
        <RepairOpenOnly status="en_diagnostico">
          <button>Guardar diagnóstico</button>
        </RepairOpenOnly>
      );
    });

    expect(renderer?.toJSON()).toEqual({ type: 'button', props: {}, children: ['Guardar diagnóstico'] });
  });
});
