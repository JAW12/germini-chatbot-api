import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const STATIC_PATH = './public';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(STATIC_PATH));

// Gemini setup
const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);

// Routes
app.listen(PORT, () => {
    console.log(`Gemini Chatbot running on http://localhost:${PORT}`);
});

app.post('/api/chat', async (req, res) => {
    const originalUserMessage = req.body.message;

    if (!originalUserMessage){
        return res.status(400).json({error: 'Message is required.'});
    }

    try {
        // Instruct Gemini to respond using Markdown format.
        // Your frontend code will safely parse this into HTML.
        const instructedMessage = `Please provide your response using standard Markdown for formatting (e.g., **bold**, *italics*, \`code\`, lists with - or *, and code blocks with \`\`\`). Do not use HTML tags in your response. User's message: "${originalUserMessage}"`;

        const result = await genAI.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: instructedMessage
        });
        const text = result.text;

        res.status(200).json({ reply: text });
    } catch (error) {
        console.error(error);
        res.status(500).json({ reply: "Something went wrong."});
    }
});