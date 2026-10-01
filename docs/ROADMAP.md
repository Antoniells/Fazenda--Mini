# Roadmap — Mini Fazenda

> Este roadmap define a ordem de desenvolvimento do projeto. Nenhuma fase deve ser adiantada sem solicitação explícita — ver [CLAUDE.md](../CLAUDE.md).

## Fase 1 — Fundação técnica
- [x] Configurar Vite
- [x] Configurar TypeScript
- [x] Instalar/configurar Phaser
- [x] Criar estrutura inicial
- [x] Criar cena principal
- [x] Verificar execução do projeto

## Fase 2 — Mundo e mapa
- [x] Sistema de grid
- [x] Mapa da fazenda
- [x] Terrenos
- [x] Obstáculos
- [x] Câmera

## Fase 3 — Personagem
- [x] Personagem
- [x] Animações
- [x] Movimentação
- [x] Clique no mapa
- [x] Pathfinding
- [x] Interação com o ambiente

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
- [x] Árvores (corte com machado, drop de madeira, renascimento com o tempo — Fazenda e Floresta)
- [x] Pedras e Minérios (quebrar com picareta, drop de pedra/minério — veios na Pedreira e nos andares das Cavernas, Fornalha pra fundir as barras; ver [TECHNICAL.md](TECHNICAL.md#fornalha-minério-e-ferramentas-no-ferreiro))
- [ ] Animais (compra e posicionamento no pasto) — **galinhas prontas** (Galinheiro + aba Animais na Loja, ver [TECHNICAL.md](TECHNICAL.md#animais-galinhas-e-galinheiro-dataanimalsts-systemsanimalsts-entitieschickenets-systemschickenflockts)); demais animais pendentes
- [ ] Produção Animal (coleta diária de ovos, leite, etc.) — **ovos prontos** (1 por galinha por dia, recolhidos no galinheiro e vendidos na Caixa de Remessas); leite e demais pendentes

Detalhes: ver [TECHNICAL.md](TECHNICAL.md#sistema-de-tempo-fase-7).

## Fase 8 — Progressão e NPCs
- [x] Níveis e Experiência (XP ganho por colher/cortar/minerar/derrotar inimigos + árvore de habilidades no Inventário — ver [TECHNICAL.md](TECHNICAL.md#progressão-e-rpg-xp-e-árvore-de-habilidades-datascillsts-systemsskillsts-uiskilltreepanelts); a pesca chegou na Fase 11; resistência ainda sem sistema)
- [x] Upgrade de Ferramentas (Machado/Picareta de Cobre, Ferro e Ouro no Ferreiro, por moedas + barras da Fornalha; encantamentos na Fase 11)
- [ ] Desbloqueios e Novos Itens (lojas que vendem sementes/itens melhores à medida que novas áreas são expandidas) — parcial: cada morador tem a sua loja (Ferreiro, Insumos, Marcenaria), mas o catálogo ainda não cresce com as expansões
- [x] Missões/Pedidos (campanha em 4 atos dada pelos moradores do Vilarejo, culminando na Noite Final — o fim do jogo passou pra Fase 11 — ver [TECHNICAL.md](TECHNICAL.md#vilarejo-moradores-tempo-global-e-campanha))
- [x] NPCs (moradores do Vilarejo, com casa, rotina por horário e conversa)

## Fase 9 — Polimento Final
- [ ] Interface (Refinamento final de menus, relógio/calendário HUD) — parcial: Inventário/Loja em livro, relógio de estação, Pausa e Configurações prontos; falta a revisão final
- [x] Efeitos (poeira, respingo, pulo elástico — "Pit Stop de Polimento")
- [x] Feedback visual (sombras, cursor, SeedBar/CoinBar animadas — "Pit Stop de Polimento")
- [x] Sons e Música (SFX de ferramentas, passos, combate e interface; música do dia; narração da cena introdutória) — os sons dos momentos da história ficam na Fase 11, Etapa 6
- [x] Animações (água animada; vento global que balança a vegetação em onda, árvores e plantas empurradas por quem passa, folhas caindo)
- [x] Atmosfera (Cavernas em penumbra com o halo do personagem e escadas iluminadas; veios que cintilam)
- [ ] Balanceamento (ajuste de preços da loja e custo das pontes de expansão) — junto com a rodada de jogo da história (Fase 11, Etapa 6)
- [x] Salvamento (3 slots; no executável, em `Documentos/Mini Fazenda`; campos novos sempre opcionais, pra saves antigos continuarem carregando)

Detalhes: ver [TECHNICAL.md](TECHNICAL.md#polimento-visual-pit-stop-antes-da-fase-9).

## Fase 10 — Desktop
- [x] Integração com Electron (janela, save em `Documentos/Mini Fazenda`, tela cheia — ver [TECHNICAL.md](TECHNICAL.md#integração-com-electron-fase-10))
- [x] Build (`npm run build:electron`)
- [x] Testes (Vitest pra lógica em `tests/unit`, Playwright de ponta a ponta em `tests/e2e` — ver [TECHNICAL.md](TECHNICAL.md#testes-automáticos))
- [x] Geração do executável
- [x] Criação do instalador (NSIS, `release-<versão>/Mini-Fazenda-Setup-<versão>.exe`; atualiza por cima da versão anterior — ver [TECHNICAL.md](TECHNICAL.md#instalador-atualizar-por-cima-da-versão-anterior))
- [x] Menu de hack (F9) só no modo de desenvolvimento

## Fase 11 — Os Três Pilares do Equilíbrio (endgame)
A história principal e o FIM do jogo: o mundo em desequilíbrio só volta à paz quando a Cenoura Dourada, o Peixe Dourado e a Amizade Dourada (o pet escolhido na criação, que se sacrifica) forem oferecidos no altar do Sábio Coelho, no andar 100 das Cavernas. A campanha dos moradores continua, mas a Noite Final não encerra mais o jogo. Detalhes: ver [TECHNICAL.md](TECHNICAL.md#história-principal-os-três-pilares-fase-11).
- [x] Etapa 0 — Fundação: estado da história (`gameState.story`, marcos no save), carta da profecia (dia 3), objetivo dos Três Pilares no HUD, a Noite Final sem tela final, chamado da horda (o jogador é teletransportado pra Fazenda na hora da horda) e seção História no menu de hack
- [x] Etapa 1 — Pesca: Vara de Pescar (Ferreiro), minijogo de timing, 21 peixes (`Icons/Fish`) na Praia e no lago da Floresta, Sorte do Pescador e XP de pesca
- [x] Etapa 2 — Cavernas até o 50: minérios nos andares (por profundidade e raridade), Azurita a partir do 45 (minério e barra), barreira no 50 bloqueando a escada e o baú com o mapa
- [x] Etapa 3 — Floresta oculta e o Mago: área oculta (castelo), o Mago e as entregas de peixes, Mesa de Encantamentos (Picareta/Machado +20% força, Espada +35% dano, Armadura +15% defesa) e a barreira quebrada pela Picareta encantada
- [x] Etapa 4 — Descida 51-100: andares mais hostis e a Horda Final do andar 100 (3 ondas)
- [x] Etapa 5 — Santuário e fim: o andar 100 vira santuário, semente e lago do Peixe Dourado, plantio no altar, sacrifício do pet, cinemática, créditos e a caixa com o filhote; depois do fim, o mundo em paz (sem hordas nem monstros)
- [x] Cena introdutória narrada: 4 slides com texto datilografado, narração por slide (ElevenLabs, `tools/generate_intro_voices.py`), avançar com F/Espaço e pular com ESC — ver [TECHNICAL.md](TECHNICAL.md#cena-introdutória-scenesintroscenets-dataintrots)
- [ ] Etapa 6 — Polimento: rodada de jogo da história inteira e balanceamento (Azurita, peixes do Mago, custo dos encantamentos, Horda Final, crescimento da Cenoura), falas e cartas dos moradores e do Mago sobre a profecia, sons do altar/sacrifício/onda de luz/pesca, música da cinemática e dos créditos, arte da Cenoura Dourada e a narração em inglês

---

**Status atual (versão 0.1.9):** Fases 1 a 6 e 10 concluídas. Fase 7 com árvores, pedras/minérios e tempo prontos (animais: só galinhas e ovos). Fase 8 quase completa (falta o catálogo das lojas crescer com as expansões). Fase 9 parcial (falta revisão final da interface e balanceamento). Fase 11 (a história dos Três Pilares e o fim do jogo) implementada de ponta a ponta, com testes automáticos; **a próxima etapa é a Etapa 6 da Fase 11**: jogar a história inteira, ajustar o balanceamento e o polimento de falas, sons e arte.
