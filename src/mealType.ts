export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
export type MealType = (typeof MEAL_TYPES)[number]

export const MEAL_LABEL: Record<MealType, string> = {
  breakfast: '朝食',
  lunch: '昼食',
  dinner: '夕食',
  snack: '間食',
}

export const MEAL_SHORT: Record<MealType, string> = {
  breakfast: '朝',
  lunch: '昼',
  dinner: '夕',
  snack: '間',
}
