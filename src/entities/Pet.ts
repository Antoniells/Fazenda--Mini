import Phaser from 'phaser';
import { PET_LUNGE_FRAME, PET_STAND_FRAMES, PET_TUNING, PetAnimName, PetId, PetRoamConfig, getPetDefinition, getPetTextureKey } from '../data/pets';
import { PET_CAT_SOUNDS, PET_DOG_SOUNDS } from '../data/audio';
import { playRandomEffect } from '../systems/soundEffects';
import { HEALTH_HEARTS_KEY, HEART_FULL_FRAME } from '../data/ui';
import { DISPLAY_SCALE } from '../systems/mapBuilder';
import { createGroundShadow } from '../systems/shadow';
import { popText } from '../systems/floatingText';
import { WalkableGrid } from '../systems/grid';
import { findPath, GridPoint } from '../systems/pathfinding';
import { ensurePetAnimations, petAnimKey } from '../systems/petSprites';
import { Enemy } from './Enemy';
import { Player } from './Player';

/**
 * `idle` = sentado descansando; `wander` = passeando; `follow` = vindo atrás do
 * jogador que se afastou; `come` = atendendo ao chamado (clique) pra ganhar
 * carinho; `petted` = recebendo carinho; `chase` = correndo atrás de quem
 * agrediu o jogador; `bite` = no bote da mordida; `toBed` = indo dormir na
 * caminha (`setBedCell`); `sleeping` = dormindo nela.
 */
type PetState = 'idle' | 'wander' | 'follow' | 'come' | 'petted' | 'chase' | 'bite' | 'toBed' | 'sleeping';
type Facing = 'side' | 'down' | 'up';

/** Os pés (âncora) do pet ficam 6px acima da âncora da célula: a arte dele tem 3px de margem vazia embaixo, a do jogador 6 — assim os dois pisam na mesma linha do chão. */
const FEET_OFFSET_PX = -6;
/** Duração (ms) do bote da mordida (vai e volta) e instante do impacto dentro dele. */
const BITE_MS = 300;
const BITE_LUNGE_PX = 14;
const BITE_IMPACT_MS = 110;
const HEART_DEPTH = 5000;
const HEART_COUNT = 3;
/** Deitado na caminha: quanto (px) fica acima da base dela, e o "Zzz" — intervalo entre os "z", altura de onde saem (sobre a cabeça) e quanto duram. */
const SLEEP_LIFT_PX = 6;
const SLEEP_Z_INTERVAL_MS = 900;
const SLEEP_Z_HEAD_PX = 30;
const SLEEP_Z_LIFETIME_MS = 1300;
/** Intervalo (ms) entre uma voz espontânea do pet e a próxima. */
const VOICE_MIN_MS = 35000;
const VOICE_MAX_MS = 80000;

/**
 * Pet companheiro (escolhido na Criação de Personagem): posição LIVRE em
 * pixels do mundo (como os inimigos, `entities/Enemy.ts`), mas sempre andando
 * célula a célula por rotas A* (`systems/pathfinding.ts`) no mesmo grid do
 * jogador — então contorna árvores, cercas, casa e água como ele. Sprite
 * próprio (32x32, ancorado nos pés) ordenado por Y como qualquer objeto do
 * mundo, com sombra de chão.
 *
 * Comportamento (ver `PET_TUNING`/`PET_ROAM` em `data/pets.ts`):
 * - Calmo: fica sentado voltado pro jogador e, de tempos em tempos, vagueia
 *   até um ponto aleatório num raio em volta dele. Se o jogador se afasta
 *   além do `leash`, vem atrás (e reaparece do lado dele se ficar longe demais
 *   ou sem caminho).
 * - Carinho: um clique no pet (`handleClick`) o chama — se estiver longe ele
 *   corre até o jogador — e ele fica feliz (pose de língua pra fora, pulinhos
 *   e corações do HUD subindo).
 * - Combate: `addAggressor` (chamado por `systems/petCompanion.ts` quando um
 *   inimigo agride o jogador) faz o pet correr até o agressor e mordê-lo até
 *   ele morrer. Só revida contra quem agrediu — não sai atacando o mapa.
 *
 * Só se mexe quando a cena chama `update` (as cenas pausam com menus abertos).
 * A física é da célula: `x`/`y` lógicos sempre andam sobre as linhas entre
 * centros de célula; o sprite só soma o deslocamento visual (pulinho/bote).
 */
export class Pet {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly textureKey: string;

  /** Posição lógica dos pés (mesma âncora do jogador: meio-x da célula, borda de baixo). */
  private x = 0;
  private y = 0;
  /** Deslocamento só visual (pulinho de alegria, bote da mordida). */
  private readonly offset = { x: 0, y: 0 };

  private state: PetState = 'idle';
  private stateEndsAt = 0;
  private nextDecisionAt = 0;
  private nextRepathAt = 0;
  private petCooldownUntil = 0;
  private biteReadyAt = 0;
  /** Desde quando o pet está parado, sem rota, longe demais do agressor (0 = não está) — ver `PET_TUNING.chaseStuckMs`. */
  private chaseStuckSince = 0;
  /** Quando o pet solta a próxima voz sozinho (0 = ainda não sorteado). */
  private nextVoiceAt = 0;

  /** Indo dormir/dormindo: a célula livre ao lado da caminha de onde ele sobe (`sleepStand`) e o ponto (px) no centro dela em que se deita, com a profundidade de desenho (`sleepSpot`). */
  private sleepStand: GridPoint | null = null;
  private sleepSpot: { x: number; y: number; depth: number } | null = null;
  /** Quando sai o próximo "z" e qual da sequência (z pequeno → grande). */
  private nextZzzAt = 0;
  private zzzStep = 0;
  /** Está em cima da caminha agora (célula bloqueada do grid) — ao deixar de dormir volta pra `sleepStand`, ver `update`. */
  private onBed = false;

  private path: GridPoint[] = [];
  /** Destino da rota planejada ao ir até o jogador (`follow`/`come`) — `null` enquanto ainda não planejou (chegar = estar NESTA célula, nunca "a rota acabou"). */
  private goal: GridPoint | null = null;
  /** Próxima célula em que o pet está entrando (a viagem célula a célula só troca de rota ao chegar nela). */
  private waypoint: GridPoint | null = null;

  private facing: Facing = 'down';
  /** Olhando pra esquerda (a arte de lado olha pra esquerda; pra direita, espelha). */
  private faceLeft = true;
  private readonly aggressors = new Set<Enemy>();
  /**
   * ROTEIRO (o sacrifício no altar, Fase 11 — `systems/sanctuary.ts`): enquanto ativo, o pet ignora o jogador, o carinho e as brigas;
   * anda até `goal` (se houver) e avisa `onArrive`, depois fica parado. `null` = comportamento normal.
   */
  private script: { goal: GridPoint | null; onArrive: (() => void) | null } | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly petId: PetId,
    private readonly player: Player,
    private readonly grid: WalkableGrid,
    private readonly tilePx: number,
    private readonly roam: PetRoamConfig,
    /** Filtro extra de células onde o pet pode parar/passear (ex.: a porta dentro de casa). */
    private readonly isCellAllowed: (col: number, row: number) => boolean = () => true,
    /** Células que a caminha ocupa AGORA (`HouseScene`, pedido explícito do usuário) — `null`/ausente em qualquer cena sem uma (nunca tenta dormir). Lida na hora de decidir, então acompanha a caminha sendo mexida. */
    private readonly bedCells: (() => GridPoint[]) | null = null,
    /** Célula onde nasce, em vez de ao lado do jogador — pra os gatos "visitantes" do evento da Amanda (`systems/events/amandaCatsEvent.ts`) não nascerem todos empilhados. */
    spawnCell: GridPoint | null = null,
  ) {
    ensurePetAnimations(scene, petId);
    this.textureKey = getPetTextureKey(petId);

    this.shadow = createGroundShadow(scene, 0, 0, DISPLAY_SCALE * 0.85, DISPLAY_SCALE * 0.4);
    this.sprite = scene.add.sprite(0, 0, this.textureKey, PET_STAND_FRAMES.down);
    this.sprite.setOrigin(0.5, 1);
    this.sprite.setScale(DISPLAY_SCALE);

    // Nasce numa célula livre ao lado do jogador (é assim que o pet "atravessa" as trocas de cena: cada cena cria o dele junto do jogador).
    this.placeAt(player.col, player.row);
    const spawn = spawnCell ?? this.findFreeCellNear(player.col, player.row) ?? { col: player.col, row: player.row };
    this.placeAt(spawn.col, spawn.row);
    this.fadeIn();
    this.nextDecisionAt = scene.time.now + PET_TUNING.idleMinMs;
    this.sitFacingPlayer();
    this.syncSprite();
  }

  // --- Entrada pública ---------------------------------------------------------

  /** Um inimigo agrediu o jogador: o pet passa a persegui-lo até ele morrer. */
  addAggressor(enemy: Enemy): void {
    if (!enemy.isDead()) this.aggressors.add(enemy);
  }

  /**
   * Clique no mundo: se acertou o pet, ele é chamado pra ganhar carinho
   * (devolve `true` — o clique não vira "andar até aqui"). Ocupado brigando, só
   * absorve o clique.
   */
  handleClick(worldX: number, worldY: number): boolean {
    if (!this.sprite.active) return false; // Já destruído (gato visitante que foi embora): o clique passa.
    const hit = worldX >= this.x - 24 && worldX <= this.x + 24 && worldY >= this.y - 46 && worldY <= this.y + 6;
    if (!hit) return false;

    const now = this.scene.time.now;
    if (this.script) return true; // No roteiro (o altar): só absorve o clique.
    if (this.aggressors.size > 0 || this.state === 'chase' || this.state === 'bite') return true;
    if (now < this.petCooldownUntil) return true;

    if (this.distanceToPlayer() <= PET_TUNING.petReach) this.beginPetted(now);
    else {
      this.state = 'come';
      this.path = [];
      this.goal = null;
      this.nextRepathAt = 0;
    }
    return true;
  }

  /** Some com um fade e se destrói (gato visitante que foi embora, `systems/events/amandaCatsEvent.ts`). */
  fadeOutAndDestroy(): void {
    if (!this.sprite.active) return;
    this.scene.tweens.killTweensOf([this.sprite, this.shadow]);
    this.scene.tweens.add({ targets: this.sprite, alpha: 0, duration: 700 });
    this.scene.tweens.add({ targets: this.shadow, alpha: 0, duration: 700, onComplete: () => this.destroy() });
  }

  destroy(): void {
    this.scene.tweens.killTweensOf([this.sprite, this.shadow, this.offset]);
    this.sprite.destroy();
    this.shadow.destroy();
  }

  /** Nome do pet (a conversa do sacrifício usa). */
  getName(): string {
    return getPetDefinition(this.petId).name;
  }

  /** Roteiro: anda até `cell` (sem o jogador, sem brigar) e chama `onArrive` ao chegar; se não houver caminho, reaparece lá. */
  walkToScripted(cell: GridPoint, onArrive: () => void): void {
    this.aggressors.clear();
    this.state = 'idle';
    this.path = [];
    this.goal = null;
    this.script = { goal: cell, onArrive };
    if (!this.planNear(cell)) {
      this.placeAt(cell.col, cell.row);
      this.fadeIn();
    }
  }

  /** Roteiro: brilha, sobe e some (vira a Amizade Dourada). `onDone` quando sumiu de vez. */
  ascend(tint: number, onDone: () => void): void {
    this.script = { goal: null, onArrive: null };
    this.scene.tweens.killTweensOf([this.sprite, this.shadow, this.offset]);
    this.sprite.setTint(tint);
    this.scene.tweens.add({ targets: this.sprite, alpha: { from: 1, to: 0.55 }, duration: 260, yoyo: true, repeat: 3 });
    this.scene.tweens.add({
      targets: this.offset,
      y: -70,
      delay: 1200,
      duration: 1800,
      ease: 'Sine.easeIn',
      onUpdate: () => this.syncSprite(),
    });
    this.scene.tweens.add({ targets: [this.sprite, this.shadow], alpha: 0, delay: 2200, duration: 1000, onComplete: () => {
      this.destroy();
      onDone();
    } });
  }

  // --- Loop --------------------------------------------------------------------

  /** O gato mia / o cachorro late (volume baixinho, `data/audio.ts`). */
  private makeSound(): void {
    playRandomEffect(this.scene, getPetDefinition(this.petId).species === 'cat' ? PET_CAT_SOUNDS : PET_DOG_SOUNDS);
  }

  /** Voz espontânea: de vez em quando (a cada ~35-80 s), só com o bicho calmo. */
  private maybeSpeakOnItsOwn(time: number): void {
    if (this.nextVoiceAt === 0) this.nextVoiceAt = time + Phaser.Math.Between(VOICE_MIN_MS, VOICE_MAX_MS);
    if (time < this.nextVoiceAt) return;
    this.nextVoiceAt = time + Phaser.Math.Between(VOICE_MIN_MS, VOICE_MAX_MS);
    this.makeSound();
  }

  update(time: number, delta: number): void {
    if (!this.sprite.active) return;
    if (this.script) {
      this.updateScript(delta);
      return;
    }
    this.pruneAggressors();

    // Acordou (acabou o sono, ou o carinho/uma briga o tirou da caminha): desce pra célula livre ao lado dela.
    if (this.onBed && this.state !== 'sleeping') {
      const stand = this.sleepStand;
      this.onBed = false;
      if (stand) this.placeAt(stand.col, stand.row);
    }

    const target = this.chooseTarget();
    if (target) this.updateCombat(time, delta, target);
    else {
      this.updateCalm(time, delta);
      this.maybeSpeakOnItsOwn(time);
    }

    this.syncSprite();
  }

  /** Roteiro em andamento: segue a rota até o destino; chegando, fica em pé virado pra cima (pro altar) e avisa uma vez. */
  private updateScript(delta: number): void {
    const script = this.script!;
    if (script.goal) {
      this.advance(delta, PET_TUNING.walkSpeed, true);
      if (this.waypoint === null && this.path.length === 0) {
        const arrived = script.onArrive;
        script.goal = null;
        script.onArrive = null;
        this.facing = 'up';
        this.stand();
        arrived?.();
      } else {
        this.playAnimation(`walk-${this.facing}`);
      }
    }
    this.syncSprite();
  }

  private updateCombat(time: number, delta: number, target: Enemy): void {
    if (this.state === 'bite') {
      if (time < this.stateEndsAt) {
        this.finishStep(delta);
        return;
      }
    }
    this.state = 'chase';

    const distance = Math.hypot(target.x - this.x, target.y - this.y);
    if (distance <= PET_TUNING.biteRange) {
      this.chaseStuckSince = 0;
      this.path = [];
      this.finishStep(delta);
      if (time >= this.biteReadyAt) this.startBite(target, time);
      else {
        this.faceToward(target.x - this.x, target.y - this.y);
        this.stand();
      }
      return;
    }

    if (this.waypoint === null && time >= this.nextRepathAt) {
      this.nextRepathAt = time + PET_TUNING.repathMs;
      this.planNear(this.cellOf(target.x, target.y));
    }
    this.advance(delta, PET_TUNING.runSpeed, true);

    // Sem rota e ainda longe (inimigo do outro lado da água, cercado…): depois de um tempo desiste dele — se ele agredir de novo, o pet volta.
    if (this.waypoint === null && this.path.length === 0) {
      if (this.chaseStuckSince === 0) this.chaseStuckSince = time;
      else if (time - this.chaseStuckSince > PET_TUNING.chaseStuckMs) {
        this.aggressors.delete(target);
        this.chaseStuckSince = 0;
        this.setIdle(time);
        return;
      }
      this.stand();
    } else {
      this.chaseStuckSince = 0;
      this.playAnimation(`walk-${this.facing}`);
    }
  }

  private updateCalm(time: number, delta: number): void {
    const distanceToPlayer = this.distanceToPlayer();

    if (this.state === 'chase' || this.state === 'bite') this.setIdle(time); // Briga acabou.

    if (this.state === 'petted') {
      this.finishStep(delta);
      if (time >= this.stateEndsAt) this.setIdle(time);
      return;
    }

    // Longe demais (ou sem caminho): reaparece do lado do jogador.
    if (distanceToPlayer > PET_TUNING.teleportDistance) {
      this.warpNearPlayer();
      this.setIdle(time);
      return;
    }

    if (this.state === 'come') {
      if (distanceToPlayer <= PET_TUNING.petReach) {
        this.path = [];
        this.finishStep(delta);
        if (this.waypoint === null) this.beginPetted(time);
        return;
      }
      // Chegou à célula mais perto que dava (mesmo sem alcançar o `petReach`): já vale como "veio".
      if (this.travelTowardPlayer(time, delta) && this.waypoint === null) this.beginPetted(time);
      return;
    }

    const leash = this.roam.leashTiles * this.tilePx;
    // Indo dormir/dormindo, a coleira não vale: a caminha fica longe do jogador na maior parte do tempo e, com a coleira, o pet era
    // arrancado dela assim que o jogador andava pela casa (só o `teleportDistance` acima ainda o traz de volta se ficar longe demais).
    const resting = this.state === 'toBed' || this.state === 'sleeping';
    if (this.state !== 'follow' && !resting && distanceToPlayer > leash) {
      this.state = 'follow';
      this.path = [];
      this.goal = null;
      this.nextRepathAt = 0;
    }

    if (this.state === 'follow') {
      if (this.waypoint === null && distanceToPlayer <= PET_TUNING.settleDistance) {
        this.path = [];
        this.setIdle(time);
        return;
      }
      if (this.travelTowardPlayer(time, delta) && this.waypoint === null) this.setIdle(time);
      return;
    }

    if (this.state === 'wander') {
      this.advance(delta, PET_TUNING.walkSpeed, true);
      this.playAnimation(`walk-${this.facing}`);
      if (this.waypoint === null && this.path.length === 0) this.setIdle(time);
      return;
    }

    if (this.state === 'toBed') {
      this.advance(delta, PET_TUNING.walkSpeed, true);
      this.playAnimation(`walk-${this.facing}`);
      // Chegou ao lado da caminha: sobe e dorme. Sem rota (a caminha ficou cercada por outro móvel novo…) desiste e volta a ser "calmo".
      if (this.waypoint === null && this.path.length === 0) {
        const cell = this.currentCell();
        if (this.sleepStand && cell.col === this.sleepStand.col && cell.row === this.sleepStand.row) this.beginSleep(time);
        else this.setIdle(time);
      }
      return;
    }

    if (this.state === 'sleeping') {
      this.finishStep(delta);
      // Animação de dormir da própria folha do pet (`getPetSleepAnim`) — de propósito NÃO vira pro jogador como o `idle` faz.
      this.playAnimation('sleep');
      if (this.onBed) this.emitSleepZ(time);
      if (time >= this.stateEndsAt) this.setIdle(time);
      return;
    }

    // idle: sentado voltado pro jogador; de tempos em tempos decide passear (ou, com uma caminha nesta cena, ir dormir nela).
    this.finishStep(delta);
    this.sitFacingPlayer();
    if (time >= this.nextDecisionAt && this.waypoint === null) {
      this.nextDecisionAt = time + Phaser.Math.Between(PET_TUNING.idleMinMs, PET_TUNING.idleMaxMs);
      if (Math.random() < PET_TUNING.sleepChance && this.beginGoingToBed(time)) return;
      if (Math.random() < PET_TUNING.wanderChance && this.planWander()) this.state = 'wander';
    }
  }

  // --- Estados -----------------------------------------------------------------

  private setIdle(time: number): void {
    this.state = 'idle';
    this.path = [];
    this.nextDecisionAt = time + Phaser.Math.Between(PET_TUNING.idleMinMs, PET_TUNING.idleMaxMs);
  }

  private beginPetted(time: number): void {
    this.makeSound(); // Feliz com o carinho.
    this.state = 'petted';
    this.path = [];
    this.stateEndsAt = time + PET_TUNING.pettedMs;
    this.petCooldownUntil = this.stateEndsAt + PET_TUNING.petCooldownMs;

    this.facing = 'down';
    this.playAnimation('happy');
    this.spawnHearts();
    this.hop(2);
    this.faceOwner();
  }

  /**
   * Decide ir dormir: escolhe, entre as células que a caminha ocupa agora, a célula da caminha com um lado LIVRE mais perto do pet e
   * traça a rota até esse lado (`sleepStand`). Calculado aqui, na hora — não uma vez só — pra o pet nunca ficar sem destino porque um
   * móvel novo tomou o lado que estava livre. `false` = sem caminha, ou nenhum lado alcançável (aí ele vaga como sempre).
   */
  private beginGoingToBed(time: number): boolean {
    const bed = this.bedCells?.() ?? [];
    if (bed.length === 0) return false;

    const here = this.currentCell();
    let best: GridPoint | null = null;
    let bestDistance = Infinity;
    for (const cell of bed) {
      for (const [dCol, dRow] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const stand = { col: cell.col + dCol, row: cell.row + dRow };
        if (bed.some((other) => other.col === stand.col && other.row === stand.row) || !this.isFree(stand.col, stand.row)) continue;
        const distance = Math.abs(stand.col - here.col) + Math.abs(stand.row - here.row);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = stand;
        }
      }
    }
    if (!best) return false;

    // Onde ele se deita: o CENTRO da caminha inteira (não de uma célula só — ela tem 2), um pouco acima do chão (a almofada tem altura).
    // A profundidade fica logo à frente da base da caminha (que é ordenada pelo Y da base dela).
    const centerX = bed.reduce((sum, cell) => sum + this.cellCenterX(cell.col), 0) / bed.length;
    const bottomY = bed.reduce((sum, cell) => sum + this.cellBottomY(cell.row), 0) / bed.length;
    const frontY = Math.max(...bed.map((cell) => this.cellBottomY(cell.row)));
    this.sleepStand = best;
    this.sleepSpot = { x: centerX, y: bottomY - SLEEP_LIFT_PX, depth: frontY + 1 };
    if (bestDistance === 0) {
      this.beginSleep(time);
      return true;
    }
    if (!this.planTo(best)) return false;
    this.state = 'toBed';
    return true;
  }

  /** Chegou ao lado da caminha (`toBed`): sobe nela e dorme por um tempo sorteado (`PET_TUNING.sleepMinMs/MaxMs`), depois volta a ser "calmo" (e desce, ver `update`). */
  private beginSleep(time: number): void {
    const spot = this.sleepSpot;
    this.state = 'sleeping';
    this.path = [];
    this.stateEndsAt = time + Phaser.Math.Between(PET_TUNING.sleepMinMs, PET_TUNING.sleepMaxMs);
    this.facing = 'down';
    this.playAnimation('sleep');
    this.nextZzzAt = 0;
    this.zzzStep = 0;

    if (spot) {
      // Pulinho pra cima da caminha: o pet passa a ficar no centro dela (o deslocamento visual sai do lado de onde subiu e volta a zero).
      const fromX = this.x;
      const fromY = this.y;
      this.goal = null;
      this.waypoint = null;
      this.x = spot.x;
      this.y = spot.y;
      this.onBed = true;
      this.offset.x = fromX - this.x;
      this.offset.y = fromY - this.y;
      this.scene.tweens.killTweensOf(this.offset);
      this.scene.tweens.add({ targets: this.offset, x: 0, y: 0, duration: 260, ease: 'Sine.easeOut' });
    }
  }

  /** "Z", "z", "z" subindo da cabeça enquanto dorme (texto flutuante do jogo, `systems/floatingText.ts` — não há arte de Zzz nos assets). */
  private emitSleepZ(time: number): void {
    if (time < this.nextZzzAt) return;
    this.nextZzzAt = time + SLEEP_Z_INTERVAL_MS;
    const step = this.zzzStep % 3;
    this.zzzStep += 1;
    popText(this.scene, this.x + 10 + step * 8, this.y - SLEEP_Z_HEAD_PX, 'z', {
      color: '#d6ecff',
      fontSize: 12 + step * 3,
      rise: 24,
      duration: SLEEP_Z_LIFETIME_MS,
    });
  }

  private startBite(target: Enemy, time: number): void {
    this.makeSound(); // Late/mia ao atacar.
    this.state = 'bite';
    this.stateEndsAt = time + BITE_MS;
    this.biteReadyAt = time + PET_TUNING.biteCooldownMs;

    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const length = Math.hypot(dx, dy) || 1;
    this.faceToward(dx, dy);
    this.sprite.stop();
    this.sprite.setFrame(this.facing === 'side' ? PET_LUNGE_FRAME : PET_STAND_FRAMES[this.facing]);

    // Bote: avança na direção do inimigo e volta; o dano cai no ponto mais avançado.
    this.scene.tweens.killTweensOf(this.offset);
    this.scene.tweens.add({ targets: this.offset, x: (dx / length) * BITE_LUNGE_PX, y: (dy / length) * BITE_LUNGE_PX * 0.6, duration: BITE_IMPACT_MS, yoyo: true, ease: 'Quad.easeOut', onComplete: () => this.resetOffset() });
    this.scene.time.delayedCall(BITE_IMPACT_MS, () => {
      if (target.isDead() || !this.sprite.active) return;
      const kx = target.x - this.x;
      const ky = target.y - this.y;
      const kLength = Math.hypot(kx, ky) || 1;
      target.takeDamage(PET_TUNING.biteDamage, kx / kLength, ky / kLength, 'pet');
    });
  }

  // --- Movimento ---------------------------------------------------------------

  /**
   * Vai (correndo) até uma célula vizinha do jogador, replanejando a cada passo
   * quando ele muda de lugar (só nos limites de célula — nunca no meio de um
   * passo). Devolve `true` ao chegar na célula do destino.
   */
  private travelTowardPlayer(time: number, delta: number): boolean {
    if (this.waypoint === null && time >= this.nextRepathAt) {
      this.nextRepathAt = time + PET_TUNING.repathMs;
      const goal = this.findFreeCellNear(this.player.col, this.player.row);
      if (goal && this.planTo(goal)) {
        this.goal = goal;
      } else if (this.path.length === 0 && this.distanceToPlayer() > PET_TUNING.settleDistance * 2) {
        // Sem rota até o jogador (ilhado, do outro lado da cerca…): reaparece ao lado dele.
        this.warpNearPlayer();
        return false;
      }
    }
    this.advance(delta, PET_TUNING.runSpeed, true);

    if (this.waypoint === null && this.path.length === 0) {
      const cell = this.currentCell();
      if (this.goal && cell.col === this.goal.col && cell.row === this.goal.row) {
        this.stand();
        return true;
      }
    }
    this.playAnimation(`walk-${this.facing}`);
    return false;
  }

  /** Termina o passo já iniciado (o pet nunca fica parado entre duas células), sem virar nem tocar animação de andar. */
  private finishStep(delta: number): void {
    if (this.waypoint) this.advance(delta, PET_TUNING.walkSpeed, false);
  }

  private advance(delta: number, speed: number, turn: boolean): void {
    if (!this.waypoint) {
      const next = this.path[0];
      if (!next) return;
      if (!this.grid.isWalkable(next.col, next.row)) {
        this.path = []; // Bloqueada no meio do caminho (construção posicionada, árvore plantada…): replaneja.
        return;
      }
      this.waypoint = this.path.shift()!;
    }

    const targetX = this.cellCenterX(this.waypoint.col);
    const targetY = this.cellBottomY(this.waypoint.row);
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const distance = Math.hypot(dx, dy);
    const step = (speed * delta) / 1000;

    if (turn && distance > 0.001) this.faceToward(dx, dy);

    if (distance <= step) {
      this.x = targetX;
      this.y = targetY;
      this.waypoint = null;
    } else {
      this.x += (dx / distance) * step;
      this.y += (dy / distance) * step;
    }
  }

  private planTo(goal: GridPoint): boolean {
    const start = this.currentCell();
    const path = findPath(this.grid, start, goal);
    if (!path) return false;
    this.path = path;
    return true;
  }

  /** Rota até `goal` ou, se ele estiver bloqueado (o inimigo pisa em borda de obstáculo), até a vizinha andável mais próxima. */
  private planNear(goal: GridPoint): boolean {
    if (this.planTo(goal)) return true;
    const neighbors = [
      { col: goal.col, row: goal.row - 1 },
      { col: goal.col, row: goal.row + 1 },
      { col: goal.col - 1, row: goal.row },
      { col: goal.col + 1, row: goal.row },
    ];
    for (const neighbor of neighbors) if (this.planTo(neighbor)) return true;
    return false;
  }

  /**
   * Sorteia uma célula andável num raio em volta do JOGADOR e traça a rota até
   * ela. Pra cima o raio é menor que pra baixo: as células bem acima do jogador
   * costumam ser "atrás" de casas e árvores, onde o pet ficaria escondido atrás
   * da arte (ordenada por Y) e pareceria ter sumido.
   */
  private planWander(): boolean {
    const radius = this.roam.wanderRadiusTiles;
    const current = this.currentCell();
    for (let attempt = 0; attempt < 8; attempt++) {
      const col = this.player.col + Phaser.Math.Between(-radius, radius);
      const row = this.player.row + Phaser.Math.Between(-Math.ceil(radius / 2), radius);
      if (!this.isFree(col, row) || (col === this.player.col && row === this.player.row)) continue;
      if (Math.abs(col - current.col) + Math.abs(row - current.row) < 2) continue;
      const path = findPath(this.grid, current, { col, row });
      if (path && path.length > 0 && path.length <= radius * 3 + 4) {
        this.path = path;
        return true;
      }
    }
    return false;
  }

  /** Célula livre mais próxima do pet, ao redor de (`col`,`row`) — nunca a própria célula do jogador. `null` se nada por perto. */
  private findFreeCellNear(col: number, row: number): GridPoint | null {
    let best: GridPoint | null = null;
    let bestDistance = Infinity;
    const here = this.currentCell();
    for (let radius = 1; radius <= 3 && !best; radius++) {
      for (let dRow = -radius; dRow <= radius; dRow++) {
        for (let dCol = -radius; dCol <= radius; dCol++) {
          if (Math.max(Math.abs(dCol), Math.abs(dRow)) !== radius) continue;
          const candidate = { col: col + dCol, row: row + dRow };
          if (!this.isFree(candidate.col, candidate.row)) continue;
          const distance = Math.abs(candidate.col - here.col) + Math.abs(candidate.row - here.row);
          if (distance < bestDistance) {
            bestDistance = distance;
            best = candidate;
          }
        }
      }
    }
    return best;
  }

  private isFree(col: number, row: number): boolean {
    return this.grid.isWalkable(col, row) && this.isCellAllowed(col, row);
  }

  private warpNearPlayer(): void {
    const cell = this.findFreeCellNear(this.player.col, this.player.row);
    if (!cell) return;
    this.placeAt(cell.col, cell.row);
    this.fadeIn();
  }

  private placeAt(col: number, row: number): void {
    this.x = this.cellCenterX(col);
    this.y = this.cellBottomY(row);
    this.path = [];
    this.goal = null;
    this.waypoint = null;
    this.onBed = false; // Qualquer reposicionamento (reaparecer ao lado do jogador…) tira o pet da caminha.
    this.resetOffset();
  }

  private fadeIn(): void {
    this.scene.tweens.killTweensOf([this.sprite, this.shadow]);
    this.sprite.setAlpha(0);
    this.shadow.setAlpha(0);
    this.scene.tweens.add({ targets: this.sprite, alpha: 1, duration: 260 });
    this.scene.tweens.add({ targets: this.shadow, alpha: 0.32, duration: 260 });
  }

  // --- Alvos -------------------------------------------------------------------

  private pruneAggressors(): void {
    for (const enemy of this.aggressors) if (enemy.isDead() || !enemy.sprite.active) this.aggressors.delete(enemy);
  }

  /** O agressor vivo mais próximo do pet; larga todos se o jogador ficou longe demais deles (a briga acabou). */
  private chooseTarget(): Enemy | null {
    let best: Enemy | null = null;
    let bestDistance = Infinity;
    for (const enemy of this.aggressors) {
      const playerDistance = Math.hypot(enemy.x - this.player.sprite.x, enemy.y - this.player.sprite.y);
      if (playerDistance > PET_TUNING.chaseGiveUpDistance) {
        this.aggressors.delete(enemy);
        continue;
      }
      const distance = Math.hypot(enemy.x - this.x, enemy.y - this.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = enemy;
      }
    }
    return best;
  }

  // --- Visual ------------------------------------------------------------------

  private syncSprite(): void {
    const drawX = this.x + this.offset.x;
    const drawY = this.y + FEET_OFFSET_PX + this.offset.y;
    this.sprite.setPosition(drawX, drawY);
    this.sprite.setFlipX(this.facing === 'side' && !this.faceLeft);
    // Ordena por Y como o resto do mundo (pelo chão, não pelo pulinho); deitado na caminha, um pouco à frente dela (ela tem o mesmo Y).
    this.sprite.setDepth(this.onBed && this.sleepSpot ? this.sleepSpot.depth : this.y);
    this.shadow.setPosition(this.x, this.y - 13);
    this.shadow.setDepth(this.y - 0.1);
  }

  private faceToward(dx: number, dy: number): void {
    if (Math.abs(dx) >= Math.abs(dy)) {
      this.facing = 'side';
      if (Math.abs(dx) > 0.5) this.faceLeft = dx < 0;
    } else {
      this.facing = dy > 0 ? 'down' : 'up';
    }
  }

  /** Sentado, olhando pro jogador: de frente se ele está embaixo, senão de lado. */
  private sitFacingPlayer(): void {
    const dx = this.player.sprite.x - this.x;
    const dy = this.player.sprite.y - this.y;
    if (Math.abs(dy) > Math.abs(dx) * 1.4 && dy > 0) {
      this.facing = 'down';
      this.playAnimation('sit-front');
    } else {
      this.facing = 'side';
      if (Math.abs(dx) > 4) this.faceLeft = dx < 0;
      this.playAnimation('sit-side');
    }
  }

  /** O carinho é de frente: o pet fica de frente e o jogador vira pra ele (se estiver livre — nunca no meio de um passo ou ação). */
  private faceOwner(): void {
    const dx = this.x - this.player.sprite.x;
    const dy = this.y - this.player.sprite.y;
    if (this.player.isMoving() || this.player.isBusy()) return;
    if (Math.abs(dx) >= Math.abs(dy)) this.player.faceDirection(Math.sign(dx), 0);
    else this.player.faceDirection(0, Math.sign(dy));
  }

  /** Parado em pé, voltado pra `facing` (sem animação). */
  private stand(): void {
    this.sprite.stop();
    this.sprite.setFrame(PET_STAND_FRAMES[this.facing]);
  }

  private playAnimation(name: PetAnimName): void {
    const key = petAnimKey(this.petId, name);
    if (this.sprite.anims.currentAnim?.key !== key || !this.sprite.anims.isPlaying) this.sprite.play(key, true);
  }

  private hop(times: number): void {
    this.scene.tweens.killTweensOf(this.offset);
    this.scene.tweens.add({ targets: this.offset, y: -9, duration: 120, yoyo: true, repeat: times - 1, ease: 'Quad.easeOut', onComplete: () => this.resetOffset() });
  }

  private resetOffset(): void {
    this.offset.x = 0;
    this.offset.y = 0;
  }

  /** Corações (arte do HUD, `UI/Bars.png`) subindo da cabeça, um atrás do outro — só um efeito, some sozinho. */
  private spawnHearts(): void {
    const scene = this.scene;
    if (!scene.textures.exists(HEALTH_HEARTS_KEY)) return;
    const texture = scene.textures.get(HEALTH_HEARTS_KEY);
    if (!texture.has(HEART_FULL_FRAME.name)) {
      const { x, y, width, height } = HEART_FULL_FRAME.rect;
      texture.add(HEART_FULL_FRAME.name, 0, x, y, width, height);
    }

    for (let index = 0; index < HEART_COUNT; index++) {
      const heart = scene.add.image(this.x + (index - 1) * 20, this.y - 46 - (index === 1 ? 8 : 0), HEALTH_HEARTS_KEY, HEART_FULL_FRAME.name);
      heart.setDepth(HEART_DEPTH);
      heart.setAlpha(0);
      heart.setScale(0.6);
      const startY = heart.y;
      scene.tweens.add({
        targets: heart,
        alpha: 1,
        scale: 2,
        duration: 160,
        delay: index * 170,
        ease: 'Back.easeOut',
        onComplete: () => {
          // Sobe devagar e só some no fim do trajeto (dá tempo de ver).
          scene.tweens.add({ targets: heart, y: startY - 36, duration: 1300, ease: 'Sine.easeOut' });
          scene.tweens.add({ targets: heart, alpha: 0, duration: 450, delay: 850, onComplete: () => heart.destroy() });
        },
      });
    }
  }

  // --- Grade -------------------------------------------------------------------

  private cellCenterX(col: number): number {
    return col * this.tilePx + this.tilePx / 2;
  }

  private cellBottomY(row: number): number {
    return (row + 1) * this.tilePx;
  }

  /** Célula do corpo (centro, não os pés): troca de célula na metade do caminho, sem oscilar. */
  private cellOf(x: number, y: number): GridPoint {
    return { col: Math.floor(x / this.tilePx), row: Math.floor((y - this.tilePx / 2) / this.tilePx) };
  }

  private currentCell(): GridPoint {
    return this.cellOf(this.x, this.y);
  }

  private distanceToPlayer(): number {
    return Math.hypot(this.player.sprite.x - this.x, this.player.sprite.y - this.y);
  }
}
