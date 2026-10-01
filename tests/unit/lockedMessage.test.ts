import { describe, expect, it } from 'vitest';
import { LockedMessage } from '../../src/ui/lockedMessage';

/** Uma cena falsa: objetos de texto/painel que só guardam texto e visibilidade, e um relógio que anda à mão. */
function fakeScene() {
  let now = 0;
  const timers: Array<{ at: number; callback: () => void; removed: boolean }> = [];
  const texts: Array<{ text: string; visible: boolean }> = [];
  const chain = <T extends object>(target: T): T =>
    new Proxy(target, {
      get(object, property) {
        if (property in object) return (object as Record<PropertyKey, unknown>)[property];
        return () => chain(object);
      },
    });
  const makeText = () => {
    const state = { text: '', visible: true };
    texts.push(state);
    return chain({
      setText(value: string) {
        state.text = value;
      },
      setVisible(value: boolean) {
        state.visible = value;
      },
    });
  };
  const scene = {
    scale: { width: 1280, height: 720 },
    textures: { get: () => ({ has: () => true, add: () => {} }) },
    add: { nineslice: () => chain({ setVisible: () => {} }), text: makeText },
    time: {
      get now() {
        return now;
      },
      delayedCall(delay: number, callback: () => void) {
        const timer = { at: now + delay, callback, removed: false };
        timers.push(timer);
        return { remove: () => (timer.removed = true) };
      },
    },
  };
  const advance = (ms: number): void => {
    const until = now + ms;
    for (;;) {
      const due = timers.filter((timer) => !timer.removed && timer.at <= until).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      now = due.at;
      due.removed = true;
      due.callback();
    }
    now = until;
  };
  /** O título na tela (o 1º texto criado é o título), ou `null` se o aviso está escondido. */
  const shownTitle = (): string | null => (texts[0].visible ? texts[0].text : null);
  return { scene, advance, shownTitle };
}

describe('fila de avisos (LockedMessage)', () => {
  it('um aviso novo espera o da tela, em vez de apagá-lo', () => {
    const { scene, advance, shownTitle } = fakeScene();
    const message = new LockedMessage(scene as never);
    message.show('ATALHO', 'andar 50');
    message.show('BARREIRA', 'bloqueada');
    expect(shownTitle()).toBe('ATALHO');
    advance(1700);
    expect(shownTitle()).toBeNull(); // o intervalo entre os dois
    advance(300);
    expect(shownTitle()).toBe('BARREIRA');
    advance(3300);
    expect(shownTitle()).toBeNull();
  });

  it('o mesmo aviso repetido não se acumula na fila', () => {
    const { scene, advance, shownTitle } = fakeScene();
    const message = new LockedMessage(scene as never);
    for (let index = 0; index < 5; index += 1) message.show('A HORDA ESTÁ AQUI!', 'não dá pra sair');
    advance(3300);
    expect(shownTitle()).toBeNull();
    advance(5000);
    expect(shownTitle()).toBeNull();
  });

  it('um aviso novo no intervalo entre dois da fila entra atrás do próximo', () => {
    const { scene, advance, shownTitle } = fakeScene();
    const message = new LockedMessage(scene as never);
    message.show('1', '');
    message.show('2', '');
    advance(1650); // "1" saiu; "2" é o da vez, ainda no intervalo
    message.show('3', '');
    advance(200);
    expect(shownTitle()).toBe('2');
    advance(1700);
    advance(200);
    expect(shownTitle()).toBe('3');
  });
});
