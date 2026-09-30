/**
 * A Fazenda de uma partida NOVA já nasce com algumas cercas da lavoura quebradas ("col,row", o perímetro da lavoura original — `data/maps/farmMap.ts`, colunas 13-26 e linhas 12-21;
 * o portão, em frente à porta da casa, fica de fora): dão o que fazer logo de cara — comprar o Martelo no Ferreiro e consertá-las (`systems/farmFences.ts`). Vão pro `gameState.destroyedFences`.
 */
export const STARTER_BROKEN_FENCES: string[] = ['13,16', '26,14', '22,21', '15,12'];
