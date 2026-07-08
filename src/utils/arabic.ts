/**
 * Converts a number to its Arabic ordinal representation.
 * Handles numbers up to 39 dynamically, and falls back to "الـ X" for larger numbers.
 */
export function getArabicOrdinal(num: number): string {
  const ordinals: Record<number, string> = {
    1: "الأول",
    2: "الثاني",
    3: "الثالث",
    4: "الرابع",
    5: "الخامس",
    6: "السادس",
    7: "السابع",
    8: "الثامن",
    9: "التاسع",
    10: "العاشر",
    11: "الحادي عشر",
    12: "الثاني عشر",
  };
  
  if (ordinals[num]) {
    return ordinals[num];
  }
  
  if (num >= 13 && num <= 19) {
    const units = ["", "", "", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع"];
    return `${units[num - 10]} عشر`;
  }
  
  if (num === 20) {
    return "العشرون";
  }
  
  if (num > 20 && num < 30) {
    const units = ["", "الحادي", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التائس"];
    // Wait, "التاسع" is ninth. Let's fix spelling:
    const correctUnits = ["", "الحادي", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع"];
    return `${correctUnits[num - 20]} والعشرون`;
  }
  
  if (num === 30) {
    return "الثلاثون";
  }
  
  if (num > 30 && num < 40) {
    const units = ["", "الحادي", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع"];
    return `${units[num - 30]} والثلاثون`;
  }
  
  return `الـ ${num}`;
}
