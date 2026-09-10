# Mini Fazenda

Mini Fazenda é um jogo 2D de fazenda, inspirado na experiência da Mini Fazenda do Orkut: possuir uma propriedade, plantar, colher, cuidar de animais, comprar objetos, construir, decorar, expandir a fazenda e evoluir progressivamente a propriedade. A referência é de conceito e sensação de jogo — o projeto constrói identidade própria e evolui durante o desenvolvimento.

O projeto está sendo desenvolvido de forma **incremental**, seguindo um roadmap de fases, com TypeScript, Phaser e Vite — e futura distribuição como aplicativo desktop via Electron.

> Estado atual: fundação e documentação do projeto. Nenhuma funcionalidade de jogo foi implementada ainda.

## Documentação

- **[CLAUDE.md](CLAUDE.md)** — Regras permanentes de desenvolvimento do projeto (o que sempre respeitar ao implementar qualquer parte do jogo).
- **[docs/GAME_DESIGN.md](docs/GAME_DESIGN.md)** — Conceito do jogo, pilares de experiência, loop de interação e sistemas futuros.
- **[docs/TECHNICAL.md](docs/TECHNICAL.md)** — Arquitetura técnica planejada: stack, organização de código, gerenciamento de assets, mapas e integração futura com Electron.
- **[docs/ROADMAP.md](docs/ROADMAP.md)** — Fases de desenvolvimento, da fundação técnica até o empacotamento desktop.

## Estrutura do projeto

```
assets/   artes e recursos externos (sprites, tilesets, imagens, animações)
docs/     documentação do projeto
maps/     mapas/tilemaps do jogo
src/      código-fonte
```

## Tecnologia planejada

- TypeScript
- Phaser
- Vite
- Electron (integração futura, para build desktop)
