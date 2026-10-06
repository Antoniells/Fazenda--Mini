# Estudo: iluminação nativa do Phaser 4 (Lights2D)

Fontes: código do Phaser **4.2.1** instalado (`node_modules/phaser/src/gameobjects/lights/`, shaders `DefineLights-glsl.js` e `ApplyLighting-glsl.js`) e os exemplos oficiais da biblioteca de referência (`phaser-examples/public/src/game objects/lights/` — `graveyard`, `point lights`, `spotlight`, `cone light`, `tilemap layer`, `light culling`). Protótipo feito ao vivo no andar 60 das Cavernas (sem mudar o código do jogo).

## Como funciona
- Liga por cena: `this.lights.enable().setAmbientColor(0x3a3650)`. Cada objeto escolhe receber luz: `objeto.setLighting(true)` (imagem, sprite, camada de tilemap, partículas, texto, render texture…). O que não tem `setLighting` (HUD, textos de UI) fica intocado.
- Luzes: `this.lights.addLight(x, y, raio, cor, intensidade, z?)` e `addConeLight(...)` (direção e abertura do cone). São objetos simples: mover `x`/`y`, `setIntensity`, `setColor`, `setRadius`.
- Cor final = **cor original × (ambiente + Σ luzes)**. A atenuação é `1 − d²/r²`, vezes o ângulo entre a luz e a superfície (a altura `z` da luz — padrão 10% do raio — deixa o centro mais suave).
- **Sem normal map** (nosso caso: o pacote não tem), o Phaser usa `__NORMAL` (normal plana "de frente"): a luz vira um círculo que se apaga com a distância — exatamente o que um jogo em pixel art quer.
- Limite: `render.maxLights` na config do jogo (padrão **10** por câmera; muda só na config). Passando disso, ficam as mais perto do centro da câmera. Luzes fora da tela são descartadas sozinhas.
- Extras:
  - `setSelfShadow(true)`: sombra falsa calculada pelo brilho do pixel (pixels escuros "fazem sombra") — funciona sem normal map.
  - `addPointLight(...)`: um BRILHO aditivo nativo (círculo com atenuação, descartado automaticamente fora da tela) — é o que os nossos anéis de `Shadow.png` em ADD imitam.

## Protótipo nas Cavernas (andar 60)
Desliguei o véu e o halo atuais, liguei as luzes, `setLighting(true)` em todos os 810 objetos do mundo, uma luz quente seguindo o personagem e uma em cada escada.
- **Visual**: muito melhor. A luz REVELA as cores de verdade em volta do personagem; longe dela fica a penumbra do ambiente, sem o "véu leitoso" que o MULTIPLY + ADD de hoje dá (o ADD clareia por cima em vez de iluminar).
- **Custo**: ~0,7 ms a mais por quadro (10,0 → 10,7 ms) com 810 objetos iluminados — desprezível.

## Recomendação
> **Aplicado nas Cavernas** (item 1, `systems/caveLighting.ts`) e na **noite da superfície** (item 2, `systems/dayNightOverlay.ts` + `systems/lightSources.ts`), as duas sobre `systems/sceneLighting.ts`. Os brilhos (item 3) continuam como cópias em ADD.

1. **Cavernas**: trocar `systems/caveLighting.ts` (véu + halo) pela luz nativa: ambiente por profundidade (a mesma escala de penumbra), luz do personagem, escadas, braseiros do santuário. Precisa de `setLighting(true)` em tudo que é do mundo da Caverna (chão, paredes, veios, inimigos, personagem, pet, baú) — um ponto único (ex.: ao criar o objeto, ou varrendo a lista da cena uma vez) resolve.
2. **Noite na superfície** (Fazenda, Vilarejo, Floresta): o mesmo, com o ambiente vindo de `ambientLight.ts` e as luzes dos postes/tochas (`lightSources.ts`) virando `addLight` — a noite fica escura de verdade, com os postes iluminando a rua em vez de só brilhar.
3. **Brilhos** (lampião aceso, estrelinhas dos veios): podem continuar como estão, ou virar `addPointLight`.
4. Cuidados: até 10 luzes por câmera (subir `maxLights` se a noite do Vilarejo precisar — cada luz a mais pesa no shader de TODOS os objetos iluminados); o que nasce depois (loot, partículas, inimigos de onda) também precisa de `setLighting`; o véu do dia/noite e a luz nativa não devem se somar na mesma cena.
