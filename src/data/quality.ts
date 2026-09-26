import { ALL_CROPS_ICONS_KEY } from './crops';

/**
 * Qualidade dos itens (estrelas): Prata, Ouro e Irídio, do pior ao melhor — hoje só os ovos (`data/animals.ts` `EGG_TIERS`), depois as colheitas.
 * Cada qualidade é um item À PARTE no estoque, com o id do item + `@` + a qualidade (`egg@silver`); sem sufixo é a qualidade comum. Assim
 * `Inventory`, Hotbar, Caixa de Remessas e save não precisam saber de qualidade: ela só aparece no NOME ("Ovo (Prata)"), no ÍCONE (a estrela no canto —
 * `systems/qualityIcons.ts`) e no PREÇO (`QUALITY_SELL_MULTIPLIER`).
 */
export type Quality = 'normal' | 'silver' | 'gold' | 'iridium';

/** As qualidades COM estrela, em ordem crescente. */
export const STAR_QUALITIES = ['silver', 'gold', 'iridium'] as const;
export type StarQuality = (typeof STAR_QUALITIES)[number];

export const QUALITY_LABEL: Record<StarQuality, string> = { silver: 'Prata', gold: 'Ouro', iridium: 'Irídio' };

/** Quanto a qualidade multiplica o preço de venda do item comum. */
export const QUALITY_SELL_MULTIPLIER: Record<Quality, number> = { normal: 1, silver: 1.25, gold: 1.5, iridium: 2 };

/**
 * As 3 estrelas soltas de `Crops/All Crops.png` (a mesma folha das colheitas, já carregada como `ALL_CROPS_ICONS_KEY`), na ordem Prata, Ouro e Irídio — 7x6 px cada,
 * limites medidos pelo canal alfa. `QUALITY_STAR_SHEET_KEY` é a textura de onde elas saem.
 */
export const QUALITY_STAR_SHEET_KEY = ALL_CROPS_ICONS_KEY;
export const QUALITY_STAR_RECTS: Record<StarQuality, { x: number; y: number; width: number; height: number }> = {
  silver: { x: 345, y: 122, width: 7, height: 6 },
  gold: { x: 361, y: 122, width: 7, height: 6 },
  iridium: { x: 377, y: 122, width: 7, height: 6 },
};

const SEPARATOR = '@';

/** O id do item na qualidade dada (`normal` = o próprio id). */
export function qualityId(baseId: string, quality: Quality): string {
  return quality === 'normal' ? baseId : `${baseId}${SEPARATOR}${quality}`;
}

/** Separa um id de estoque em item-base e qualidade (sem sufixo válido = qualidade comum). */
export function parseQualityId(id: string): { baseId: string; quality: Quality } {
  const at = id.lastIndexOf(SEPARATOR);
  if (at > 0) {
    const suffix = id.slice(at + 1);
    if ((STAR_QUALITIES as readonly string[]).includes(suffix)) return { baseId: id.slice(0, at), quality: suffix as StarQuality };
  }
  return { baseId: id, quality: 'normal' };
}

/** Preço de venda de UMA unidade na qualidade dada. */
export function priceForQuality(basePrice: number, quality: Quality): number {
  return Math.round(basePrice * QUALITY_SELL_MULTIPLIER[quality]);
}

/** Nome mostrado: "Ovo" ou "Ovo (Prata)". */
export function nameWithQuality(baseName: string, quality: Quality): string {
  return quality === 'normal' ? baseName : `${baseName} (${QUALITY_LABEL[quality]})`;
}

/**
 * Ids que os ovos de qualidade tinham antes das estrelas (cada nível era um recurso próprio: Ovo Bom/Ótimo/Perfeito): o save antigo é convertido ao carregar
 * (`Inventory.deserialize`) — Bom→Prata, Ótimo→Ouro, Perfeito→Irídio.
 */
export const LEGACY_QUALITY_IDS: Record<string, string> = {
  'egg-good': qualityId('egg', 'silver'),
  'egg-great': qualityId('egg', 'gold'),
  'egg-perfect': qualityId('egg', 'iridium'),
};
