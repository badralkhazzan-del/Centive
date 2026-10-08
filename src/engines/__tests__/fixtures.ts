import type { AppData, Dish, Ingredient, Kitchen, MenuCycle } from "@/types";
import { buildSeedState } from "@/data/seed";

export function seed(): AppData {
  return buildSeedState();
}

export function mini() {
  const ingredient: Ingredient = {
    id: "x",
    nameEn: "X",
    nameId: "X",
    tkpiName: "X",
    foodGroup: "vegetable",
    unit: "kg",
    energyKcalPer100g: 100,
    proteinGPer100g: 10,
    edibleFraction: 0.5,
    allergens: [],
    seasonalityByMonth: Array(12).fill(1),
    seasonal: false,
    dataSource: "test",
    verified: true,
    emoji: "",
  };
  const dish: Dish = {
    id: "dx",
    nameEn: "Dish X",
    nameId: "Dish X",
    mainIngredientId: "x",
    components: [{ ingredientId: "x", gramsPerPortion: { small: 100, large: 200 } }],
  };
  const kitchen: Kitchen = {
    id: "k",
    name: "K",
    subdistrict: "S",
    village: "V",
    lat: 0,
    lng: 0,
    beneficiaries: { small: 10, large: 20 },
    attendanceRate: 0.9,
    schoolCalendar: { operatingWeekdays: [1, 2, 3, 4, 5], holidays: [] },
    linkedKopdesIds: ["kd"],
    kopdesOrderShare: { kd: 0.5 },
    paymentSlaDays: 7,
    allergenExclusions: [],
    seasoningCostRp: { small: 0, large: 0 },
  };
  const cycle: MenuCycle = {
    id: "c",
    kitchenId: "k",
    days: Array.from({ length: 20 }, (_, i) => ({ dayIndex: i + 1, dishIds: ["dx"] })),
    lockedDishIds: [],
  };
  return { ingredient, dish, kitchen, cycle };
}
