// src/services/nutritionService.ts
import axios from 'axios';
import { ScanResult, NutritionItem, OpenFoodFactsProduct, USDAFood } from '../types';

const OFF_BASE = process.env.OPENFOODFACTS_BASE_URL ?? 'https://world.openfoodfacts.org';
const USDA_BASE = process.env.USDA_BASE_URL ?? 'https://api.nal.usda.gov/fdc/v1';
const USDA_KEY = process.env.USDA_API_KEY ?? '';

// Search OpenFoodFacts by barcode
export async function searchByBarcode(barcode: string): Promise<ScanResult | null> {
  try {
    const { data } = await axios.get(`${OFF_BASE}/api/v0/product/${barcode}.json`, {
      timeout: 5000,
    });

    if (data.status !== 1 || !data.product) return null;
    return buildResultFromOFFProduct(data.product as OpenFoodFactsProduct, barcode);
  } catch {
    return null;
  }
}

// Search OpenFoodFacts by product name/brand
export async function searchByName(name: string, brand?: string): Promise<ScanResult | null> {
  try {
    const query = brand ? `${brand} ${name}` : name;
    const { data } = await axios.get(`${OFF_BASE}/cgi/search.pl`, {
      params: {
        search_terms: query,
        search_simple: 1,
        action: 'process',
        json: 1,
        page_size: 1,
      },
      timeout: 5000,
    });

    if (!data.products || data.products.length === 0) return null;
    const product = data.products[0] as OpenFoodFactsProduct;
    return buildResultFromOFFProduct(product);
  } catch {
    return null;
  }
}

function buildResultFromOFFProduct(product: OpenFoodFactsProduct, barcode?: string): ScanResult {
  const n = product.nutriments ?? {};
  const kcal = n['energy-kcal_100g'] ?? (n['energy_100g'] ? n['energy_100g'] / 4.184 : 0);
  const protein = n['proteins_100g'] ?? 0;
  const carbs = n['carbohydrates_100g'] ?? 0;
  const fat = n['fat_100g'] ?? 0;

  // Assume 100g serving if not specified
  const quantity = product.serving_size ?? product.quantity ?? '100g';

  const item: NutritionItem = {
    name: product.product_name ?? 'Unknown product',
    quantity,
    calories: Math.round(kcal),
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fat: Math.round(fat * 10) / 10,
    confidence: 0.95,
  };

  return {
    type: 'product',
    items: [item],
    total: {
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
    },
    data_source: 'openfoodfacts',
    confidence_global: 0.95,
    product_name: product.product_name,
    barcode,
  };
}

// USDA fallback search
export async function searchUSDA(query: string): Promise<ScanResult | null> {
  if (!USDA_KEY) return null;

  try {
    const { data } = await axios.get(`${USDA_BASE}/foods/search`, {
      params: {
        query,
        api_key: USDA_KEY,
        pageSize: 1,
        dataType: 'Survey (FNDDS)',
      },
      timeout: 5000,
    });

    if (!data.foods || data.foods.length === 0) return null;
    const food = data.foods[0] as USDAFood;
    return buildResultFromUSDA(food);
  } catch {
    return null;
  }
}

function buildResultFromUSDA(food: USDAFood): ScanResult {
  const getNutrient = (name: string): number => {
    const n = food.foodNutrients.find(
      (fn) => fn.nutrientName.toLowerCase().includes(name.toLowerCase())
    );
    return n ? Math.round(n.value * 10) / 10 : 0;
  };

  const item: NutritionItem = {
    name: food.description,
    quantity: '100g',
    calories: getNutrient('Energy') || getNutrient('energy'),
    protein: getNutrient('Protein'),
    carbs: getNutrient('Carbohydrate'),
    fat: getNutrient('Total lipid'),
    confidence: 0.88,
  };

  return {
    type: 'product',
    items: [item],
    total: {
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
    },
    data_source: 'usda',
    confidence_global: 0.88,
    product_name: food.description,
  };
}

// Calculate totals from items array
export function calculateTotals(items: NutritionItem[]): { calories: number; protein: number; carbs: number; fat: number } {
  return items.reduce(
    (acc, item) => ({
      calories: Math.round(acc.calories + item.calories),
      protein: Math.round((acc.protein + item.protein) * 10) / 10,
      carbs: Math.round((acc.carbs + item.carbs) * 10) / 10,
      fat: Math.round((acc.fat + item.fat) * 10) / 10,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}
