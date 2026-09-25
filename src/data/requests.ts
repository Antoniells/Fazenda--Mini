/**
 * PEDIDOS: missões secundárias e repetíveis dos moradores (além da campanha, `data/campaign.ts`). Cada morador tem uma lista de pedidos
 * que ele apresenta em ordem, UM por dia: cumprido, o próximo só vem no dia seguinte. As condições e recompensas usam os mesmos tipos
 * da campanha (entregar colheita/recurso, pagar moedas). Só DADOS: a regra está em `systems/requests.ts`.
 */
import type { NpcId } from './npcs';
import type { QuestRequirement, QuestReward } from './campaign';

/** Estado dos pedidos (vai pro save — `SaveData.requests`). */
export interface RequestsState {
  /** Por morador: quantos pedidos dele já foram cumpridos (é também o índice do próximo na lista dele, em ciclo). */
  completed: Partial<Record<NpcId, number>>;
  /** Por morador: só há pedido novo a partir deste dia do calendário (o de hoje já foi cumprido). */
  availableFromDay: Partial<Record<NpcId, number>>;
}

export function createRequestsState(): RequestsState {
  return { completed: {}, availableFromDay: {} };
}

export interface RequestDefinition {
  id: string;
  title: string;
  /** Fala do morador ao pedir. */
  text: string;
  requirements: QuestRequirement[];
  reward: QuestReward;
}

export const REQUESTS: Record<NpcId, RequestDefinition[]> = {
  blacksmith: [
    { id: 'bs-firewood', title: 'Lenha pra forja', text: 'A forja anda faminta! Traga-me 15 de Madeira e eu te pago bem.', requirements: [{ kind: 'deliverResource', id: 'wood', amount: 15 }], reward: { coins: 100 } },
    { id: 'bs-stone', title: 'Pedra pro molde', text: 'Preciso de pedra boa pra um molde novo: 12 de Pedra, por favor.', requirements: [{ kind: 'deliverResource', id: 'stone', amount: 12 }], reward: { coins: 90, resources: { wood: 5 } } },
    { id: 'bs-nails', title: 'Ferro pros pregos', text: 'Uns 3 de Ferro e eu faço pregos pra metade do Vilarejo. Pago à vista.', requirements: [{ kind: 'deliverResource', id: 'iron', amount: 3 }], reward: { coins: 140 } },
    { id: 'bs-goo', title: 'Gosma pra têmpera', text: 'Um cantinho de gosma de Slime deixa o aço mais duro. Me traga 6.', requirements: [{ kind: 'deliverResource', id: 'slime-goo', amount: 6 }], reward: { coins: 130, resources: { iron: 1 } } },
  ],
  banker: [
    { id: 'bk-basket', title: 'Cesta de legumes', text: 'Uma cesta de boas-vindas pra um cliente: 5 Cenouras e 5 Cebolas, bem fresquinhas.', requirements: [{ kind: 'deliverCrop', id: 'carrot', amount: 5 }, { kind: 'deliverCrop', id: 'onion', amount: 5 }], reward: { coins: 120 } },
    { id: 'bk-potatoes', title: 'Batatas pro mercado', text: 'A feira de sábado pede batatas! Traga-me 8 e eu compro na hora.', requirements: [{ kind: 'deliverCrop', id: 'potato', amount: 8 }], reward: { coins: 170 } },
    { id: 'bk-donation', title: 'Um coreto pra praça', text: 'Estamos juntando 100 moedas pro coreto da praça. Sua doação vale um agrado em materiais.', requirements: [{ kind: 'pay', coins: 100 }], reward: { resources: { wood: 20, stone: 10 } } },
    { id: 'bk-onions', title: 'Cebolas frescas', text: 'A cozinheira da pensão precisa de 10 Cebolas. Ela paga bem, e eu repasso o valor.', requirements: [{ kind: 'deliverCrop', id: 'onion', amount: 10 }], reward: { coins: 140 } },
  ],
  pirate: [
    { id: 'pi-planks', title: 'Tábuas pro casco', text: 'O casco geme a cada onda... 20 de Madeira e eu calafeto tudo.', requirements: [{ kind: 'deliverResource', id: 'wood', amount: 20 }], reward: { coins: 130 } },
    { id: 'pi-ballast', title: 'Pedras de lastro', text: 'Preciso de 15 de Pedra pro lastro. Nada como peso no fundo pra não virar.', requirements: [{ kind: 'deliverResource', id: 'stone', amount: 15 }], reward: { coins: 110, resources: { wood: 8 } } },
    { id: 'pi-anchor', title: 'Ferro pra âncora', text: 'A âncora se foi com a última tempestade. Me traga 5 de Ferro e eu forjo outra!', requirements: [{ kind: 'deliverResource', id: 'iron', amount: 5 }], reward: { coins: 220 } },
    { id: 'pi-rations', title: 'Rango de bordo', text: 'Marinheiro sem comida vira motim! Me arranje 6 Batatas.', requirements: [{ kind: 'deliverCrop', id: 'potato', amount: 6 }], reward: { coins: 120 } },
  ],
  mermaid: [
    { id: 'me-carrots', title: 'Cenouras crocantes', text: 'Nunca provei uma cenoura! Você me traz 6? Em troca eu te dou o que o mar devolveu.', requirements: [{ kind: 'deliverCrop', id: 'carrot', amount: 6 }], reward: { coins: 100, resources: { stone: 8 } } },
    { id: 'me-onions', title: 'Cebolas pro caldo', text: 'Os pescadores fazem um caldo divino, mas faltam 6 Cebolas. Você ajuda?', requirements: [{ kind: 'deliverCrop', id: 'onion', amount: 6 }], reward: { coins: 90, resources: { wood: 10 } } },
    { id: 'me-acorns', title: 'Bolotas de enfeite', text: 'Quero enfeitar meu cantinho com bolotas! Traga 5, por favor.', requirements: [{ kind: 'deliverResource', id: 'acorn', amount: 5 }], reward: { coins: 110 } },
    { id: 'me-goo', title: 'Gosma brilhante', text: 'A gosma dos Slimes brilha tanto... Me traga 4 pra eu usar de espelho.', requirements: [{ kind: 'deliverResource', id: 'slime-goo', amount: 4 }], reward: { coins: 130 } },
  ],
};
