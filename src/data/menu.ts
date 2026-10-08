import type { MenuCycle, MenuDay } from "@/types";

// 4-week menu cycle (20 school days, Mon..Fri). Every day has a staple, one animal
// protein, one plant protein, one vegetable dish and one fruit.
// Each week: chicken x2, eggs x2, fish x1 (catfish in weeks 1 and 3, tilapia in
// weeks 2 and 4), so the main-protein diversity rule (max 2 per week) holds.

const PROTEIN = [
  "ayam_bumbu_kuning", "telur_balado", "lele_goreng", "ayam_bumbu_kuning", "telur_balado",
  "telur_balado", "ayam_bumbu_kuning", "nila_bakar", "telur_balado", "ayam_bumbu_kuning",
  "ayam_bumbu_kuning", "telur_balado", "ayam_bumbu_kuning", "lele_goreng", "telur_balado",
  "telur_balado", "ayam_bumbu_kuning", "nila_bakar", "telur_balado", "ayam_bumbu_kuning",
];

const PLANT = [
  "tempe_goreng", "tahu_bacem", "orek_tempe", "tahu_bacem", "tempe_goreng",
  "tahu_bacem", "orek_tempe", "tempe_goreng", "tahu_bacem", "orek_tempe",
  "tempe_goreng", "tahu_bacem", "orek_tempe", "tahu_bacem", "tempe_goreng",
  "tahu_bacem", "orek_tempe", "tempe_goreng", "tahu_bacem", "orek_tempe",
];

const VEG = [
  "sayur_bayam", "tumis_kangkung", "sayur_sop", "oseng_kacang_panjang", "sayur_bayam",
  "sayur_bayam", "sayur_sop", "tumis_kangkung", "oseng_kacang_panjang", "sayur_bayam",
  "sayur_bayam", "tumis_kangkung", "sayur_sop", "oseng_kacang_panjang", "sayur_bayam",
  "sayur_bayam", "sayur_sop", "tumis_kangkung", "oseng_kacang_panjang", "sayur_bayam",
];

const FRUIT = Array.from({ length: 20 }, (_, i) => (i % 2 === 0 ? "pisang" : "jeruk"));

export const BASE_MENU_DAYS: MenuDay[] = Array.from({ length: 20 }, (_, i) => ({
  dayIndex: i + 1,
  dishIds: ["nasi_putih", PROTEIN[i], PLANT[i], VEG[i], FRUIT[i]],
}));

export function buildMenuCycle(kitchenId: string, lockedDishIds: string[]): MenuCycle {
  return {
    id: `cycle-${kitchenId}`,
    kitchenId,
    days: BASE_MENU_DAYS.map((d) => ({ ...d, dishIds: [...d.dishIds] })),
    lockedDishIds,
  };
}
