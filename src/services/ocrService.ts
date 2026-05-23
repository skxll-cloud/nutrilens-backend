// src/services/ocrService.ts
import Tesseract from 'tesseract.js';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const VISION_MODEL = process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';

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
    const response = await groq.chat.completions.create({
      model: VISION_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 300,
    });

    const content = response.choices[0]?.message?.content ?? '{}';
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match?.[0] ?? '{}');
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
