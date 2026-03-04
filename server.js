require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.post('/api/compare', async (req, res) => {
    const { word1, word2 } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === 'YOUR_FREE_API_KEY_HERE' || apiKey === 'AIzaSyAB_7v414zmYFcyTUUSiIoUBqEUGhc21hE') {
        return res.status(400).json({ error: "API Key is missing. Please add your Gemini API key to the .env file." });
    }

    if (!word1 || !word2) {
        return res.status(400).json({ error: "Missing words to compare." });
    }

    try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const prompt = `
            Analyze the differences between "${word1}" and "${word2}".
            Provide the output STRICTLY in the following JSON format without any markdown wrappers or extra text:
            {
                "differences": [
                    {"title": "[Short aspect name]", "description": "[explanation of how w1 and w2 differ in this aspect]"}
                    // Must provide AT LEAST 4 differences, up to 6
                ],
                "word1Unique": [
                    "[short bullet point 1 unique trait of w1]",
                    "[short bullet point 2]",
                    "[short bullet point 3]"
                ],
                "word2Unique": [
                    "[short bullet point 1 unique trait of w2]",
                    "[short bullet point 2]",
                    "[short bullet point 3]"
                ]
            }
            Ensure the JSON is perfectly valid. Do not use code blocks \`\`\`json. Return just the JSON string.
        `;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    temperature: 0.2,
                }
            })
        });

        const rawApiResponse = await response.text();
        let data = {};
        if (rawApiResponse) {
            try {
                data = JSON.parse(rawApiResponse);
            } catch {
                data = {};
            }
        }

        if (!response.ok) {
            throw new Error(data.error?.message || `Gemini API request failed with status ${response.status}.`);
        }

        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!textResponse) {
            throw new Error("Gemini API returned an empty response.");
        }

        let cleanJson = textResponse.replace(/^```json/g, '').replace(/^```/g, '').replace(/```$/g, '').trim();
        const jsonResponse = JSON.parse(cleanJson);

        res.json(jsonResponse);

    } catch (error) {
        console.error("Backend Error:", error);
        res.status(500).json({ error: error.message || "An unexpected error occurred." });
    }
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
    console.log(`Don't forget to add your Gemini API key to the .env file!`);
});

