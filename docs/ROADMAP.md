# Roadmap — Mini Fazenda

> Este roadmap define a ordem de desenvolvimento do projeto. Nenhuma fase deve ser adiantada sem solicitação explícita — ver [CLAUDE.md](../CLAUDE.md).

## Fase 1 — Fundação técnica
- [ ] Configurar Vite
- [ ] Configurar TypeScript
- [ ] Instalar/configurar Phaser
- [ ] Criar estrutura inicial
- [ ] Criar cena principal
- [ ] Verificar execução do projeto

## Fase 2 — Mundo e mapa
- [ ] Sistema de grid
- [ ] Mapa da fazenda
- [ ] Terrenos
- [ ] Obstáculos
- [ ] Câmera

## Fase 3 — Personagem
- [ ] Personagem
- [ ] Animações
- [ ] Movimentação
- [ ] Clique no mapa
- [ ] Pathfinding
- [ ] Interação com o ambiente

## Fase 4 — Agricultura
- [x] Terrenos cultiváveis
- [x] Arar
- [x] Sementes
- [x] Plantar
- [x] Crescimento (por tempo, independente da rega)
- [x] Regar (hidratação separada do crescimento; falta de água mata a plantação)
- [x] Colher
- [x] Animações de ação do personagem (arar/plantar/regar/colher)

Detalhes de como o sistema funciona, arquivos envolvidos e limitações atuais: ver [TECHNICAL.md](TECHNICAL.md#agricultura-fase-4).

## Fase 5 — Economia
- [x] Moedas (saldo no `Inventory`, HUD no canto superior direito)
- [x] Inventário (colheita e estoque de sementes por cultura, separados; não é um inventário genérico de itens/slots — não era necessário para o escopo do jogo)
- [x] Venda (Caixa de Remessas sólida, com interação adjacente, compra toda a colheita do inventário por `sellPrice`)
- [x] Compra (sementes, pelo `seedPrice` de cada cultura, pagas com `spendCoins`)
- [x] Loja (banca sólida com interação adjacente e painel de compra)

Detalhes: ver [TECHNICAL.md](TECHNICAL.md#economia-fase-5).

## Fase 6 — Construções, Decoração e Expansão
- [x] Construções (sistema genérico de posicionamento livre)
- [x] Objetos decorativos (Poço, primeiro item comprável e posicionável)
- [x] Posicionamento (preview fantasma seguindo o mouse, checagem de colisão)
- [x] Remoção (clique no objeto posicionado)
- [x] Expansão da propriedade (Estilo Forager: 4 trechos ao redor do núcleo — norte/sul/leste/oeste —, cada um com sua própria placa física comprável, sem menu envolvido)

Detalhes: ver [TECHNICAL.md](TECHNICAL.md#construções-decoração-e-expansão-fase-6).

## Fase 7 — Tempo, Animais e Recursos
- [x] Sistema de Tempo (Relógio interno, ciclo dia/noite e transição de dias)
- [ ] Árvores (corte com machado, drop de madeira, renascimento com o tempo)
- [ ] Pedras e Minérios (quebrar com picareta, drop de pedra/minério)
- [ ] Animais (compra e posicionamento no pasto) — **galinhas prontas** (Galinheiro + aba Animais na Loja, ver [TECHNICAL.md](TECHNICAL.md#animais-galinhas-e-galinheiro-dataanimalsts-systemsanimalsts-entitieschickenets-systemschickenflockts)); demais animais pendentes
- [ ] Produção Animal (coleta diária de ovos, leite, etc.) — **ovos prontos** (1 por galinha por dia, recolhidos no galinheiro e vendidos na Caixa de Remessas); leite e demais pendentes

Detalhes: ver [TECHNICAL.md](TECHNICAL.md#sistema-de-tempo-fase-7).

## Fase 8 — Progressão e NPCs
- [x] Níveis e Experiência (XP ganho por colher/cortar/minerar/derrotar inimigos + árvore de habilidades no Inventário — ver [TECHNICAL.md](TECHNICAL.md#progressão-e-rpg-xp-e-árvore-de-habilidades-datascillsts-systemsskillsts-uiskilltreepanelts); pesca e resistência ainda sem sistema)
- [ ] Upgrade de Ferramentas (melhorar ferramentas usando minérios coletados)
- [ ] Desbloqueios e Novos Itens (lojas que vendem sementes/itens melhores à medida que novas áreas são expandidas)
- [x] Missões/Pedidos (campanha em 4 atos dada pelos moradores do Vilarejo, culminando na Noite Final — o fim do jogo passou pra Fase 11 — ver [TECHNICAL.md](TECHNICAL.md#vilarejo-moradores-tempo-global-e-campanha))
- [x] NPCs (moradores do Vilarejo, com casa, rotina por horário e conversa)

## Fase 9 — Polimento Final
- [ ] Interface (Refinamento final de menus, relógio/calendário HUD)
- [x] Efeitos (poeira, respingo, pulo elástico — "Pit Stop de Polimento")
- [x] Feedback visual (sombras, cursor, SeedBar/CoinBar animadas — "Pit Stop de Polimento")
- [ ] Sons e Música (SFX para ferramentas, passos e BGM do mundo)
- [ ] Animações (vento nas árvores, água animada)
- [ ] Balanceamento (ajuste de preços da loja e custo das pontes de expansão)
- [ ] Salvamento (Sistema de Save/Load guardando o progresso do dia, grid e inventário)

> Nota: os itens marcados acima foram adiantados como um "Pit Stop de
> Polimento" pedido explicitamente entre a Fase 5 e a Fase 6 — não uma
> Fase 9 completa. Sons e o restante da interface/animações continuam
> pendentes para quando a Fase 9 for feita de verdade, na ordem do
> roadmap. Detalhes: ver [TECHNICAL.md](TECHNICAL.md#polimento-visual-pit-stop-antes-da-fase-9).

## Fase 10 — Desktop
- [x] Integração com Electron (janela, save em `Documentos/Mini Fazenda`, tela cheia — ver [TECHNICAL.md](TECHNICAL.md#integração-com-electron-fase-10))
- [x] Build (`npm run build:electron`)
- [x] Testes (Vitest pra lógica em `tests/unit`, Playwright de ponta a ponta em `tests/e2e` — ver [TECHNICAL.md](TECHNICAL.md#testes-automáticos))
- [x] Geração do executável
- [x] Criação do instalador (NSIS, `release/Mini-Fazenda-Setup-<versão>.exe`)

## Fase 11 — Os Três Pilares do Equilíbrio (endgame)
A história principal e o FIM do jogo: o mundo em desequilíbrio só volta à paz quando a Cenoura Dourada, o Peixe Dourado e a Amizade Dourada (o pet escolhido na criação, que se sacrifica) forem oferecidos no altar do Sábio Coelho, no andar 100 das Cavernas. A campanha dos moradores continua, mas a Noite Final não encerra mais o jogo. Detalhes: ver [TECHNICAL.md](TECHNICAL.md#história-principal-os-três-pilares-fase-11).
- [x] Etapa 0 — Fundação: estado da história (`gameState.story`, marcos no save), carta da profecia (dia 3), objetivo dos Três Pilares no HUD, a Noite Final sem tela final, chamado da horda (o jogador é teletransportado pra Fazenda na hora da horda) e seção História no menu de hack
- [x] Etapa 1 — Pesca: Vara de Pescar (Ferreiro), minijogo de timing, 21 peixes (`Icons/Fish`) na Praia e no lago da Floresta, Sorte do Pescador e XP de pesca
- [x] Etapa 2 — Cavernas até o 50: minérios nos andares (por profundidade e raridade), Azurita a partir do 45 (minério e barra), barreira no 50 bloqueando a escada e o baú com o mapa
- [x] Etapa 3 — Floresta oculta e o Mago: área oculta (castelo), o Mago e as entregas de peixes, Mesa de Encantamentos (Picareta/Machado +20% força, Espada +35% dano, Armadura +15% defesa) e a barreira quebrada pela Picareta encantada
- [x] Etapa 4 — Descida 51-100: andares mais hostis e a Horda Final do andar 100 (3 ondas)
- [x] Etapa 5 — Santuário e fim: o andar 100 vira santuário, semente e lago do Peixe Dourado, plantio no altar, sacrifício do pet, cinemática, créditos e a caixa com o filhote
- [ ] Etapa 6 — Polimento: falas e cartas da história, balanceamento, sons e documentação

---

**Status atual:** Fases 1-5 implementadas e testadas em jogo (fundação, mapa, personagem/movimentação/pathfinding, agricultura e economia), Fases 1-5 100% concluídas. Ciclo completo testado: plantar (com sementes do estoque) → colher → vender na Caixa de Remessas → comprar mais sementes na Loja. Um "Pit Stop de Polimento" visual (sombras, cursor de seleção, efeitos de arar/regar/colher/vender, entrada animada de HUDs) foi adiantado por pedido explícito — sem sons nem ferramentas no inventário, que ficam para quando a Fase 9 for feita por completo. Fase 6 (Construções, Decoração e Expansão) 100% concluída: sistema de posicionamento livre (comprar → posicionar → remover, usando o Poço como primeiro objeto) e expansão de propriedade estilo Forager (4 trechos ao redor do núcleo, cada um com sua própria placa física comprável). Fase 7 com o primeiro item pronto: Sistema de Tempo (relógio interno, ciclo dia/noite, contador de dias) — Árvores, Pedras/Minérios, Animais e Produção Animal ainda pendentes.
