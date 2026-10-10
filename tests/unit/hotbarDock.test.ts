import { describe, expect, it } from 'vitest';
import { HOTBAR_DOCK_RETURN_MARGIN_PX, HOTBAR_DOCK_TOP_ZONE_PX, shouldDockHotbarTop } from '../../src/ui/hotbarDock';

describe('Hotbar no topo quando o personagem está embaixo', () => {
  const barTop = 624;
  const threshold = barTop - HOTBAR_DOCK_TOP_ZONE_PX;

  it('sobe quando o personagem entra na faixa de baixo e fica embaixo no resto da tela (ou sem personagem)', () => {
    expect(shouldDockHotbarTop(false, 300, barTop)).toBe(false);
    expect(shouldDockHotbarTop(false, threshold, barTop)).toBe(false);
    expect(shouldDockHotbarTop(false, threshold + 1, barTop)).toBe(true);
    expect(shouldDockHotbarTop(false, null, barTop)).toBe(false);
    expect(shouldDockHotbarTop(true, null, barTop)).toBe(false);
  });

  it('só desce de volta com uma folga acima da divisa (não fica pulando na divisa)', () => {
    expect(shouldDockHotbarTop(true, threshold - 1, barTop)).toBe(true);
    expect(shouldDockHotbarTop(true, threshold - HOTBAR_DOCK_RETURN_MARGIN_PX + 1, barTop)).toBe(true);
    expect(shouldDockHotbarTop(true, threshold - HOTBAR_DOCK_RETURN_MARGIN_PX, barTop)).toBe(false);
  });
});
