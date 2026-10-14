import { useT } from "@/i18n";

// Dishes tab texts not yet in the dictionaries.

export const en = {
  newDish: "New dish",
  editDish: (name: string) => `Edit ${name}`,
  addDish: "Add dish",
  ingredient: "Ingredient",
  mainMissing: "The main ingredient must be one of the ingredients below.",
  duplicate: "Each ingredient can be listed only once.",
  needComponent: "Add at least one ingredient.",
  gramsRange: "Enter grams from 0 to 1000.",
  count: (n: number) => `${n} dishes`,
  locked: "Locked by the nutritionist",
  noCycle: "This kitchen has no menu cycle yet.",
  noKitchen: "Add a kitchen first, then plan its menu.",
  emptyDay: "No dishes",
  readOnly: "You can view this menu. Only this kitchen's team can change it.",
};

export const id: typeof en = {
  newDish: "Masakan baru",
  editDish: (name: string) => `Ubah ${name}`,
  addDish: "Tambah masakan",
  ingredient: "Bahan",
  mainMissing: "Bahan utama harus termasuk dalam daftar bahan di bawah.",
  duplicate: "Setiap bahan hanya boleh dicantumkan sekali.",
  needComponent: "Tambahkan minimal satu bahan.",
  gramsRange: "Isi gram dari 0 sampai 1000.",
  count: (n: number) => `${n} masakan`,
  locked: "Dikunci ahli gizi",
  noCycle: "Dapur ini belum punya siklus menu.",
  noKitchen: "Tambahkan dapur dulu, lalu susun menunya.",
  emptyDay: "Belum ada masakan",
  readOnly: "Anda dapat melihat menu ini. Hanya tim dapur ini yang bisa mengubahnya.",
};

export function useDishesStrings() {
  const { lang } = useT();
  return lang === "id" ? id : en;
}
