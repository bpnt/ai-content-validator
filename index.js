require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const OpenAI = require('openai');

const app = express();
app.use(express.json());
app.set('view engine', 'ejs');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.get('/', (req, res) => {
  res.render('index');
});

app.post('/scrape', async (req, res) => {
  try {
    const { url } = req.body;
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const content = $('body').text().trim();

    // Send the scraped content back without AI analysis
    res.json({ content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/analyze', async (req, res) => {
  try {
    const { content } = req.body;
    const analysis = await analyzeContent(content);
    res.json({ analysis });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function analyzeContent(content) {
  try {
    const prompt = `Analyze the following text for grammar errors, spelling mistakes, and potential factual inaccuracies. Provide a summary of findings and suggestions for improvement:

${content.substring(0, 1000)} // Limit to first 1000 characters to avoid token limits

Please format your response as JSON with the following structure:
{
  "grammarErrors": [list of grammar errors],
  "spellingMistakes": [list of spelling mistakes],
  "factualInaccuracies": [list of potential factual inaccuracies],
  "suggestions": [list of suggestions for improvement]
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
    });

    return JSON.parse(completion.choices[0].message.content);
  } catch (error) {
    console.error('Error in AI analysis:', error);
    if (error.response) {
      console.error(error.response.status, error.response.data);
      if (error.response.status === 429) {
        return { error: 'API rate limit exceeded. Please try again later.' };
      }
    }
    return { error: 'Failed to perform AI analysis. Please try again later.' };
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
