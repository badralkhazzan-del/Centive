import type { Dish } from "@/types";

// Typical MBG-style dishes. Grams are edible raw grams per portion:
// small = PAUD to SD grade 3, large = SD grade 4 and above.
// Sample values, chosen so every day of the menu cycle stays within the
// Rp8,000 / Rp10,000 raw-food budget at seed prices (checked by a unit test).

const g = (small: number, large: number) => ({ small, large });

export const DISHES: Dish[] = [
  {
    id: "nasi_putih",
    nameEn: "Steamed rice",
    nameId: "Nasi putih",
    mainIngredientId: "rice",
    components: [{ ingredientId: "rice", gramsPerPortion: g(65, 85) }],
  },
  {
    id: "ayam_bumbu_kuning",
    nameEn: "Turmeric-spiced chicken",
    nameId: "Ayam bumbu kuning",
    mainIngredientId: "chicken",
    components: [
      { ingredientId: "chicken", gramsPerPortion: g(45, 60) },
      { ingredientId: "cooking_oil", gramsPerPortion: g(3, 4) },
    ],
  },
  {
    id: "telur_balado",
    nameEn: "Eggs in chili sauce",
    nameId: "Telur balado",
    mainIngredientId: "eggs",
    components: [
      { ingredientId: "eggs", gramsPerPortion: g(50, 60) },
      { ingredientId: "cooking_oil", gramsPerPortion: g(3, 4) },
    ],
  },
  {
    id: "lele_goreng",
    nameEn: "Fried catfish",
    nameId: "Lele goreng",
    mainIngredientId: "catfish",
    components: [
      { ingredientId: "catfish", gramsPerPortion: g(50, 65) },
      { ingredientId: "cooking_oil", gramsPerPortion: g(5, 6) },
    ],
  },
  {
    id: "nila_bakar",
    nameEn: "Grilled tilapia",
    nameId: "Nila bakar",
    mainIngredientId: "tilapia",
    components: [
      { ingredientId: "tilapia", gramsPerPortion: g(50, 65) },
      { ingredientId: "cooking_oil", gramsPerPortion: g(2, 3) },
    ],
  },
  {
    id: "tempe_goreng",
    nameEn: "Fried tempe",
    nameId: "Tempe goreng",
    mainIngredientId: "tempe",
    components: [
      { ingredientId: "tempe", gramsPerPortion: g(25, 35) },
      { ingredientId: "cooking_oil", gramsPerPortion: g(3, 4) },
    ],
  },
  {
    id: "orek_tempe",
    nameEn: "Sweet soy tempe stir-fry",
    nameId: "Orek tempe",
    mainIngredientId: "tempe",
    components: [
      { ingredientId: "tempe", gramsPerPortion: g(25, 35) },
      { ingredientId: "cooking_oil", gramsPerPortion: g(3, 3) },
    ],
  },
  {
    id: "tahu_bacem",
    nameEn: "Sweet braised tofu",
    nameId: "Tahu bacem",
    mainIngredientId: "tofu",
    components: [{ ingredientId: "tofu", gramsPerPortion: g(40, 50) }],
  },
  {
    id: "sayur_bayam",
    nameEn: "Clear spinach soup",
    nameId: "Sayur bayam",
    mainIngredientId: "spinach",
    components: [
      { ingredientId: "spinach", gramsPerPortion: g(40, 55) },
      { ingredientId: "carrots", gramsPerPortion: g(10, 10) },
    ],
  },
  {
    id: "tumis_kangkung",
    nameEn: "Stir-fried water spinach",
    nameId: "Tumis kangkung",
    mainIngredientId: "kangkung",
    components: [
      { ingredientId: "kangkung", gramsPerPortion: g(45, 60) },
      { ingredientId: "cooking_oil", gramsPerPortion: g(2, 3) },
    ],
  },
  {
    id: "sayur_sop",
    nameEn: "Vegetable soup",
    nameId: "Sayur sop",
    mainIngredientId: "cabbage",
    components: [
      { ingredientId: "cabbage", gramsPerPortion: g(25, 30) },
      { ingredientId: "carrots", gramsPerPortion: g(20, 25) },
    ],
  },
  {
    id: "oseng_kacang_panjang",
    nameEn: "Stir-fried long beans",
    nameId: "Oseng kacang panjang",
    mainIngredientId: "long_beans",
    components: [
      { ingredientId: "long_beans", gramsPerPortion: g(40, 50) },
      { ingredientId: "carrots", gramsPerPortion: g(10, 10) },
      { ingredientId: "cooking_oil", gramsPerPortion: g(2, 3) },
    ],
  },
  {
    id: "pisang",
    nameEn: "Banana",
    nameId: "Pisang",
    mainIngredientId: "bananas",
    components: [{ ingredientId: "bananas", gramsPerPortion: g(60, 75) }],
  },
  {
    id: "jeruk",
    nameEn: "Orange",
    nameId: "Jeruk",
    mainIngredientId: "oranges",
    components: [{ ingredientId: "oranges", gramsPerPortion: g(70, 90) }],
  },
];
