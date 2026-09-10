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
- [ ] Moedas
- [ ] Inventário
- [ ] Venda
- [ ] Compra
- [ ] Loja

## Fase 6 — Construções e decoração
- [ ] Construções
- [ ] Objetos decorativos
- [ ] Posicionamento
- [ ] Remoção
- [ ] Expansão da propriedade

## Fase 7 — Animais e recursos
- [ ] Animais
- [ ] Produção
- [ ] Árvores
- [ ] Pedras
- [ ] Recursos coletáveis

## Fase 8 — Progressão
- [ ] Níveis
- [ ] Experiência
- [ ] Desbloqueios
- [ ] Missões
- [ ] Novos terrenos
- [ ] Novos itens

## Fase 9 — Polimento
- [ ] Interface
- [ ] Efeitos
- [ ] Sons
- [ ] Animações
- [ ] Feedback visual
- [ ] Balanceamento
- [ ] Salvamento

## Fase 10 — Desktop
- [ ] Integração com Electron
- [ ] Build
- [ ] Testes
- [ ] Geração do executável
- [ ] Criação do instalador

---

**Status atual:** Fases 1-4 implementadas e testadas em jogo (fundação, mapa, personagem/movimentação/pathfinding e agricultura). Fase 5 (Economia) ainda não iniciada.
