import type { ToolId } from './tools';
import { TOOL_PROGRESSION } from './toolProgression';
import { COPPER_BAR, IRON, GOLD_BAR } from './resources';

/**
 * As FERRAMENTAS de progressão (Machado e Picareta de Cobre/Ferro/Ouro) se compram direto no Ferreiro (`systems/vendorShops.ts`): além das moedas, cada uma exige
 * `TOOL_BARS_REQUIRED` barras do metal dela (feitas na Fornalha, `data/smelting.ts`, a partir do minério da Pedreira). A progressão continua linear (`data/toolProgression.ts`):
 * só se compra o tier seguinte a quem tem o anterior, e a ferramenta nova SUBSTITUI a antiga no mesmo slot (`Inventory.upgradeTool`).
 */
export const TOOL_BARS_REQUIRED = 5;

export interface ToolOffer {
  toolId: ToolId;
  /** Moedas cobradas (além das barras). */
  price: number;
  /** A barra exigida (`data/resources.ts`) e quantas. */
  barId: string;
  barAmount: number;
}

/** Um por tier (1 = Cobre, 2 = Ferro, 3 = Ouro; a Madeira é a inicial): preço em moedas (o mesmo das antigas receitas) e o metal. */
const TIERS: Array<{ tier: number; price: number; barId: string }> = [
  { tier: 1, price: 200, barId: COPPER_BAR.id },
  { tier: 2, price: 500, barId: IRON.id },
  { tier: 3, price: 1200, barId: GOLD_BAR.id },
];

/** As 6 ofertas (agrupadas por tier: Machado e Picareta de cada metal, do mais barato ao mais caro). */
export const TOOL_OFFERS: ToolOffer[] = TIERS.flatMap(({ tier, price, barId }) =>
  (['axe', 'pickaxe'] as const).map((family): ToolOffer => ({ toolId: TOOL_PROGRESSION[family][tier], price, barId, barAmount: TOOL_BARS_REQUIRED })),
);

export function getToolOffer(toolId: string): ToolOffer | undefined {
  return TOOL_OFFERS.find((offer) => offer.toolId === toolId);
}
