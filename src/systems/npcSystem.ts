import Phaser from 'phaser';
import { Npc, NpcPost } from '../entities/Npc';
import { Player } from '../entities/Player';
import { NPCS, NpcDefinition, NpcId, NpcPlace } from '../data/npcs';
import { gameState } from './gameState';
import { isCarpenterBusy } from './construction';
import { WalkableGrid } from './grid';
import { PlayerController } from './playerController';
import { findPath, GridPoint } from './pathfinding';
import { isDialogueOpen } from '../scenes/UIScene';
import { talkToNpc, NpcTalkContext } from './npcDialogue';
import { playEffect } from './soundEffects';
import { DOOR_SOUND } from '../data/audio';

/** Carrega as folhas de sprite (repouso e, se andam, caminhada) e os retratos dos moradores da cena — chamado no `preload` dela. */
export function preloadNpcs(scene: Phaser.Scene, ids: NpcId[]): void {
  for (const id of ids) {
    const { sprite, portrait } = NPCS[id];
    scene.load.spritesheet(sprite.idleKey, encodeURI(`/${sprite.idlePath}`), { frameWidth: sprite.frameSize, frameHeight: sprite.frameSize });
    if (sprite.walkKey && sprite.walkPath) scene.load.spritesheet(sprite.walkKey, encodeURI(`/${sprite.walkPath}`), { frameWidth: sprite.frameSize, frameHeight: sprite.frameSize });
    scene.load.image(portrait.key, encodeURI(`/${portrait.path}`));
  }
}

/** Texto do expediente de um vendedor ("07:00–12:00 e 13:00–18:00"), lido das entradas `working` da rotina dele. */
export function workingHoursText(def: NpcDefinition): string {
  const spans: string[] = [];
  const fmt = (hour: number): string => `${String(Math.floor(hour)).padStart(2, '0')}:00`;
  def.schedule.forEach((entry, index) => {
    if (!entry.working) return;
    const end = def.schedule[(index + 1) % def.schedule.length].fromHour;
    spans.push(`${fmt(entry.fromHour)}–${fmt(end)}`);
  });
  return spans.length > 0 ? `Atende das ${spans.join(' e das ')}.` : '';
}

/** O vendedor está em EXPEDIENTE agora (o trecho atual da rotina tem `working`)? Na chuva, quem estaria na rua fica em casa e não atende. Função pura. */
export function isWorkingNow(def: NpcDefinition, hours: number, raining: boolean): boolean {
  let entry = def.schedule[0];
  for (const candidate of def.schedule) if (hours >= candidate.fromHour) entry = candidate;
  if (!entry.working) return false;
  return !(raining && entry.place.kind === 'spot' && !def.staysInRain);
}

/**
 * O lugar em que o morador deve estar AGORA: a última entrada da rotina cuja hora já passou (o dia dá a volta). Na chuva, quem estaria
 * numa rua/praça fica em casa (quem trabalha atrás do balcão continua lá). Função pura — testável sem cena.
 */
export function resolvePlace(def: NpcDefinition, hours: number, raining: boolean): NpcPlace {
  let place: NpcPlace = def.schedule[0].place;
  for (const entry of def.schedule) if (hours >= entry.fromHour) place = entry.place;
  return raining && place.kind === 'spot' && !def.staysInRain ? { kind: 'inside' } : place;
}

/** Até que distância (em células) o jogador ouve um morador abrir a porta de casa. */
const DOOR_EARSHOT_CELLS = 10;

/** Distância (em células, máximo entre os eixos) a que o jogador ainda "está ao lado" do morador pra conversar. */
const TALK_RANGE_CELLS = 1;

export interface NpcSystemOptions {
  /** Quais moradores esta cena tem. */
  ids: NpcId[];
  /** Posição dos pés e profundidade de quem trabalha atrás de um balcão (o Ferreiro). */
  posts: Partial<Record<NpcId, NpcPost>>;
}

/**
 * Faz os moradores do Vilarejo VIVEREM na cena: cria cada `Npc`, coloca-o já no lugar certo do dia ao abrir a cena (sem andar) e, a
 * cada `update`, o manda seguir a rotina (`resolvePlace` pelo relógio do jogo e pelo clima). Clicar num morador leva o jogador até ao
 * lado dele e abre a conversa (`systems/npcDialogue.ts`). Pausa enquanto há uma conversa aberta.
 */
export class NpcSystem {
  private readonly npcs = new Map<NpcId, Npc>();
  private pendingTalk: Npc | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly grid: WalkableGrid,
    private readonly player: Player,
    controller: PlayerController,
    tilePx: number,
    options: NpcSystemOptions,
  ) {
    const hours = gameState.gameClock.getHours();
    for (const id of options.ids) {
      const def = NPCS[id];
      const npc = new Npc(scene, def, grid, tilePx, options.posts[id] ?? null, (door) => this.playDoorSound(door));
      npc.snapTo(this.placeNow(npc, hours, gameState.weather.raining));
      this.npcs.set(id, npc);
    }
    controller.addWorldClickHandler((x, y) => this.handleClick(x, y));
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  /** Onde o morador deve estar agora: a rotina dele — salvo o Marceneiro, que está na Fazenda (não aparece no Vilarejo) enquanto constrói (`systems/construction.ts`). */
  private placeNow(npc: Npc, hours: number, raining: boolean): NpcPlace {
    if (npc.def.id === 'carpenter' && isCarpenterBusy()) return { kind: 'inside' };
    return resolvePlace(npc.def, hours, raining);
  }

  /** Porta abrindo, só se o jogador está por perto. */
  private playDoorSound(door: GridPoint): void {
    if (Math.hypot(door.col - this.player.col, door.row - this.player.row) <= DOOR_EARSHOT_CELLS) playEffect(this.scene, DOOR_SOUND);
  }

  getNpc(id: NpcId): Npc | undefined {
    return this.npcs.get(id);
  }

  update(time: number, delta: number): void {
    if (isDialogueOpen()) return; // Conversando: ninguém sai andando no meio da fala.
    const hours = gameState.gameClock.getHours();
    const raining = gameState.weather.raining;
    const playerCell = { col: this.player.col, row: this.player.row };
    for (const npc of this.npcs.values()) npc.update(time, delta, this.placeNow(npc, hours, raining), playerCell);

    // O jogador foi até o morador (clique): quando para, fala com ele se estiver ao lado.
    if (this.pendingTalk && !this.player.isMoving()) {
      const npc = this.pendingTalk;
      this.pendingTalk = null;
      if (npc.isTalkable() && this.isNear(npc)) this.talk(npc);
    }
  }

  private isNear(npc: Npc): boolean {
    const anchor = npc.getTalkAnchor();
    return Math.abs(this.player.col - anchor.col) <= TALK_RANGE_CELLS && Math.abs(this.player.row - anchor.row) <= TALK_RANGE_CELLS;
  }

  /** Clique no mundo: se caiu em cima de um morador (visível), vai até ele e conversa. Devolve `true` se consumiu o clique. */
  private handleClick(x: number, y: number): boolean {
    for (const npc of this.npcs.values()) {
      if (!npc.isTalkable()) continue;
      const bounds = npc.sprite.getBounds();
      // A arte tem margem vazia dos lados: só o miolo do corpo conta.
      const body = new Phaser.Geom.Rectangle(bounds.centerX - bounds.width * 0.28, bounds.top + bounds.height * 0.2, bounds.width * 0.56, bounds.height * 0.8);
      if (!body.contains(x, y)) continue;

      if (this.isNear(npc)) {
        this.talk(npc);
        return true;
      }
      const stand = this.findStandCell(npc);
      if (!stand) return true; // Sem caminho até ele: consome o clique mesmo assim (não "anda até o NPC").
      this.pendingTalk = npc;
      this.player.setPath(stand, (col, row) => this.grid.isWalkable(col, row));
      return true;
    }
    return false;
  }

  /** Rota do jogador até uma célula andável ao lado do morador (a mais curta); `null` se não houver. */
  private findStandCell(npc: Npc): GridPoint[] | null {
    const anchor = npc.getTalkAnchor();
    const from = { col: this.player.col, row: this.player.row };
    const candidates: GridPoint[] = [anchor, { col: anchor.col, row: anchor.row + 1 }, { col: anchor.col, row: anchor.row - 1 }, { col: anchor.col - 1, row: anchor.row }, { col: anchor.col + 1, row: anchor.row }];
    let best: GridPoint[] | null = null;
    for (const candidate of candidates) {
      if (!this.grid.isWalkable(candidate.col, candidate.row)) continue;
      const path = findPath(this.grid, from, candidate);
      if (path && path.length > 0 && (!best || path.length < best.length)) best = path;
    }
    return best;
  }

  private talk(npc: Npc): void {
    const anchor = npc.getTalkAnchor();
    this.player.faceDirection(anchor.col - this.player.col, anchor.row - this.player.row);
    // Na rua ninguém abre loja: elas ficam DENTRO das casas (`ShopInteriorScene`), que fazem o próprio contexto.
    const context: NpcTalkContext = { scene: this.scene, canOpenShop: () => false, openShop: () => {} };
    talkToNpc(npc.def.id, context);
  }

  private destroy(): void {
    for (const npc of this.npcs.values()) npc.destroy();
    this.npcs.clear();
    this.pendingTalk = null;
  }
}
