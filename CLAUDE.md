# CLAUDE.md — Mini Fazenda

Este arquivo estabelece regras permanentes para qualquer trabalho de desenvolvimento neste projeto. Ele tem prioridade sobre suposições genéricas de "boas práticas" quando houver conflito.

## Natureza do projeto

Mini Fazenda é um jogo 2D de fazenda, inspirado na experiência da Mini Fazenda do Orkut, desenvolvido **de forma incremental e por etapas**. Cada etapa deve ser pequena, testável e alinhada ao [docs/ROADMAP.md](docs/ROADMAP.md) atual. Não existe pressa para chegar à versão final — existe compromisso com uma base sólida.

## Regras permanentes

### 1. Respeitar o roadmap
Todo trabalho deve corresponder à fase atual descrita em [docs/ROADMAP.md](docs/ROADMAP.md).

### 2. Trabalhar de forma incremental
O projeto deve evoluir por etapas pequenas e verificáveis, cada uma construída sobre a anterior.

### 3. Não implementar funcionalidades futuras sem solicitação explícita
Não antecipar sistemas de fases futuras do roadmap — mesmo que pareçam simples ou relacionados. Sistemas como agricultura, economia, construções, decoração, animais, recursos e progressão só devem ser implementados quando o usuário pedir explicitamente aquela etapa. Ver também [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md).

### 4. Analisar a arquitetura antes de fazer alterações relevantes
Antes de qualquer mudança não trivial, ler os arquivos e módulos afetados para entender o estado atual antes de propor ou escrever código.

### 5. Explicar brevemente a abordagem antes de alterações relevantes
Para mudanças não triviais, descrever em poucas frases o que será feito e por quê antes de implementar — não é necessário para ajustes triviais.

### 6. Manter o código modular
Separar responsabilidades em módulos com fronteiras claras: cenas, entidades, sistemas, dados, assets, mapas e UI. Ver [docs/TECHNICAL.md](docs/TECHNICAL.md) para a organização planejada. Evitar arquivos monolíticos que concentrem lógica de múltiplas responsabilidades.

### 7. Preservar funcionalidades existentes
Alterações não podem quebrar comportamento já funcionando, a menos que a mudança seja exatamente sobre substituir esse comportamento.

### 8. Não alterar funcionalidades não relacionadas à tarefa
Mudanças devem ficar restritas ao escopo pedido. Não aproveitar a tarefa para refatorar, "limpar" ou alterar código não relacionado.

### 9. Testar as alterações realizadas
Toda alteração relevante deve ser verificada (execução do jogo, testes automatizados quando existirem, ou inspeção funcional direta) antes de considerar a tarefa concluída.

### 10. Corrigir problemas encontrados
Se uma verificação revelar um problema, corrigi-lo faz parte da tarefa — não deixar para depois nem reportar como "funciona, mas com esse detalhe".

### 11. Evitar dependências desnecessárias
Só adicionar bibliotecas quando houver necessidade real e justificada. Não instalar pacotes "por precaução" ou "para o futuro".

### 12. Não criar artes utilizando código
Nunca gerar elementos visuais via HTML, CSS, SVG, emojis ou formas desenhadas programaticamente. Todo elemento visual deve vir de assets externos (sprites, spritesheets, tilesets, imagens). A lógica do jogo deve ser independente dos assets, permitindo substituí-los sem reescrever sistemas.

## Escopo tecnológico

- TypeScript + Phaser + Vite para o desenvolvimento do jogo.
- Electron será integrado **apenas na Fase 10** do roadmap, para empacotamento desktop. Não instalar ou configurar Electron antes disso.
- A arquitetura do jogo deve ser escrita de forma independente da camada de empacotamento, para que a integração futura com Electron não exija reescrever a lógica principal.

## Escopo de design

Este é exclusivamente um jogo de fazenda, inspirado na experiência da Mini Fazenda do Orkut. Educação, produtividade, tarefas educacionais, conteúdo educacional e qualquer integração entre estudo e jogo estão fora de escopo e não devem ser propostas ou implementadas.

## Estado atual

O projeto está na fase de fundação e documentação. Nenhuma funcionalidade de jogo foi implementada ainda. Consulte [docs/ROADMAP.md](docs/ROADMAP.md) para saber o que está liberado para desenvolvimento no momento.
