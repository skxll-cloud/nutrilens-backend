// src/routes/scan.ts
import { Router, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { analyzeImageWithVision, detectImageType } from '../services/visionService';
import { extractTextFromImage, extractProductInfo } from '../services/ocrService';
import { searchByBarcode, searchByName, searchUSDA } from '../services/nutritionService';
import { saveScan } from '../services/dbService';
import { compressImage, bufferToBase64, saveTempFile, cleanupTempFile } from '../utils/imageUtils';
import { ScanResult } from '../types';

const router = Router();

// Multer: memory storage, max 10MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Only image files are allowed'));
      return;
    }
    cb(null, true);
  },
});

// POST /api/scan
router.post('/', requireAuth, upload.single('image'), async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No image file provided' });
    return;
  }

  let tempFilePath: string | null = null;

  try {
    console.log(`[SCAN] User ${req.userId} scanning image (${req.file.size} bytes)`);

    // 1. Compress image
    const compressedBuffer = await compressImage(req.file.buffer);
    const base64Image = await bufferToBase64(compressedBuffer);

    // 2. Save temp file for Tesseract
    tempFilePath = await saveTempFile(compressedBuffer);

    // 3. Detect image type (product or meal)
    const imageType = await detectImageType(base64Image);
    console.log(`[SCAN] Detected type: ${imageType}`);

    let result: ScanResult | null = null;

    if (imageType === 'product') {
      result = await handleProductScan(base64Image, tempFilePath);
    }

    // Fallback to meal analysis if product scan failed
    if (!result) {
      console.log('[SCAN] Falling back to AI vision meal analysis');
      result = await analyzeImageWithVision(base64Image);
    }

    // 4. Save to database
    const savedScan = await saveScan(req.userId!, result);

    console.log(`[SCAN] Saved scan ${savedScan.id} - ${result.data_source}`);
    res.json({ scan_id: savedScan.id, ...result });
  } catch (err) {
    console.error('[SCAN] Error:', err);
    res.status(500).json({ error: 'Scan processing failed', details: (err as Error).message });
  } finally {
    if (tempFilePath) await cleanupTempFile(tempFilePath);
  }
});

async function handleProductScan(base64Image: string, tempFilePath: string): Promise<ScanResult | null> {
  // Step 1: OCR
  let rawText = '';
  try {
    rawText = await extractTextFromImage(tempFilePath);
    console.log(`[SCAN] OCR extracted ${rawText.length} chars`);
  } catch (err) {
    console.warn('[SCAN] OCR failed:', err);
  }

  // Step 2: Extract product info
  const productInfo = await extractProductInfo(base64Image, rawText);
  console.log(`[SCAN] Product info:`, productInfo);

  // Step 3: Try barcode first
  if (productInfo.barcode) {
    const barcodeResult = await searchByBarcode(productInfo.barcode);
    if (barcodeResult) {
      console.log(`[SCAN] Found via barcode: ${productInfo.barcode}`);
      return barcodeResult;
    }
  }

  // Step 4: Try OpenFoodFacts by name
  if (productInfo.productName) {
    const nameResult = await searchByName(productInfo.productName, productInfo.brand ?? undefined);
    if (nameResult) {
      console.log(`[SCAN] Found via name: ${productInfo.productName}`);
      return nameResult;
    }

    // Step 5: USDA fallback
    const usdaResult = await searchUSDA(productInfo.productName);
    if (usdaResult) {
      console.log(`[SCAN] Found via USDA: ${productInfo.productName}`);
      return usdaResult;
    }
  }

  return null;
}

export default router;
