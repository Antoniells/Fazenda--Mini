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
- [ ] Animais (compra e posicionamento no pasto)
- [ ] Produção Animal (coleta diária de ovos, leite, etc.)

Detalhes: ver [TECHNICAL.md](TECHNICAL.md#sistema-de-tempo-fase-7).

## Fase 8 — Progressão e NPCs
- [ ] Níveis e Experiência (XP ganho por colher/cortar/minerar)
- [ ] Upgrade de Ferramentas (melhorar ferramentas usando minérios coletados)
- [ ] Desbloqueios e Novos Itens (lojas que vendem sementes/itens melhores à medida que novas áreas são expandidas)
- [ ] Missões/Pedidos (entregar itens específicos para ganhar recompensas)

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
- [ ] Integração com Electron
- [ ] Build
- [ ] Testes
- [ ] Geração do executável
- [ ] Criação do instalador

---

**Status atual:** Fases 1-5 implementadas e testadas em jogo (fundação, mapa, personagem/movimentação/pathfinding, agricultura e economia), Fases 1-5 100% concluídas. Ciclo completo testado: plantar (com sementes do estoque) → colher → vender na Caixa de Remessas → comprar mais sementes na Loja. Um "Pit Stop de Polimento" visual (sombras, cursor de seleção, efeitos de arar/regar/colher/vender, entrada animada de HUDs) foi adiantado por pedido explícito — sem sons nem ferramentas no inventário, que ficam para quando a Fase 9 for feita por completo. Fase 6 (Construções, Decoração e Expansão) 100% concluída: sistema de posicionamento livre (comprar → posicionar → remover, usando o Poço como primeiro objeto) e expansão de propriedade estilo Forager (4 trechos ao redor do núcleo, cada um com sua própria placa física comprável). Fase 7 com o primeiro item pronto: Sistema de Tempo (relógio interno, ciclo dia/noite, contador de dias) — Árvores, Pedras/Minérios, Animais e Produção Animal ainda pendentes.
