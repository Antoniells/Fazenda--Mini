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
Toda alteração relevante deve ser verificada (execução do jogo, testes automatizados ou inspeção funcional direta) antes de considerar a tarefa concluída. Os testes automáticos são `npm test` (Vitest, lógica em `tests/unit`) e `npm run test:e2e` (Playwright, o jogo no navegador em `tests/e2e`); regra nova de lógica pura ganha teste de unidade. Detalhes em [docs/TECHNICAL.md](docs/TECHNICAL.md#testes-automáticos).

### 10. Corrigir problemas encontrados
Se uma verificação revelar um problema, corrigi-lo faz parte da tarefa — não deixar para depois nem reportar como "funciona, mas com esse detalhe".

### 11. Evitar dependências desnecessárias
Só adicionar bibliotecas quando houver necessidade real e justificada. Não instalar pacotes "por precaução" ou "para o futuro".

### 12. Não criar artes utilizando código
Nunca gerar elementos visuais via HTML, CSS, SVG, emojis ou formas desenhadas programaticamente. Todo elemento visual deve vir de assets externos (sprites, spritesheets, tilesets, imagens). A lógica do jogo deve ser independente dos assets, permitindo substituí-los sem reescrever sistemas.

## Escopo tecnológico

- TypeScript + Phaser + Vite para o desenvolvimento do jogo.
- Electron foi integrado na Fase 10 (empacotamento desktop): processo principal e preload em `electron/`, detalhes em [docs/TECHNICAL.md](docs/TECHNICAL.md#integração-com-electron-fase-10).
- Testes: Vitest (lógica, com o Phaser substituído) e Playwright (ponta a ponta, dirigindo o menu de hack).
- Ferramentas fora do jogo ficam em `tools/` (ex.: `tools/generate_intro_voices.py`, narração da intro pelo ElevenLabs — a chave da API vem sempre da variável `ELEVENLABS_API_KEY`, nunca do código).
- A arquitetura do jogo continua independente da camada de empacotamento: nada em `src/` importa Electron. Tudo que é específico de desktop (arquivos de save, tela cheia) chega ao jogo por adaptadores (`systems/storageAdapter.ts`, `systems/displayMode.ts`) que caem no comportamento de navegador quando a ponte do Electron não existe.

## Escopo de design

Este é exclusivamente um jogo de fazenda, inspirado na experiência da Mini Fazenda do Orkut. Educação, produtividade, tarefas educacionais, conteúdo educacional e qualquer integração entre estudo e jogo estão fora de escopo e não devem ser propostas ou implementadas.

## Estado atual

Versão **0.1.9**. O jogo está completo do começo ao fim: agricultura, economia, construções e melhorias, tempo e clima, recursos e mineração, Vilarejo com moradores e campanha, hordas, Cavernas de 100 andares, pesca e a história principal ("Os Três Pilares do Equilíbrio"), da cena introdutória narrada ao fim com cinemática e créditos. Consulte [docs/ROADMAP.md](docs/ROADMAP.md) para o que está pronto e o que falta — o próximo trabalho é a **Etapa 6 da Fase 11** (rodada de jogo, balanceamento e polimento de falas, sons e arte).

Convenções de trabalho que valem para todas as tarefas:
- **Menu de hack (F9)**: ferramenta de teste (`src/debug/hackMenu.ts`), só no modo de desenvolvimento (`npm run dev`); leva a qualquer cena e a qualquer marco da história.
- **Saves**: todo campo novo no `SaveData` é opcional e tem valor padrão ao carregar — saves de versões antigas precisam continuar abrindo.
- **Versão e instalador**: subir a versão no `package.json`, rodar os testes e gerar com `npm run build && npm run electron:compile && npx electron-builder --win --config.directories.output=release-<versão>` (o `npm run build:electron` puro gera em `release/`), com o `npm run dev` fechado — senão o empacotamento falha com EPERM. O instalador substitui a versão anterior instalada (`build/installer.nsh`). O `appId` não pode mudar.
- **Documentação**: cada sistema novo ganha uma seção em [docs/TECHNICAL.md](docs/TECHNICAL.md) e o seu item no roadmap.
