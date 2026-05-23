// src/services/dbService.ts
import { supabase } from '../config/supabase';
import { ScanRecord, ScanResult, ScanType } from '../types';

export async function saveScan(
  userId: string,
  result: ScanResult,
  imageUrl?: string
): Promise<ScanRecord> {
  const now = new Date();
  const mealDate = now.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('scans')
    .insert({
      user_id: userId,
      image_url: imageUrl ?? null,
      scan_type: result.type,
      result,
      meal_date: mealDate,
    })
    .select()
    .single();

  if (error) throw new Error(`DB insert error: ${error.message}`);
  return data as ScanRecord;
}

export async function getUserScans(userId: string, limit = 50): Promise<ScanRecord[]> {
  const { data, error } = await supabase
    .from('scans')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`DB query error: ${error.message}`);
  return (data ?? []) as ScanRecord[];
}

export async function getDailyScans(userId: string, date: string): Promise<ScanRecord[]> {
  const { data, error } = await supabase
    .from('scans')
    .select('*')
    .eq('user_id', userId)
    .eq('meal_date', date)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`DB query error: ${error.message}`);
  return (data ?? []) as ScanRecord[];
}

export async function getDailyTotals(userId: string, date: string): Promise<{
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  scan_count: number;
}> {
  const scans = await getDailyScans(userId, date);

  return scans.reduce(
    (acc, scan) => ({
      calories: Math.round(acc.calories + scan.result.total.calories),
      protein: Math.round((acc.protein + scan.result.total.protein) * 10) / 10,
      carbs: Math.round((acc.carbs + scan.result.total.carbs) * 10) / 10,
      fat: Math.round((acc.fat + scan.result.total.fat) * 10) / 10,
      scan_count: acc.scan_count + 1,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, scan_count: 0 }
  );
}

export async function deleteScan(userId: string, scanId: string): Promise<void> {
  const { error } = await supabase
    .from('scans')
    .delete()
    .eq('id', scanId)
    .eq('user_id', userId);

  if (error) throw new Error(`DB delete error: ${error.message}`);
}

export async function getUserGoals(userId: string): Promise<{
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
} | null> {
  const { data, error } = await supabase
    .from('user_goals')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;
  return {
    calories: data.calories ?? 2000,
    protein: data.protein ?? 150,
    carbs: data.carbs ?? 250,
    fat: data.fat ?? 65,
  };
}

export async function upsertUserGoals(
  userId: string,
  goals: { calories: number; protein: number; carbs: number; fat: number }
): Promise<void> {
  const { error } = await supabase.from('user_goals').upsert({
    user_id: userId,
    ...goals,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`DB upsert error: ${error.message}`);
}
