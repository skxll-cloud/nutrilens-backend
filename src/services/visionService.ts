// src/services/visionService.ts
import Groq from 'groq-sdk';
import { ScanResult } from '../types';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const VISION_MODEL = process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';

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

async function callGroqVision(prompt: string, base64Image: string, mimeType = 'image/jpeg'): Promise<string> {
  try {
    const response = await groq.chat.completions.create({
      model: VISION_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 1500,
    });
    return response.choices[0]?.message?.content ?? '';
  } catch (err: any) {
    const status = err?.status ?? err?.error?.status;
    const message = err?.error?.message ?? err?.message;
    console.error(`[GROQ] HTTP ${status} - model: ${VISION_MODEL}`);
    if (message) console.error('[GROQ] Error:', message);
    throw new Error(`Groq API error ${status}: ${message}`);
  }
}

export async function analyzeImageWithVision(base64Image: string, mimeType = 'image/jpeg'): Promise<ScanResult> {
  const content = await callGroqVision(VISION_PROMPT, base64Image, mimeType);
  if (!content) throw new Error('No response from Groq API');
  try {
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    // Extract first JSON object if model adds surrounding text
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON found in response');
    return JSON.parse(match[0]) as ScanResult;
  } catch {
    throw new Error(`Failed to parse Groq response: ${content.slice(0, 200)}`);
  }
}

export async function detectImageType(base64Image: string, mimeType = 'image/jpeg'): Promise<'product' | 'meal'> {
  const prompt = 'Is this image showing a packaged/labeled food product (with nutrition label or barcode) or a prepared meal/dish? Reply with ONLY one word: "product" or "meal"';
  const answer = await callGroqVision(prompt, base64Image, mimeType);
  return answer.toLowerCase().trim().includes('product') ? 'product' : 'meal';
}
