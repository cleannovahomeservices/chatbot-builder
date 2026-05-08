const { launch } = require('puppeteer-core');

(async () => {
  const browser = await launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 600, height: 500 });

  // Screenshot the production site - dashboard customize panel
  // First check if Vercel deploy is done by loading the page
  await page.goto('https://chatbot-builder-iota.vercel.app/create', { waitUntil: 'networkidle2', timeout: 30000 });
  await page.screenshot({ path: 'C:/Users/Usuario/Pictures/Screenshots/icons_production.png' });
  await browser.close();
  console.log('done');
})().catch(console.error);
