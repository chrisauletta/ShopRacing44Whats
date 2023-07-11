const puppeteer = require('puppeteer-core');

(async () => {
  try {
    const browserFetcher = puppeteer.createBrowserFetcher();
    const revisionInfo = await browserFetcher.revisionInfo(puppeteer.chromiumRevision);

    console.log('Chromium está instalado.');
    console.log('Caminho do executável:', revisionInfo.executablePath);
  } catch (error) {
    console.log('Chromium não está instalado ou ocorreu um erro:', error);
  }
})();