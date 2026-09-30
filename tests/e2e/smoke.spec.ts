import { expect, test, type Page } from '@playwright/test';

/**
 * Teste de fumaça: o jogo abre, o menu de hack (F9) cria uma partida de teste e percorre as cenas. Falha com qualquer erro de
 * execução não tratado na página (`pageerror`). Os avisos de console do Phaser ("Texture key already in use") não contam.
 */

/** Abre o jogo, liga o menu de hack e cria a partida de teste na Fazenda. Devolve a lista de erros da página (vai enchendo). */
async function startTestGame(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.waitForSelector('canvas');
  await page.keyboard.press('F9');
  await page.getByRole('button', { name: 'Fazenda', exact: true }).click();
  await expect(hackLog(page)).toContainText('Partida de teste criada');
  // A Fazenda termina de carregar (o menu registra a cena depois do `create`).
  await expect(hackLog(page)).toContainText('Fazenda pronta', { timeout: 60_000 });
  return errors;
}

/** O registro do menu de hack (as últimas ações, a mais nova em cima). */
function hackLog(page: Page) {
  return page.locator('#hack-menu-log');
}

async function chooseStoryMilestone(page: Page, index: number): Promise<void> {
  await page.locator('#hack-menu select').selectOption(String(index));
  await page.getByRole('button', { name: 'Alcançar até aqui' }).click();
}

test('o tour passa por todas as cenas sem erros', async ({ page }) => {
  const errors = await startTestGame(page);
  await page.getByRole('button', { name: 'Ferramentas/armas/armaduras' }).click();
  await page.getByRole('button', { name: /^Iniciar/ }).click();
  await expect(hackLog(page)).toContainText('Tour terminado', { timeout: 180_000 });
  await expect(hackLog(page)).toContainText('0 erro(s)');
  expect(errors).toEqual([]);
});

test('a história: Floresta Oculta, andar 50, santuário e o fim', async ({ page }) => {
  const errors = await startTestGame(page);
  await page.getByRole('button', { name: 'Itens da história' }).click();

  // Com o mapa: a Floresta Oculta (a torre, o Mago e a Mesa).
  await chooseStoryMilestone(page, 3);
  await page.getByRole('button', { name: 'Floresta Oculta' }).click();
  await expect(hackLog(page)).toContainText('Cena: Floresta Oculta');
  await page.waitForTimeout(4000);

  // O andar 50 (a barreira e o baú).
  const floor = page.locator('#hack-menu input[type=number]');
  await floor.fill('50');
  await page.getByRole('button', { name: 'Ir', exact: true }).click();
  await page.waitForTimeout(4000);

  // O santuário do andar 100.
  await chooseStoryMilestone(page, 8);
  await floor.fill('100');
  await page.getByRole('button', { name: 'Ir', exact: true }).click();
  await page.waitForTimeout(5000);

  // A cinemática final e a tela do epílogo.
  await page.getByRole('button', { name: 'Cinemática final' }).click();
  await page.waitForTimeout(20_000);

  expect(errors).toEqual([]);
});

test('a cena introdutória avança com F e Espaço e o ESC leva à Fazenda', async ({ page }) => {
  const errors = await startTestGame(page);
  await page.getByRole('button', { name: 'Cena introdutória' }).click();
  await expect(hackLog(page)).toContainText('Cena: Cena introdutória');
  await page.waitForTimeout(3000);
  for (const key of ['f', 'f', 'Space', 'Space']) {
    await page.keyboard.press(key);
    await page.waitForTimeout(900);
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(4000);
  expect(errors).toEqual([]);
});
