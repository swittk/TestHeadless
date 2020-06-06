const { Builder, By, Key, until } = require('selenium-webdriver');
const fs = require('fs');
const http = require('http');
const https = require('https');
const safari = require('selenium-webdriver/safari');
const chrome = require('selenium-webdriver/chrome');
const { exec } = require('child_process');
const unzipper = require('unzipper')
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
// const chromeDriverDownloads = 'http://chromedriver.storage.googleapis.com/index.html';
const fileLoc = '/Users/swittkongdachalert/Downloads/liceTrimmed copy.txt';


async function main() {
  let safariOptions = new safari.Options();
  let chromeOpts = new chrome.Options();
  chromeOpts.headless();
  chromeOpts.setChromeBinaryPath(chromePath);
  await getAppropriateDriverVersion();
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
};

main();


async function simpleGet(link) {
  const proto = !link.charAt(4).localeCompare('s') ? https : http;
  return new Promise((resolve, reject) => {
    proto.get(link, (msg) => {
      let dat = [];
      msg.on('data', (chunk) => {
        dat.push(chunk);
      })
        .on('end', () => {
          resolve(dat.join(''));
        })
        .on('error', (err) => {
          reject(err);
        })
    })
  })
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



async function getAppropriateDriverVersion() {
  console.log('Checking chromedriver version compatibility');
  let cv = await getChromeVersion().catch((error) => {
    let msg = error.toString();
    if (msg.indexOf('No such file or directory') !== -1) {
      console.log('\nGoogle Chrome is not installed in the expected location; aborting\n');
    }
    throw error;
  });
  let cdv = await getChromeDriverVersion();

  let cmainver = cv.split('.')[0];
  let dmainver = cdv.split('.')[0];
  if (Number(cmainver) != Number(dmainver)) {
    console.log(`Driver version ${dmainver} not equal to Chrome version ${cmainver}; fetching appropriate version...`);
    let compatibleDriverVer = await simpleGet(`http://chromedriver.storage.googleapis.com/LATEST_RELEASE_${cmainver}`);
    let dlLink;
    if(process.platform == 'darwin') {
      dlLink = `http://chromedriver.storage.googleapis.com/${compatibleDriverVer}/chromedriver_mac64.zip`;
    }
    else if(process.platform == 'win32') {
      dlLink = `http://chromedriver.storage.googleapis.com/${compatibleDriverVer}/chromedriver_win32.zip`;
    }
    else {
      dlLink = `http://chromedriver.storage.googleapis.com/${compatibleDriverVer}/chromedriver_linux64.zip`;
    }
    fs.mkdirSync('./temp', { recursive: true });
    console.log(`Found latest Driver version of ${compatibleDriverVer}, downloading from ${dlLink}`);
    await download(dlLink, './temp/chromedriver.zip');

    if (process.platform != 'win32') {// || process.platform == 'darwin') {
      console.log('Extracting driver to usr/local/bin');
      await extractFromPathTo('./temp/chromedriver.zip', '/usr/local/bin');
      console.log('changing driver permission; 755');
      //Appropriate permissions = '-rwxr-xr-x' (r = 4, w = 2, x = 1)
      fs.chmodSync('/usr/local/bin/chromedriver', '755');
    }
    else {//if(process.platform == 'win32') {
      let appdata = process.env.APPDATA; //Appdata folder for windows (C:\Users\user\AppData\Roaming for win8, C:\Documents and Settings\user\Application Data for winXP)
      dest = `${appdata}\\ChromeDriver\\`;
      fs.mkdirSync(dest, { recursive: true });
      console.log(`Extracting driver to ${dest}`);
      await extractFromPathTo('./temp/chromedriver.zip', dest);
      await addFolderToPathVariableWin(dest);
    }
    console.log('Done installing chromedriver');
  }
  else {
    console.log(`Chromedriver ${dmainver} is compatible with current installation of Chrome ${cmainver}`);
  }
  return;
}

async function extractFromPathTo(fromPath, toPath) {
  return new Promise((resolve, reject) => {
    fs.createReadStream(fromPath)
      .pipe(unzipper.Extract({ path: toPath }))
      .on('close', () => {
        resolve();
      }).on('error', (err) => {
        reject(err);
      });
  })
}

/**
 * @returns {Promise.<String>}
 */
async function getChromeVersion() {
  if (process.platform != 'win32') {
    return new Promise((resolve, reject) => {
      exec(`"${chromePath}" --version`, (error, stdout, stderr) => {
        if (error) {
          reject(error); return;
        }
        if (stderr) {
          reject(stderr); return;
        }
        if (stdout) {
          const prefix = 'Google Chrome';
          resolve(stdout.slice(prefix.length).trim());
        }
      });
    });
  }
  else { //win32
    return new Promise((resolve, reject) => {
      exec(`reg query "HKEY_CURRENT_USER\\Software\\Google\\Chrome\\BLBeacon" /v version`, (error, stdout, stderr) => {
        if (error) {
          reject(error); return;
        }
        if (stderr) {
          reject(stderr); return;
        }
        if (stdout) {
          const prefix = 'REG_SZ';
          let res = stdout.match(/REG_SZ[^(;)]+/)[0].slice(prefix.length).trim();
          resolve(res);
        }
      });
    });
  }
}

/**
 * @returns {Promise.<String>}
 */
async function getChromeDriverVersion() {
  return new Promise((resolve, reject) => {
    exec('chromedriver -v', (error, stdout, stderr) => {
      if (error) {
        resolve('0'); return;
        // reject(error); return;
      }
      if (stderr) {
        // reject(stderr); return;
        resolve('0'); return;
      }
      if (stdout) {
        const prefix = 'ChromeDriver';
        resolve(stdout.slice(prefix.length).trim());
      }
    });
  });
}


/**
 * @returns {Promise.<String>}
 */
async function getWinUserPATHVar() {
  return new Promise((resolve, reject)=>{
    let command = `For /F "Skip=2Tokens=1-2*" %A In ('Reg Query HKCU\Environment /V PATH 2^>Nul') Do @Echo %A=%C`;
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error); return;
      }
      if (stderr) {
        reject(stderr); return;
      }
      resolve(stdout);
    });
  });
}
async function addFolderToPathVariableWin(folder) {
  let pathVar = await getWinUserPATHVar();
  let contains = pathVar.indexOf(folder);
  if(contains != -1) {
    return;
  }

  return new Promise((resolve, reject) => {
    let command = `setx PATH "${pathVar};${folder}"`;
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error); return;
      }
      if (stderr) {
        reject(stderr); return;
      }
      resolve(stdout);
    });
  });
}