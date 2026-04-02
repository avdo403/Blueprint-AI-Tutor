import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  let errorCount = 0;
  page.on('pageerror', error => {
    if (errorCount < 5) {
      console.log(`[Browser Error]: ${error.message}\n${error.stack}`);
      errorCount++;
    }
  });
  
  page.on('console', msg => {
    if (msg.type() === 'error' && errorCount < 5) {
      console.log(`[Browser Console] ERROR: ${msg.text()}`);
      errorCount++;
    } else if (msg.type() !== 'error') {
      console.log(`[Browser Console] ${msg.type().toUpperCase()}: ${msg.text()}`);
    }
  });
  
  page.on('requestfailed', request => {
    console.log(`[Browser Request Failed]: ${request.url()} - ${request.failure()?.errorText}`);
  });

  page.on('response', response => {
    if (!response.ok()) {
      console.log(`[Browser Response Error]: ${response.status()} ${response.url()}`);
    }
  });

  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 10000 });
    
    // Simulate pasting text
    await page.evaluate(() => {
      const input = document.querySelector('#blueprint-input');
      if (input) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        nativeInputValueSetter.call(input, 'Begin Object Class=/Script/Engine.Actor Name="MyActor" End Object');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    
    // Wait a bit for React to update
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if blueprint rendered
    const uebInfo = await page.evaluate(() => {
      const ueb = document.querySelector('ueb-blueprint');
      const isDefined = customElements.get('ueb-blueprint') !== undefined;
      if (!ueb) return `Not found, isDefined: ${isDefined}`;
      
      const hasHeader = !!ueb.querySelector('.ueb-viewport-header');
      const gridContent = ueb.querySelector('.ueb-grid-content');
      const hasExplanation = gridContent ? !!gridContent.querySelector('.bg-neutral-900') : false;
      return `Found, isDefined: ${isDefined}, hasHeader: ${hasHeader}, hasExplanation: ${hasExplanation}, innerHTML: ${ueb.innerHTML.substring(0, 100)}`;
    });
    console.log(`[Test] Blueprint info: ${uebInfo}`);
    
  } catch (e) {
    console.log('Navigation error:', e.message);
  }
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  await browser.close();
})();
