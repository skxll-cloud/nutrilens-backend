// src/types/index.ts

export interface NutritionItem {
  name: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: number;
}

export interface NutritionTotal {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export type ScanType = 'product' | 'meal';
export type DataSource = 'openfoodfacts' | 'usda' | 'ai_estimation';

export interface ScanResult {
  type: ScanType;
  items: NutritionItem[];
  total: NutritionTotal;
  data_source: DataSource;
  confidence_global: number;
  product_name?: string;
  barcode?: string;
}

export interface OpenFoodFactsProduct {
  product_name?: string;
  brands?: string;
  nutriments?: {
    'energy-kcal_100g'?: number;
    'proteins_100g'?: number;
    'carbohydrates_100g'?: number;
    'fat_100g'?: number;
    energy_100g?: number;
  };
  serving_size?: string;
  quantity?: string;
}

export interface USDAFood {
  description: string;
  foodNutrients: Array<{
    nutrientName: string;
    value: number;
    unitName: string;
  }>;
}

export interface ScanRecord {
  id: string;
  user_id: string;
  image_url?: string;
  scan_type: ScanType;
  result: ScanResult;
  created_at: string;
  meal_date: string;
}
