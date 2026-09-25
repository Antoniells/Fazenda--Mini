import type { WorldEventDefinition } from '../eventManager';
import { visitorEvent } from './visitorEvent';
import { amandaCatsEvent } from './amandaCatsEvent';

/** Todos os eventos do mundo por dia (`systems/eventManager.ts`) — um evento novo é só mais uma entrada aqui. */
export const WORLD_EVENTS: WorldEventDefinition[] = [visitorEvent, amandaCatsEvent];
