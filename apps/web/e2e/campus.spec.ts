import { test, expect, type Page } from '@playwright/test';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGNIaEgAIgYIBQAjDgUBB5BfMwAAAABJRU5ErkJggg==', 'base64');
async function register(page: Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: '还没有账号？立即注册' }).click();
  await page.getByLabel('昵称', { exact: true }).fill('测试邻居');
  await page.getByLabel('邮箱', { exact: true }).fill(`e2e-${crypto.randomUUID()}@example.test`);
  await page.getByLabel('密码（12–128字符）', { exact: true }).fill('Campus-test-2026!');
  await page.getByRole('button', { name: '创建账号', exact: true }).click();
  await expect(page.getByRole('link', { name: '我的资料', exact: true })).toBeVisible();
}
test('two students complete a real sale; payment preview has no effect', async ({ browser }) => {
  const sellerContext = await browser.newContext({baseURL:'http://127.0.0.1:5173'});
  const buyerContext = await browser.newContext({baseURL:'http://127.0.0.1:5173'});
  const seller = await sellerContext.newPage();
  const buyer = await buyerContext.newPage();
  try {
    await register(seller);
    await seller.goto('/publish');
    const title = `测试教材 ${Date.now()}`;
    await seller.getByLabel('商品标题', { exact: true }).fill(title);
    await seller.getByLabel('描述', { exact: true }).fill('用于端到端测试的虚构商品');
    await seller.getByLabel('价格（元）', { exact: true }).fill('25');
    await seller
      .getByRole('combobox', { name: '分类', exact: true })
      .selectOption('11111111-1111-4111-8111-111111111111');
    await seller
      .getByRole('combobox', { name: '楼栋 / 校园地点', exact: true })
      .selectOption('22222222-2222-4222-8222-222222222221');
    await seller
      .getByLabel('上传图片', { exact: true })
      .setInputFiles({ name: 'book.png', mimeType: 'image/png', buffer: png });
    await expect(seller.getByRole('button', { name: '保存并查看' })).toBeEnabled();
    await seller.getByRole('button', { name: '保存并查看' }).click();
    await expect(seller.getByRole('heading', { name: title, exact: true })).toBeVisible();
    const listingUrl = seller.url();
    await register(buyer);
    await buyer.goto(listingUrl);
    await buyer.getByRole('button', { name: '联系卖家', exact: true }).click();
    await buyer.getByRole('button', { name: '问价格', exact: true }).click();
    await buyer.getByRole('button', { name: '发送', exact: true }).click();
    await expect(buyer.locator('.message').filter({ hasText: '请问价格是多少？' })).toBeVisible();
    await seller.goto('/messages');
    await seller.locator('.conversation').filter({ hasText: title }).click();
    await seller.getByLabel('面交地点', { exact: true }).fill('示例图书馆');
    await seller.getByLabel('面交时间', { exact: true }).fill('2027-01-01T16:00');
    await seller.getByRole('button', { name: '预约', exact: true }).click();
    await expect(seller.getByText('预约已建立', { exact: true })).toBeVisible();
    const tradeUrl = seller.url();
    await buyer.goto(tradeUrl);
    await buyer.getByRole('link', { name: /Pay/ }).click();
    await expect(buyer.getByRole('heading', { name: '暂时无法提供支付方式' })).toBeVisible();
    await buyer.goto(tradeUrl);
    await expect(buyer.getByText('待面交', { exact: true })).toBeVisible();
    buyer.once('dialog', (dialog) => dialog.accept());
    await buyer.getByRole('button', { name: '确认收货', exact: true }).click();
    await expect(buyer.getByText('交易已完成', { exact: true })).toBeVisible();
    await buyer.getByRole('textbox', { name: '评价内容' }).fill('测试交易完成');
    await buyer.getByRole('button', { name: '提交评价' }).click();
    await expect(buyer.getByText('测试交易完成', { exact: true })).toBeVisible();
  } finally {
    await sellerContext.close();
    await buyerContext.close();
  }
});
test('English dark mobile layout remains within the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: '切换语言', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Your once-loved/ })).toBeVisible();
  await page.getByRole('button', { name: 'Switch theme', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
