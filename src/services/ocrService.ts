// src/services/ocrService.ts
import Tesseract from 'tesseract.js';
import axios from 'axios';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

export interface OCRResult {
  text: string;
  productName: string | null;
  brand: string | null;
  barcode: string | null;
}

export async function extractTextFromImage(imagePath: string): Promise<string> {
  const { data } = await Tesseract.recognize(imagePath, 'fra+eng', { logger: () => {} });
  return data.text;
}

export async function extractProductInfo(base64Image: string, rawOCRText: string): Promise<OCRResult> {
  const prompt = `You extract product information from OCR text of food packaging.
OCR extracted text:
${rawOCRText}

Look at the image and the OCR text. Return ONLY valid JSON with this structure:
{
  "productName": "exact product name or null",
  "brand": "brand name or null",
  "barcode": "barcode number if visible or null"
}
No markdown, no explanation.`;

  try {
    const { data } = await axios.post(GEMINI_URL, {
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: 'image/jpeg', data: base64Image } }
        ]
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 300 }
    });

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      text: rawOCRText,
      productName: parsed.productName ?? null,
      brand: parsed.brand ?? null,
      barcode: parsed.barcode ?? null,
    };
  } catch {
    return { text: rawOCRText, productName: null, brand: null, barcode: null };
  }
}
