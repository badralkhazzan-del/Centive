import type { Farmer } from "@/types";

// 18 fictional member farmers (first names only, masked phone numbers).
// Capacities are kg per week the farmer can commit to MBG kitchens. Demo data.

type Spec = [
  id: string,
  name: string,
  village: string,
  kopdesId: string,
  gender: Farmer["gender"],
  ageGroup: Farmer["ageGroup"],
  reliability: number,
  phoneEnd: string,
  commodities: Record<string, number>,
  consent?: boolean,
];

const S = "kd-sumbangsari";
const K = "kd-karangmulya";

const SPECS: Spec[] = [
  ["f-darto", "Darto", "Sumbangsari", S, "male", "adult", 0.88, "1234", { eggs: 50, bananas: 70 }],
  ["f-sri", "Sri", "Sumbangsari", S, "female", "adult", 0.93, "5521", { eggs: 75, spinach: 90, bananas: 90 }],
  ["f-wati", "Wati", "Kotayasa", S, "female", "adult", 0.9, "8812", { eggs: 55, spinach: 75, kangkung: 60 }],
  ["f-ratna", "Ratna", "Sumbangsari", S, "female", "youth", 0.86, "3390", { eggs: 38, tempe: 60 }],
  ["f-joko", "Joko", "Sumbangsari", S, "male", "adult", 0.91, "7745", { chicken: 120, rice: 250, bananas: 110 }],
  ["f-eko", "Eko", "Kotayasa", S, "male", "youth", 0.84, "2068", { chicken: 110, kangkung: 50, bananas: 150 }],
  ["f-slamet", "Slamet", "Sumbangsari", S, "male", "adult", 0.95, "6107", { chicken: 125, rice: 250, bananas: 50 }],
  ["f-bayu", "Bayu", "Sumbangsari", S, "male", "youth", 0.89, "4476", { catfish: 120, tilapia: 60, kangkung: 90 }],
  ["f-rina", "Rina", "Kotayasa", S, "female", "youth", 0.87, "9153", { catfish: 100, spinach: 80, tempe: 55, kangkung: 40 }],
  ["f-agus", "Agus", "Sumbangsari", S, "male", "adult", 0.82, "1880", { catfish: 70, tilapia: 65, rice: 235 }],
  ["f-tini", "Tini", "Sumbangsari", S, "female", "adult", 0.9, "5034", { catfish: 45, spinach: 75, tempe: 55, kangkung: 45 }],
  ["f-supri", "Supri", "Karangmulya", K, "male", "adult", 0.92, "6629", { chicken: 75, rice: 150, tilapia: 40, catfish: 35, spinach: 45 }],
  ["f-yanti", "Yanti", "Karangmulya", K, "female", "adult", 0.91, "3307", { eggs: 50, tilapia: 110, spinach: 35, oranges: 120 }],
  ["f-dimas", "Dimas", "Karangmulya", K, "male", "youth", 0.85, "7291", { tilapia: 120, catfish: 35, carrots: 25, long_beans: 30 }],
  ["f-ningsih", "Ningsih", "Karangmulya", K, "female", "adult", 0.94, "4410", { rice: 150, spinach: 55, carrots: 25, long_beans: 25, oranges: 90 }],
  ["f-parman", "Parman", "Karangmulya", K, "male", "adult", 0.89, "8836", { chicken: 75, rice: 150, eggs: 50, oranges: 90 }],
  ["f-lestari", "Lestari", "Karangmulya", K, "female", "youth", 0.88, "2195", { eggs: 45, catfish: 35, spinach: 55, carrots: 25, long_beans: 25, oranges: 110 }],
  ["f-warsono", "Warsono", "Karangmulya", K, "male", "adult", 0.8, "6573", { chicken: 120, carrots: 60, long_beans: 50, oranges: 100 }, false],
];

export function buildFarmers(): Farmer[] {
  return SPECS.map(([id, displayName, village, kopdesId, gender, ageGroup, reliabilityScore, end, commodities, consent]) => ({
    id,
    displayName,
    village,
    kopdesId,
    gender,
    ageGroup,
    reliabilityScore,
    phoneMasked: `08xx-xxxx-${end}`,
    consentGiven: consent ?? true,
    commodities: Object.entries(commodities).map(([ingredientId, weeklyCapacityKg]) => ({ ingredientId, weeklyCapacityKg })),
  }));
}

/** Commodities each Kopdes trades with kitchens (the rest is bought at the market). */
export const KOPDES_COMMODITIES: Record<string, string[]> = {
  [S]: ["eggs", "chicken", "catfish", "tilapia", "rice", "tempe", "spinach", "kangkung", "bananas"],
  [K]: ["chicken", "rice", "eggs", "tilapia", "catfish", "spinach", "carrots", "long_beans", "oranges"],
};
