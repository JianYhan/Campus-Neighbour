import {
  test,
  expect,
  type APIRequestContext,
  type APIResponse,
  type BrowserContext,
  type Page,
} from '@playwright/test';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGNIaEgAIgYIBQAjDgUBB5BfMwAAAABJRU5ErkJggg==',
  'base64',
);
const widths = [360, 390, 768, 1440];

type Identity = { request: APIRequestContext; csrf: string };

async function responseData(response: APIResponse) {
  expect(response.ok(), `${response.url()}: ${await response.text()}`).toBe(true);
  return (await response.json()).data;
}

async function register(context: BrowserContext, nickname: string): Promise<Identity> {
  const request = context.request;
  const firstToken = await responseData(await request.get('/api/v1/auth/csrf'));
  const credentials = {
    email: `dual-view-${crypto.randomUUID()}@example.test`,
    password: 'Campus-test-2026!',
  };
  await responseData(
    await request.post('/api/v1/auth/register', {
      headers: { 'X-CSRF-TOKEN': firstToken.token },
      data: { ...credentials, nickname },
    }),
  );
  await responseData(
    await request.post('/api/v1/auth/login', {
      headers: { 'X-CSRF-TOKEN': firstToken.token },
      data: credentials,
    }),
  );
  // Context requests share the browser's session cookie. Login rotates the CSRF token.
  const token = await responseData(await request.get('/api/v1/auth/csrf'));
  return { request, csrf: token.token };
}

async function post(identity: Identity, path: string, data: unknown) {
  return responseData(
    await identity.request.post('/api/v1' + path, {
      headers: {
        'X-CSRF-TOKEN': identity.csrf,
        'Idempotency-Key': crypto.randomUUID(),
      },
      data,
    }),
  );
}

async function createListing(identity: Identity) {
  const image = await responseData(
    await identity.request.post('/api/v1/images', {
      headers: { 'X-CSRF-TOKEN': identity.csrf },
      multipart: { file: { name: 'dual-view.png', mimeType: 'image/png', buffer: png } },
    }),
  );
  const categories = await responseData(
    await identity.request.get('/api/v1/dictionaries/categories'),
  );
  const buildings = await responseData(
    await identity.request.get('/api/v1/dictionaries/buildings'),
  );
  expect(categories.items.length).toBeGreaterThan(0);
  expect(buildings.items.length).toBeGreaterThan(0);
  return post(identity, '/listings', {
    title: `双视图测试教材 ${crypto.randomUUID().slice(0, 8)}`,
    description: '双视图测试使用的虚构教材，检查手机与电脑操作。',
    priceMinor: 2500,
    categoryId: categories.items[0].id,
    buildingId: buildings.items[0].id,
    conditionCode: 'GOOD',
    imageIds: [image.id],
    swapEnabled: false,
  });
}

async function expectNoHorizontalOverflow(page: Page, width: number) {
  await page.setViewportSize({ width, height: width >= 768 ? 960 : 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), {
      message: `The page must fit a ${width}px viewport without horizontal scrolling`,
    })
    .toBe(true);
}

test('desktop and mobile navigation switch and the market fits all supported widths', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/');
  await expect(page.locator('.site-header .top-nav')).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: '移动导航', includeHidden: true }),
  ).toBeHidden();

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileNav = page.getByRole('navigation', { name: '移动导航' });
  await expect(page.locator('.site-header .top-nav')).toBeHidden();
  await expect(mobileNav).toBeVisible();
  await expect(mobileNav.getByRole('link', { name: /发布/ })).toBeVisible();
  for (const width of widths) await expectNoHorizontalOverflow(page, width);

  // The same navigation remains accessible after switching languages.
  await page.getByRole('button', { name: '切换语言', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
});

test('real conversation adapts to a mobile thread and preserves a draft across resizing', async ({
  browser,
  baseURL,
}) => {
  const sellerContext = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 960 },
  });
  const buyerContext = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 960 },
  });
  try {
    const sellerIdentity = await register(sellerContext, '双视图卖家');
    const buyerIdentity = await register(buyerContext, '双视图买家');
    const listing = await createListing(sellerIdentity);
    const conversation = await post(buyerIdentity, '/conversations', { listingId: listing.id });
    const buyer = await buyerContext.newPage();
    await buyer.goto(`/messages/${conversation.id}`);
    const chatPanel = buyer.locator('.chat-layout .chat-panel');
    const conversations = buyer.locator('.chat-layout .conversation-list');
    const composer = chatPanel.getByRole('textbox', { name: '消息', exact: true });
    await expect(conversations).toBeVisible();
    await expect(chatPanel).toBeVisible();
    await composer.fill('这本书还有吗？');

    await buyer.setViewportSize({ width: 390, height: 844 });
    await expect(conversations).toBeHidden();
    await expect(chatPanel).toBeVisible();
    await expect(chatPanel.locator('.mobile-chat-back')).toBeVisible();
    await expect(composer).toHaveValue('这本书还有吗？');
    for (const width of widths) {
      await expectNoHorizontalOverflow(buyer, width);
      await expect(composer).toHaveValue('这本书还有吗？');
      if (width <= 720) {
        await expect.poll(() => buyer.evaluate(() =>
          document.querySelector('.composer')!.getBoundingClientRect().bottom <=
          document.querySelector('.bottom-nav')!.getBoundingClientRect().top,
        )).toBe(true);
      }
    }
    await expect(conversations).toBeVisible();
    await expect(chatPanel.locator('.mobile-chat-back')).toBeHidden();

    // Sending from the adapted view still reaches the other account in the real database.
    await chatPanel.getByRole('button', { name: '发送', exact: true }).click();
    await expect(chatPanel.locator('.message').filter({ hasText: '这本书还有吗？' })).toBeVisible();
    const seller = await sellerContext.newPage();
    await seller.goto(`/messages/${conversation.id}`);
    await expect(
      seller.locator('.chat-panel .message').filter({ hasText: '这本书还有吗？' }),
    ).toBeVisible();

    await buyer.setViewportSize({ width: 390, height: 844 });
    await chatPanel.locator('.mobile-chat-back').click();
    await expect(buyer).toHaveURL(/\/messages$/);
    await expect(conversations).toBeVisible();
    await expect(chatPanel).toBeHidden();
    await conversations.getByRole('link').filter({ hasText: listing.title }).click();
    await expect(buyer).toHaveURL(new RegExp(`/messages/${conversation.id}$`));
    await expect(conversations).toBeHidden();
    await expect(chatPanel).toBeVisible();
  } finally {
    await sellerContext.close();
    await buyerContext.close();
  }
});

test('listing edit fields keep unsaved changes across desktop and mobile layouts', async ({
  page,
  context,
}) => {
  const identity = await register(context, '编辑测试邻居');
  const listing = await createListing(identity);
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(`/edit/${listing.id}`);
  const title = page.getByLabel('商品标题', { exact: true });
  const description = page.getByRole('textbox', { name: '描述', exact: true });
  const price = page.getByLabel('价格（元）', { exact: true });
  await expect(title).toHaveValue(listing.title);
  await title.fill('尚未保存的教材标题');
  await description.fill('切换电脑与手机布局后应保留这段未保存的说明。');
  await price.fill('32.50');
  for (const width of [390, 360, 768, 1440]) {
    await expectNoHorizontalOverflow(page, width);
    await expect(title).toHaveValue('尚未保存的教材标题');
    await expect(description).toHaveValue('切换电脑与手机布局后应保留这段未保存的说明。');
    await expect(price).toHaveValue('32.50');
  }
  const stored = await responseData(await identity.request.get(`/api/v1/listings/${listing.id}`));
  expect(stored.title).toBe(listing.title);
  expect(stored.priceMinor).toBe(2500);
});
