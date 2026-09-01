import { Flame, UtensilsCrossed, PartyPopper, Trees, Sparkles, type LucideIcon } from 'lucide-react';
import { VenueCategory } from './types';

export interface CategoryInfo {
  id: VenueCategory;
  label: string;
  short: string;
  icon: LucideIcon;
}

export const CATEGORIES: CategoryInfo[] = [
  { id: 'bath', label: 'Бани и сауны', short: 'Бани', icon: Flame },
  { id: 'spa', label: 'Спа и велнес', short: 'Спа', icon: Flame },
  { id: 'restaurant', label: 'Кафе, бары, рестораны', short: 'Рестораны', icon: UtensilsCrossed },
  { id: 'entertainment', label: 'Развлечения', short: 'Развлечения', icon: PartyPopper },
  { id: 'outdoor', label: 'Зоны отдыха и активный отдых', short: 'Зоны отдыха', icon: Trees },
];

export const getCategory = (id?: string) => CATEGORIES.find(c => c.id === id);

// --- Порядок и иконки категорий по slug из БД (правки 6 и 17) ---
// Порядок: Кафе/Бары/Рестораны → Спа/Бани/Сауны → Развлечения → Зоны отдыха и активный отдых.
export const CATEGORY_META: Record<string, { icon: LucideIcon; order: number }> = {
  restaurant: { icon: UtensilsCrossed, order: 1 },
  spa: { icon: Sparkles, order: 2 },
  bath: { icon: Flame, order: 3 },
  entertainment: { icon: PartyPopper, order: 4 },
  outdoor: { icon: Trees, order: 5 },
};

export const categoryIcon = (slug: string): LucideIcon =>
  CATEGORY_META[slug]?.icon ?? Flame;

// Сортировка категорий по нужному порядку; неизвестные slug — в конец.
export function sortCategories<T extends { slug: string }>(cats: T[]): T[] {
  return [...cats].sort(
    (a, b) => (CATEGORY_META[a.slug]?.order ?? 99) - (CATEGORY_META[b.slug]?.order ?? 99),
  );
}