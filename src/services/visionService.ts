// src/services/visionService.ts
import axios from 'axios';
import { ScanResult } from '../types';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const VISION_PROMPT = `You are a professional nutritionist and food recognition expert.
Analyze the provided food image and return ONLY a valid JSON object with this exact structure:
{
  "type": "meal",
  "items": [
    {
      "name": "food item name",
      "quantity": "estimated quantity with unit (e.g. 150g, 1 cup, 2 slices)",
      "calories": 250,
      "protein": 15,
      "carbs": 30,
      "fat": 8,
      "confidence": 0.85
    }
  ],
  "total": {
    "calories": 250,
    "protein": 15,
    "carbs": 30,
    "fat": 8
  },
  "data_source": "ai_estimation",
  "confidence_global": 0.80
}
Rules:
- Be as accurate as possible for portions and nutrition
- confidence is between 0 and 1
- All numeric values are numbers, not strings
- Return ONLY the JSON, no markdown, no explanation
- If you cannot identify any food, still return valid JSON with empty items array`;

async function callGemini(prompt: string, base64Image: string, mimeType = 'image/jpeg'): Promise<string> {
  const { data } = await axios.post(GEMINI_URL, {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: mimeType, data: base64Image } }
      ]
    }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 1500 }
  });
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

export async function analyzeImageWithVision(base64Image: string, mimeType = 'image/jpeg'): Promise<ScanResult> {
  const content = await callGemini(VISION_PROMPT, base64Image, mimeType);
  if (!content) throw new Error('No response from Gemini API');
  try {
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned) as ScanResult;
  } catch {
    throw new Error(`Failed to parse Gemini response: ${content}`);
  }
}

export async function detectImageType(base64Image: string, mimeType = 'image/jpeg'): Promise<'product' | 'meal'> {
  const prompt = 'Is this image showing a packaged/labeled food product (with nutrition label or barcode) or a prepared meal/dish? Reply with ONLY one word: "product" or "meal"';
  const answer = await callGemini(prompt, base64Image, mimeType);
  return answer.toLowerCase().trim().includes('product') ? 'product' : 'meal';
}
