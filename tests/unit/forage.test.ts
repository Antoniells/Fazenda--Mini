import { describe, expect, it } from 'vitest';
import { FORAGE_DROP, forageKindOfGrassDetail, forageKindOfProp } from '../../src/data/forage';
import { GRASS_BLADE_DETAILS, GRASS_DETAILS } from '../../src/data/grassDetails';
import { MAP_PROPS } from '../../src/data/mapProps';
import { RESOURCES } from '../../src/data/resources';

describe('coleta com a Foice', () => {
  it('plantinhas, flores e cogumelos da grama são coletáveis; a pedrinha não', () => {
    const kinds = Object.fromEntries([...GRASS_DETAILS, ...GRASS_BLADE_DETAILS].map((detail) => [detail.id, forageKindOfGrassDetail(detail.id)]));
    expect(kinds).toEqual({ tuft: 'plant', mushroom: 'mushroom', rock: null, flower: 'flower', 'blade-a': 'plant', 'blade-b': 'plant', 'blade-c': 'plant' });
  });

  it('dos props do editor, só as plantas: cogumelos, flores, moitas e samambaia (pedras, tronco, trepadeira e coral não)', () => {
    const collectible = MAP_PROPS.filter((prop) => forageKindOfProp(prop.id) !== null).map((prop) => prop.id);
    expect(collectible.every((id) => /^prop-(mushroom|flower|tuft|fern)/.test(id))).toBe(true);
    expect(MAP_PROPS.filter((prop) => /^prop-(rock|fallen|climbing|coral)/.test(prop.id)).some((prop) => forageKindOfProp(prop.id) !== null)).toBe(false);
    expect(forageKindOfProp('prop-mushroom-blue')).toBe('mushroom');
    expect(forageKindOfProp('prop-flowerbed-blue')).toBe('flower');
    // A flor branca de folhas azul-esverdeadas ("Moita Azul-esverdeada") e o raminho de flores ("Samambaia Azul") são flores: dão Flor Silvestre.
    expect(forageKindOfProp('prop-tuft-teal')).toBe('flower');
    expect(forageKindOfProp('prop-fern-blue-tall')).toBe('flower');
    expect(forageKindOfProp('prop-tuft-orange-dry')).toBe('plant');
  });

  it('cada tipo solta um item que existe e é vendável (Capim, Flor Silvestre, Cogumelo)', () => {
    for (const id of Object.values(FORAGE_DROP)) {
      expect(RESOURCES[id], id).toBeDefined();
      expect(RESOURCES[id].sellPrice ?? 0).toBeGreaterThan(0);
    }
    expect(Object.values(FORAGE_DROP).map((id) => RESOURCES[id].name)).toEqual(['Capim', 'Flor Silvestre', 'Cogumelo']);
  });
});
