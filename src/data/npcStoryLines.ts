/**
 * Falas dos moradores que ACOMPANHAM A HISTÓRIA ("Os Três Pilares"): cada morador tem blocos de falas presos a um marco
 * (`data/story.ts`). Vale o bloco do marco MAIS AVANÇADO já alcançado — assim o Vilarejo comenta a Azurita depois do andar 45, o
 * castelo da Floresta, o santuário e, depois do fim, a falta que o companheiro faz. Quem sorteia (e decide quando a fala da história
 * aparece no lugar da conversa solta) é `systems/npcLines.ts`. Só DADOS.
 */
import type { NpcId, PortraitExpression } from './npcs';
import type { StoryMilestoneId } from './story';

export interface NpcLine {
  text: string;
  /** Expressão do retrato (a folha que não tem cai no neutro). */
  expression?: PortraitExpression;
}

export interface NpcStoryBlock {
  /** Marco a partir do qual o bloco vale. */
  after: StoryMilestoneId;
  lines: NpcLine[];
}

export const NPC_STORY_LINES: Record<NpcId, NpcStoryBlock[]> = {
  blacksmith: [
    {
      after: 'prophecy',
      lines: [
        { text: 'Uma carta falando de pilares e de um Sábio Coelho? Meu avô contava essa história perto da forja...', expression: 'thoughtful' },
        { text: 'Se a profecia fala das profundezas, você vai precisar de uma picareta de respeito. Passe aqui antes de descer.' },
      ],
    },
    {
      after: 'azurite',
      lines: [
        { text: 'Azurita?! Faz trinta anos que ninguém traz uma dessas pro Vilarejo!', expression: 'surprised' },
        { text: 'Cinco Azuritas Brutas e uma Barra de Ouro na Fornalha: é assim que se doma essa pedra teimosa.', expression: 'happy' },
      ],
    },
    {
      after: 'barrier',
      lines: [
        { text: 'Uma barreira no andar 50... Nenhum metal que eu conheço atravessa magia. Isso é coisa pra mais que um ferreiro.', expression: 'thoughtful' },
      ],
    },
    {
      after: 'hiddenForest',
      lines: [{ text: 'Um castelo engolido pelas árvores, e um Mago lá dentro? Eu achava que isso era conversa de taverna!', expression: 'surprised' }],
    },
    {
      after: 'enchantedPickaxe',
      lines: [
        { text: 'Deixa eu ver essa picareta... Ela zune na minha mão! O Mago sabe o que faz.', expression: 'happy' },
        { text: 'Minha forja faz o metal; a magia faz o resto. Juntos, nenhuma barreira aguenta.', expression: 'content' },
      ],
    },
    {
      after: 'sanctuary',
      lines: [{ text: 'Você venceu a Horda do fundo das Cavernas?! Que orgulho de ter afiado essa espada!', expression: 'happy' }],
    },
    {
      after: 'awakening',
      lines: [
        { text: 'Soube do seu companheiro... Sinto muito. Ele deu tudo pra este mundo voltar a respirar.', expression: 'sad' },
        { text: 'Às vezes eu paro o martelo e fico ouvindo o silêncio. Nenhum monstro, nenhuma horda. Foi você quem fez isso.', expression: 'content' },
      ],
    },
    {
      after: 'newPet',
      lines: [{ text: 'Um filhote novo na Fazenda! Traga ele aqui um dia: prometo não deixar ele morder o avental.', expression: 'happy' }],
    },
  ],
  banker: [
    {
      after: 'prophecy',
      lines: [{ text: 'Uma profecia? Minha avó dizia que a Cenoura Dourada deixa qualquer bolo perfeito. Coisa de lenda, claro...', expression: 'content' }],
    },
    {
      after: 'barrier',
      lines: [{ text: 'Uma barreira mágica debaixo da terra? E eu preocupado com o fermento que não cresce!', expression: 'surprised' }],
    },
    {
      after: 'hiddenForest',
      lines: [{ text: 'Esse Mago da Floresta come pão? Leve um pra ele. Mago com fome não encanta nada direito.', expression: 'happy' }],
    },
    {
      after: 'sanctuary',
      lines: [{ text: 'Um santuário no fundo das Cavernas... Dizem que a Cenoura Dourada nasce onde a terra perdoa. Bonito, não?', expression: 'content' }],
    },
    {
      after: 'goldenCarrot',
      lines: [{ text: 'Você viu a Cenoura Dourada de verdade?! Não, não, eu não vou pedir um pedaço. ...Talvez só uma casquinha.', expression: 'happy' }],
    },
    {
      after: 'awakening',
      lines: [
        { text: 'Fiz um pão em forma de patinha pro seu companheiro. É bobagem, eu sei... mas o forno parecia pedir.' },
        { text: 'O Vilarejo inteiro dormiu tranquilo esta semana. Faz tempo que eu não via isso.', expression: 'content' },
      ],
    },
    {
      after: 'newPet',
      lines: [{ text: 'Filhote novo? Guardei um biscoito sem sal pra ele. Padeiro que é padeiro pensa em todo mundo!', expression: 'happy' }],
    },
  ],
  pirate: [
    {
      after: 'prophecy',
      lines: [{ text: 'Profecias, arr! Já naveguei por sete delas e só uma era verdade. Tomara que a sua seja a boa.' }],
    },
    {
      after: 'map',
      lines: [{ text: 'Um mapa num baú esquecido? Isso eu entendo, marujo! Siga o X e nunca o caminho fácil.' }],
    },
    {
      after: 'goldenFish',
      lines: [{ text: 'O Peixe Dourado?! Quarenta anos de mar e nunca vi nem a sombra dele. Você é um pescador de lenda!' }],
    },
    {
      after: 'awakening',
      lines: [{ text: 'No mar a gente diz: quem parte por amor vira vento a favor. Seu companheiro sopra suas velas agora.' }],
    },
    {
      after: 'newPet',
      lines: [{ text: 'Todo capitão precisa de um imediato. Esse filhote vai ser um grande marujo, arr!' }],
    },
  ],
  mermaid: [
    {
      after: 'prophecy',
      lines: [{ text: 'As ondas andam agitadas... O mar sente quando a terra perde o equilíbrio.' }],
    },
    {
      after: 'wizardTrust',
      lines: [{ text: 'O Mago pediu peixes? Ele sempre teve bom gosto. Cuide bem da sua linha: a paciência é metade da pescaria.' }],
    },
    {
      after: 'goldenFish',
      lines: [{ text: 'O Peixe Dourado escolheu você. Ele só se deixa pescar por quem tem o coração em paz.' }],
    },
    {
      after: 'awakening',
      lines: [{ text: 'O mar ficou calmo como nunca. Acho que ele também está de luto... e grato.' }],
    },
  ],
  supplier: [
    {
      after: 'prophecy',
      lines: [{ text: 'Uma semente dourada? Não tenho essa no estoque, mas se encontrar, me conte como ela brota!' }],
    },
    {
      after: 'sanctuary',
      lines: [{ text: 'A semente da Cenoura Dourada saiu da própria terra? Plante com carinho: semente rara é semente teimosa.' }],
    },
    {
      after: 'goldenCarrot',
      lines: [{ text: 'Você colheu a Cenoura Dourada! Todo agricultor sonha com uma colheita dessas, e você conseguiu.' }],
    },
    {
      after: 'awakening',
      lines: [{ text: 'A terra está mais macia, as mudas brotam mais rápido... O mundo voltou a respirar, graças a vocês dois.' }],
    },
  ],
  carpenter: [
    {
      after: 'hiddenForest',
      lines: [{ text: 'Um castelo tomado pelas árvores? Madeira velha assim ainda aguenta... queria ver essas vigas de perto!' }],
    },
    {
      after: 'barrierBroken',
      lines: [{ text: 'Ouvi um estrondo vindo das Cavernas ontem. Foi você? Espero que não tenha desabado nada lá embaixo!' }],
    },
    {
      after: 'awakening',
      lines: [{ text: 'Fiz uma casinha nova pro próximo bichinho da Fazenda. Quando estiver pronto, ela está esperando.' }],
    },
  ],
};
