const express = require('express');
const puppeteer = require('puppeteer');
const ejs = require('ejs');
const path = require('path');

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Render the form
app.get('/', (req, res) => {
  res.render('index');
});

// Launch the browser once when the server starts
let browser;
(async () => {
  browser = await puppeteer.launch();
})();

app.post('/scrape', async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Valid URL is required' });
  }

  try {
    // Validate URL
    new URL(url);

    const page = await browser.newPage();
    await page.goto(url, { timeout: 30000 }); // 30 seconds timeout

    // Extract the text content from the body
    const content = await page.evaluate(() => {
      return document.body.innerText;
    });

    await page.close();

    res.json({ content });
  } catch (error) {
    console.error('Scraping error:', error);
    if (error instanceof TypeError) {
      res.status(400).json({ error: 'Invalid URL' });
    } else {
      res.status(500).json({ error: 'Failed to scrape the website' });
    }
  }
});

// Close the browser when the server is shutting down
process.on('SIGINT', async () => {
  if (browser) await browser.close();
  process.exit();
});

app.listen(port, () => {
  console.log(`Web scraping server listening at http://localhost:${port}`);
});
