require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const { stripIndent } = require('common-tags');

const app = express();
app.use(express.json());
app.use(express.static('public')); // Serve static files from the 'public' directory
app.set('view engine', 'ejs');

app.get('/', (req, res) => {
  res.render('index');
});

app.post('/scrape', async (req, res) => {
  console.log('Received scrape request');
  try {
    const { url } = req.body;
    console.log('URL to scrape:', url);
    const response = await axios.get(url);
    console.log('Fetched URL content');
    const $ = cheerio.load(response.data);
    const content = $('body').text().trim();
    console.log('Scraped content length:', content.length);

    res.json({ content });
  } catch (error) {
    console.error('Error in scrape request:', error);
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
    const naturalContent = convertToNaturalLanguage(content);

    const prompt = stripIndent`
      Analyze the following text for grammar errors, spelling mistakes, and potential factual inaccuracies. Provide a summary of findings and suggestions for improvement:

      ${naturalContent.substring(0, 1500)} // Increased limit to 1500 characters

      Please format your response as JSON with the following structure:
      {
        "grammarErrors": [list of grammar errors],
        "spellingMistakes": [list of spelling mistakes],
        "factualInaccuracies": [list of potential factual inaccuracies],
        "suggestions": [list of suggestions for improvement]
      }
    `;

    const response = await axios.post('https://api.anthropic.com/v1/complete', 
      {
        prompt: `Human: ${prompt}\n\nAssistant:`,
        model: "claude-2",
        max_tokens_to_sample: 1000,
        temperature: 0.7,
        stop_sequences: ["\n\nHuman:"]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01'
        },
      }
    );

    console.log('API Response:', response.data);

    // Extract the completion part of the response
    const jsonResponse = response.data.completion;

    // Find the start of the JSON object
    const jsonStartIndex = jsonResponse.indexOf('{');
    const jsonEndIndex = jsonResponse.lastIndexOf('}');

    // Check if we found valid JSON
    if (jsonStartIndex === -1 || jsonEndIndex === -1) {
      console.error('Invalid JSON response:', jsonResponse);
      return { error: 'Invalid JSON response from API' };
    }

    // Extract the JSON string
    const jsonString = jsonResponse.substring(jsonStartIndex, jsonEndIndex + 1); // Include the closing brace

    try {
      const analysis = JSON.parse(jsonString); // Parse the JSON response
      return analysis; // Return the parsed analysis object
    } catch (jsonError) {
      console.error('Invalid JSON response:', jsonString);
      return { error: 'Invalid JSON response from API' };
    }
  } catch (error) {
    console.error('Error in AI analysis:', error);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
    }
    return { error: 'Failed to perform AI analysis: ' + (error.response?.data?.error?.message || error.message) };
  }
}

function convertToNaturalLanguage(content) {
  let text = content.replace(/<[^>]*>/g, '');
  text = text.replace(/[{}()\[\]]/g, ' ');
  text = text.replace(/;/g, '.');
  text = text.replace(/\b(function|var|let|const|if|else|for|while|return)\b/g, '');
  text = text.replace(/\s+/g, ' ').trim();
  text = text.replace(/(\w+)\s*=\s*(.+?)(?=[;.]|$)/g, '$1 is $2');
  text = text.replace(/(\w+)\s*\+=\s*(.+?)(?=[;.]|$)/g, '$1 is increased by $2');
  text = text.replace(/(\w+)\s*-=\s*(.+?)(?=[;.]|$)/g, '$1 is decreased by $2');
  text = text.replace(/[a-zA-Z_]\w*\s*\(.*?\)/g, '');
  return text;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
