"use client";

import { useT } from "@/i18n";

// Extra strings for the Kitchens and Cooperatives tabs in Manage.

export const en = {
  addKitchen: "Add kitchen",
  newKitchen: "New kitchen",
  addKopdes: "Add Kopdes",
  newKopdes: "New Kopdes",
  editTitle: (name: string) => `Edit ${name}`,
  children: (n: string) => `${n} children`,
  paysWithin: (n: number) => `Pays within ${n} days`,
  noLinks: "Not linked to a Kopdes yet",
  noKopdesYet: "Add a Kopdes first, then link it here.",
  shareTotal: (pct: string) => `All Kopdes together: ${pct}`,
  neighborsList: (names: string) => `Neighbors: ${names}`,
  noNeighbors: "No neighbor Kopdes",
  noOtherKopdes: "No other Kopdes yet.",
  withFarmers: (name: string, n: number) => `${name} (${n} member farmers)`,
  calendarTitle: (name: string) => `School calendar: ${name}`,
  date: "Date",
  noHolidays: "No closed days yet.",
  noSchoolDays: "Choose at least one school day.",
  removeHoliday: (what: string) => `Remove closed day ${what}`,
  closedDays: (n: number) => (n === 1 ? "1 closed day" : `${n} closed days`),
  invalidCoords: "Latitude must be between -90 and 90, longitude between -180 and 180.",
};

export type PlacesStrings = typeof en;

export const id: PlacesStrings = {
  addKitchen: "Tambah dapur",
  newKitchen: "Dapur baru",
  addKopdes: "Tambah Kopdes",
  newKopdes: "Kopdes baru",
  editTitle: (name) => `Ubah ${name}`,
  children: (n) => `${n} anak`,
  paysWithin: (n) => `Bayar dalam ${n} hari`,
  noLinks: "Belum terhubung ke Kopdes",
  noKopdesYet: "Tambahkan Kopdes dulu, lalu hubungkan di sini.",
  shareTotal: (pct) => `Semua Kopdes bersama: ${pct}`,
  neighborsList: (names) => `Tetangga: ${names}`,
  noNeighbors: "Tidak ada Kopdes tetangga",
  noOtherKopdes: "Belum ada Kopdes lain.",
  withFarmers: (name, n) => `${name} (${n} petani anggota)`,
  calendarTitle: (name) => `Kalender sekolah: ${name}`,
  date: "Tanggal",
  noHolidays: "Belum ada hari tutup.",
  noSchoolDays: "Pilih minimal satu hari sekolah.",
  removeHoliday: (what) => `Hapus hari tutup ${what}`,
  closedDays: (n) => `${n} hari tutup`,
  invalidCoords: "Lintang harus antara -90 dan 90, bujur antara -180 dan 180.",
};

export function usePlacesStrings(): PlacesStrings {
  return useT().lang === "id" ? id : en;
}
