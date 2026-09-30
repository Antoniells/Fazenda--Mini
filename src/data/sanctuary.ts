/**
 * O SANTUÁRIO do andar 100 e o FIM da história (Fase 11 — "Os Três Pilares", `data/story.ts`). Vencida a Horda Final, o fundo das
 * Cavernas vira um santuário banhado de luz: a terra entrega a semente da Cenoura Dourada, um lago cristalino guarda o Peixe Dourado e,
 * no centro, o altar do Sábio Coelho. Plantada e colhida a Cenoura, com o Peixe na Bolsa, o altar exige o sacrifício final: o pet se
 * torna a Amizade Dourada, o Sábio Coelho desperta e a onda de luz varre as Cavernas (`scenes/FinalCinematicScene.ts`). Só DADOS: a regra
 * é `systems/sanctuary.ts`.
 *
 * Artes (todas do pacote): o altar é `Deep Forest/Altar.png` (6x3 quadros de 48x48 — a runa acende de 0 a 5; a 1ª linha é a com flores);
 * os braseiros são `Mine and Dungeon/Fire light.png` (9 quadros de 16x48: apagado, 6 de chama, apagado, sombra); os pedestais de cristal
 * são `Deep Forest/Stone structures Water.png` (16x20, 4 quadros de brilho por cor); o Sábio Coelho é o coelho branco de
 * `Animals/Forest/Rabbit/Rabbit Full White.png` (16x16, a 2ª linha é ele sentado de frente). Não há arte de cenoura dourada: a Cenoura
 * e a semente são a arte da cenoura do pacote em tom dourado (`GOLDEN_TINT`).
 */

export const GOLDEN_TINT = 0xffd65a;
/** Tom do santuário (o chão e as paredes da Caverna, clareados) e o de antes da luz (a cinemática parte dele). */
export const SANCTUARY_TINT = 0xfff0cc;
export const DARK_CAVE_TINT = 0x5a5470;

/** Quanto a Cenoura Dourada leva pra crescer no altar (minutos do relógio do jogo: 4 h ≈ 2 min reais). */
export const GOLDEN_CARROT_GROW_MINUTES = 240;

/** Vai pro save: quando (minuto do relógio, `(dia-1)*1440 + minutos`) a semente foi plantada no altar; `null` = não plantada. */
export interface SanctuaryState {
  plantedAt: number | null;
}

export function createSanctuaryState(): SanctuaryState {
  return { plantedAt: null };
}

// --- Layout (o andar 100 sem paredes internas — `generateSanctuaryFloor`) --------------------------------------------------------

export const SANCTUARY_LAYOUT = {
  /** O altar: 3x3 células com a base em `cell` (centro do salão); a fileira de baixo e a do meio são sólidas. */
  altar: { col: 17, row: 11 },
  /** Braseiros acesos em volta do altar. */
  braziers: [
    { col: 13, row: 9 },
    { col: 21, row: 9 },
    { col: 13, row: 14 },
    { col: 21, row: 14 },
  ],
  /** O lago cristalino (à direita) e os pedestais de cristal nos cantos dele. */
  lake: { col0: 25, row0: 9, cols: 6, rows: 4 },
  crystals: [
    { col: 24, row: 8, color: 'pink' as const },
    { col: 31, row: 8, color: 'blue' as const },
    { col: 24, row: 13, color: 'blue' as const },
    { col: 31, row: 13, color: 'pink' as const },
  ],
};

// --- Arte ------------------------------------------------------------------------------------------------------------------------

export const ALTAR_ART = { key: 'sage-altar', path: 'Objects/Exterior/Deep Forest/Altar.png', frameSize: 48, dormantFrame: 0, awakeFrames: [0, 1, 2, 3, 4, 5] };
export const BRAZIER_ART = { key: 'sanctuary-brazier', path: 'Objects/Exterior/Mine and Dungeon/Fire light.png', frameWidth: 16, frameHeight: 48, flameFrames: [1, 2, 3, 4, 5, 6] };
export const CRYSTAL_ART = {
  key: 'sanctuary-crystals',
  path: 'Objects/Exterior/Deep Forest/Stone structures Water.png',
  frame: (color: 'pink' | 'blue', index: number) => ({ name: `crystal-${color}-${index}`, rect: { x: (color === 'pink' ? 0 : 64) + index * 16, y: 12, width: 16, height: 20 } }),
};
export const SAGE_RABBIT = { key: 'sage-rabbit', path: 'Animals/Forest/Rabbit/Rabbit Full White.png', frameSize: 16, sitFrames: [4, 5, 6, 7], scale: 3 };

// --- Falas ---------------------------------------------------------------------------------------------------------------------

export const ALTAR_NAME = 'Altar do Sábio Coelho';

export const SANCTUARY_LINES = {
  revealed: 'As trevas se desfazem. O fundo das Cavernas vira um santuário banhado por uma luz divina, e a própria terra lhe entrega uma semente dourada.',
  plant: 'A terra do altar é macia e morna, como se esperasse por algo há séculos.',
  growing: 'A semente dourada brota sob a luz do santuário. Ainda não está pronta.',
  ripe: 'Uma Cenoura Dourada reluz no altar, pronta para ser colhida.',
  needFish: 'A estátua espera. Falta o Peixe Dourado, que vive nas águas místicas do lago.',
  needCarrot: 'A estátua espera. Falta a Cenoura Dourada, colhida da terra do altar.',
  offer: 'Com a Cenoura Dourada e o Peixe Dourado nas mãos, você sente o peso da profecia.',
  awakened: 'O Sábio Coelho descansa em paz. O mundo está em equilíbrio.',
};

/** O sacrifício (páginas da conversa antes do pet ir ao altar). `{pet}` vira o nome do pet. */
export const SACRIFICE_PAGES = [
  'Você coloca a Cenoura Dourada e o Peixe Dourado sobre o altar. A estátua do Sábio Coelho estremece... mas não desperta.',
  'O último pilar nunca foi um objeto que pudesse ser encontrado, comprado ou minerado.',
  '{pet}, que recebeu o seu cuidado desde o primeiro amanhecer, se aproxima do altar. Parece entender o peso do destino.',
];

// --- Fim --------------------------------------------------------------------------------------------------------------------------

/** Legendas da cinemática da onda de luz (uma por trecho da subida). */
export const CINEMATIC_CAPTIONS = [
  'Os Três Pilares se reúnem no altar.',
  'O poder do Sábio Coelho desperta.',
  'Uma onda de luz purificadora sobe pelas Cavernas...',
  '...e as criaturas das trevas se desfazem no ar.',
  'O equilíbrio volta à natureza, para todo o sempre.',
];

/** Epílogo (`scenes/EndingScene.ts`). `{pet}` vira o nome do pet; `{nome}`, o do jogador. */
export const ENDING_PAGES = [
  'A vida colhida da terra, a vida resgatada das águas e o sacrifício nascido do mais puro amor: com os Três Pilares reunidos, a oferenda se completou.',
  'O Sábio Coelho despertou, e a luz varreu as Cavernas de baixo para cima, desfazendo as criaturas das trevas por onde passava.',
  '{pet} não voltou para casa. Mas em cada amanhecer, na luz que banha a terra, vive um pouco da Amizade Dourada que salvou o mundo.',
];

export const CREDITS: Array<{ title: string; lines: string[] }> = [
  { title: 'Mini Fazenda', lines: ['Os Três Pilares do Equilíbrio'] },
  { title: 'Criação', lines: ['Antoniells'] },
  { title: 'Arte', lines: ['EmanuelleDev', 'emanuelledev.itch.io'] },
  { title: 'O Mago', lines: ['pinogames', 'pinogames.itch.io'] },
  { title: 'Feito com', lines: ['Phaser, TypeScript e Vite'] },
  { title: '', lines: ['Obrigado por jogar!'] },
];

/** A carta que chega com o filhote, depois do fim (`systems/petEvent.ts`). */
export const NEW_PET_LETTER = {
  title: 'Um novo começo',
  body:
    'Oi, {nome},\n\n' +
    'Soubemos de tudo o que aconteceu nas Cavernas, e de quem ficou por lá para que o mundo voltasse a ter paz. Nada substitui um amigo assim.\n\n' +
    'Mas este filhotinho apareceu sozinho na porteira do Vilarejo, e todos concordamos: o lugar dele é com você. Cuide bem dele.',
};
