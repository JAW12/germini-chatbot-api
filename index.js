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
    const { message } = req.body;

    if (!message){
        return res.status(400).json({error: 'Message is required.'});
    }

    try {
        const result = await genAI.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: message
        });
        const text = result.text;

        res.status(200).json({ reply: text });
    } catch (error) {
        console.error(error);
        res.status(500).json({ reply: "Something went wrong."});
    }
});