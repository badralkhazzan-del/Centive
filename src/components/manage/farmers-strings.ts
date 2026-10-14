"use client";

import { useT } from "@/i18n";

export const en = {
  search: "Search by name or village",
  searchPlaceholder: "e.g. Siti or Sukamaju",
  noMatch: "No farmer matches this search.",
  allKopdes: "All Kopdes",
  product: "Product",
  removeProduct: (name: string) => `Remove product: ${name || "empty"}`,
  phonePlaceholder: "e.g. 0812 3456 7890",
  phoneKeep: (masked: string) => `Stored: ${masked}. Leave empty to keep it.`,
  phoneInvalid: "Enter 8 to 15 digits.",
  duplicateProduct: "Each product can be listed only once.",
  noKopdes: "Add a cooperative (Kopdes) first, then add its farmers.",
  count: (shown: number, total: number) => (shown === total ? `${total} farmers` : `${shown} of ${total} farmers`),
  newFarmer: "New farmer",
  editFarmer: (name: string) => `Edit ${name}`,
};

export const id: typeof en = {
  search: "Cari nama atau desa",
  searchPlaceholder: "mis. Siti atau Sukamaju",
  noMatch: "Tidak ada petani yang cocok.",
  allKopdes: "Semua Kopdes",
  product: "Produk",
  removeProduct: (name: string) => `Hapus produk: ${name || "kosong"}`,
  phonePlaceholder: "mis. 0812 3456 7890",
  phoneKeep: (masked: string) => `Tersimpan: ${masked}. Kosongkan untuk tetap memakainya.`,
  phoneInvalid: "Masukkan 8 sampai 15 angka.",
  duplicateProduct: "Setiap produk hanya boleh dicatat sekali.",
  noKopdes: "Tambahkan koperasi (Kopdes) dulu, lalu petaninya.",
  count: (shown: number, total: number) => (shown === total ? `${total} petani` : `${shown} dari ${total} petani`),
  newFarmer: "Petani baru",
  editFarmer: (name: string) => `Ubah ${name}`,
};

export function useFarmersStrings() {
  const { lang } = useT();
  return lang === "id" ? id : en;
}
