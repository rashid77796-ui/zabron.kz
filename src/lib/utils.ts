import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Сумма в тенге с неразрывным пробелом между разрядами: 1 500.
 *
 * Локаль зафиксирована намеренно: голый `toLocaleString()` берёт язык браузера,
 * и та же цена показывается как «1,500» или «1 500» у разных посетителей.
 */
export function formatPrice(value: number): string {
  return value.toLocaleString('ru-KZ')
}

/**
 * Форматирует ввод номера телефона в маску +7 XXX XXX XXXX (формат Казахстана).
 * Принимает любую строку, оставляет только цифры и нормализует код страны.
 */
export function formatPhone(value: string): string {
  let digits = value.replace(/\D/g, "");

  // Нормализуем код страны: 8XXX… и 7XXX… → 7XXX…
  if (digits.startsWith("8")) digits = "7" + digits.slice(1);
  if (!digits.startsWith("7")) digits = "7" + digits;

  // 7 + 10 цифр номера
  digits = digits.slice(0, 11);

  const rest = digits.slice(1); // без кода страны
  let out = "+7";
  if (rest.length > 0) out += " " + rest.slice(0, 3);
  if (rest.length > 3) out += " " + rest.slice(3, 6);
  if (rest.length > 6) out += " " + rest.slice(6, 10);
  return out;
}
