const { Builder, By, Key, until } = require('selenium-webdriver');
const safari = require('selenium-webdriver/safari');
const chrome = require('selenium-webdriver/chrome');

let safariOptions = new safari.Options();
let chromeOpts = new chrome.Options();
chromeOpts.headless();


async function search(fileLoc) {
  let driver = await new Builder().forBrowser('chrome')
    .setChromeOptions(chromeOpts)
    .build();
  try {
    await driver.get('https://blast.ncbi.nlm.nih.gov/blast/Blast.cgi?PROGRAM=blastn&PAGE_TYPE=BlastSearch');
    await driver.findElement(By.name('QUERYFILE')).sendKeys(fileLoc);
    await (await driver.findElement(By.id('b1'))).click();
    await driver.wait(until.elementLocated(By.id('ulDnldAl')));
    let allDlList = await driver.findElement(By.id('allDownload'));
    let txtDlElem = await allDlList.findElement(By.xpath('//a[contains(@href,"FORMAT_TYPE=Text")]'));
    let jsonDlElem = await allDlList.findElement(By.xpath('//a[contains(@href,"FORMAT_TYPE=JSON2_S")]'));

    let jsonDlLink = await jsonDlElem.getAttribute('href');
    let txtDlLink = await txtDlElem.getAttribute('href');
    // await driver.wait(until.titleIs('webdriver - Google Search'), 100000);
    console.log(`dl links JSON:${jsonDlLink} TXT:${txtDlLink}`);
    await Promise.all([
      download(jsonDlLink, './jsonDat.json'),
      download(txtDlLink, './textDat.txt')
    ]);
    console.log('done downloads');
  } finally {
    // await driver.quit();
  }
}

/**
 * Downloads file from remote HTTP[S] host and puts its contents to the
 * specified location.
 */
async function download(url, filePath) {
  const proto = !url.charAt(4).localeCompare('s') ? https : http;

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);
    let fileInfo = null;

    const request = proto.get(url, response => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
        return;
      }

      fileInfo = {
        mime: response.headers['content-type'],
        size: parseInt(response.headers['content-length'], 10),
      };

      response.pipe(file);
    });

    // The destination stream is ended by the time it's called
    file.on('finish', () => resolve(fileInfo));

    request.on('error', err => {
      fs.unlink(filePath, () => reject(err));
    });

    file.on('error', err => {
      fs.unlink(filePath, () => reject(err));
    });

    request.end();
  });
}

module.exports = {
  search
}