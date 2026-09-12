# Game Design — Mini Fazenda

> Este documento descreve o conceito e a visão de design do projeto. Ele **não é uma especificação fechada**: os sistemas aqui descritos podem evoluir, ser ajustados ou reordenados conforme o desenvolvimento avança. Consulte sempre [ROADMAP.md](ROADMAP.md) para saber o que está de fato em desenvolvimento agora.

## Conceito

Mini Fazenda é um jogo 2D de fazenda, inspirado na **experiência** da Mini Fazenda original (Orkut), mas trazendo a **progressão modular de expansão** vista em jogos como *Forager*. A referência é de conceito e sensação de jogo — não uma cópia. O projeto deve construir identidade visual e de regras próprias.

O jogador possui uma propriedade e a administra: planta, colhe, cuida de animais, compra objetos, constrói, decora e **expande sua fazenda bloco a bloco** ao longo do tempo. O jogador não planta apenas para enriquecer, ele planta para gerar os recursos necessários para desbloquear mais do mundo.

## Pilares da experiência

- Possuir uma propriedade.
- Plantar e Colher.
- Cuidar de animais.
- Comprar objetos e Construir.
- Administrar recursos (Dinheiro, Madeira, Pedra).
- **Expandir a fazenda (Estilo Forager):** Comprar acesso a novas áreas de terra.
- Ganhar e gastar moedas.
- Desbloquear novos conteúdos progressivamente.

## Visão de jogabilidade

A jogabilidade deve priorizar **simplicidade, acessibilidade e diversão**, com interação direta sobre o mapa em vez de menus complexos ou comandos elaborados. O jogo deve ser confortável tanto para sessões curtas quanto longas, com curva de aprendizado suave.

### Loop de interação principal

Quando o jogador clica em um elemento interativo do mapa, o personagem deve:

1. Encontrar um caminho válido até o local (pathfinding).
2. Caminhar até o destino.
3. Executar a ação correspondente ao elemento clicado.
4. Atualizar o estado do mundo como resultado da ação.

Esse loop é a espinha dorsal da jogabilidade: praticamente toda ação do jogador passa por ele.

### O Macro Loop (A Motivação)

1. **Produzir:** Plantar sementes, regar, colher e vender.
2. **Coletar:** Cortar árvores e quebrar pedras nos espaços disponíveis.
3. **Expandir:** Usar moedas e materiais (madeira/pedra) para consertar pontes quebradas ou comprar placas que desbloqueiam blocos de terreno adjacentes.
4. **Descobrir:** Cada nova área desbloqueada traz algo novo (um NPC, novos recursos, áreas de pesca ou pastos).

## Sistemas futuros (exemplos, não definitivos)

O projeto poderá, ao longo do desenvolvimento, incorporar:

- **Agricultura** — arar, plantar, regar e colher, com plantações passando por estágios de crescimento.
- **Economia** — moedas, inventário, compra e venda, loja.
- **Construções e decoração** — estruturas e objetos decorativos posicionáveis na propriedade.
- **Tempo e Ciclo** — relógio interno que controla a passagem dos dias, essencial para o crescimento de árvores, respawn de recursos e produção animal.
- **Animais e recursos** — criação de animais, árvores, pedras e outros recursos coletáveis.
- **Progressão e Expansão** — experiência, níveis, desbloqueio de novos terrenos "chunk by chunk" e liberação de novos itens.

## Princípios de gameplay

- **Interação simples**: clicar é a forma principal de agir no mundo.
- **Feedback claro**: o jogador sempre entende o que está acontecendo (personagem se movendo, ação em execução, mundo mudando).
- **Progressão gradual**: novos sistemas se abrem aos poucos, sem sobrecarregar o jogador.
- **Consistência visual e de regras**: elementos do mundo se comportam de forma previsível.
- **Extensibilidade**: novos tipos de terreno, ação, cultivo, animal ou construção devem poder ser adicionados sem redesenhar os sistemas existentes.

## Fora de escopo

Este é exclusivamente um jogo de fazenda. Educação, produtividade, tarefas educacionais, conteúdo educacional, integração entre estudo e jogo, multiplayer, monetização e narrativa elaborada não fazem parte da visão do projeto e não devem ser assumidos como planejados.