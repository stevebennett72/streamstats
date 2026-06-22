const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));
  
  // Click Dashboard if not there
  await page.click('a[data-target="dashboard"]');
  await new Promise(r => setTimeout(r, 500));

  // Get pie chart texts
  const html = await page.evaluate(() => document.getElementById('platform-chart-container').innerText);
  console.log('DASHBOARD PIE CHART:', html);
  
  // Click Explorer
  await page.click('a[data-target="explorer"]');
  await new Promise(r => setTimeout(r, 500));
  
  const headers = await page.evaluate(() => {
    const ths = document.querySelectorAll('.explorer-table th');
    return Array.from(ths).map(th => th.innerText).join(' | ');
  });
  console.log('EXPLORER HEADERS:', headers);

  await browser.close();
})();
