// The ONLY real-world statistics allowed in the UI. Each fact carries its source
// and date, and every place that shows one also shows a visible source link.
// Wording is neutral: gaps are "not yet connected" or "coordination gaps".

export interface Fact {
  id: string;
  value: string;
  valueId?: string;
  textEn: string;
  textId: string;
  date: string;
  sourceName: string;
  sourceUrl: string;
  /**
   * Result of the web cross-check done while building (Oct 2026). "confirmed": the
   * figure was found in the cited or an equivalent report. "unconfirmed": the
   * source could not be reached or the figure was not found; the team must open
   * the link and confirm before printing the poster.
   */
  buildCheck: "confirmed" | "unconfirmed";
  buildCheckNote?: string;
}

export const FACTS: Fact[] = [
  {
    id: "kopdes-share-2026-05",
    value: "0.48%",
    valueId: "0,48%",
    textEn: "of MBG suppliers were Koperasi Desa/Kelurahan Merah Putih: 690 of 142,387, as of 22 May 2026 (BGN data).",
    textId: "pemasok MBG adalah Koperasi Desa/Kelurahan Merah Putih: 690 dari 142.387, per 22 Mei 2026 (data BGN).",
    date: "2026-05-22",
    sourceName: "Liputan6",
    sourceUrl: "https://berita.liputan6.com/peristiwa/read/7100294/program-mbg-serap-128-juta-pekerja-ekonomi-rakyat-bergerak",
    buildCheck: "unconfirmed",
    buildCheckNote: "Liputan6 not reachable from the build sandbox; a July 2026 report cites about 148,000 MBG suppliers, consistent in scale.",
  },
  {
    id: "kopdes-share-2026-01",
    value: "0.32%",
    valueId: "0,32%",
    textEn: "of MBG suppliers were Kopdes Merah Putih: 199 of 61,857, as of 20 January 2026 (BGN at a DPR hearing).",
    textId: "pemasok MBG adalah Kopdes Merah Putih: 199 dari 61.857, per 20 Januari 2026 (BGN dalam rapat DPR).",
    date: "2026-01-20",
    sourceName: "ANTARA",
    sourceUrl: "https://www.antaranews.com/berita/5362630/bgn-harap-lebih-banyak-kopdes-merah-putih-jadi-supplier-mbg-pada-2026",
    buildCheck: "confirmed",
    buildCheckNote: "BGN figure of 61,857 suppliers with 199 Kopdes as of 20 Jan 2026 found in news reports.",
  },
  {
    id: "kopdes-outlets",
    value: "26,661",
    valueId: "26.661",
    textEn: "Kopdes Merah Putih outlets were reported complete, with operations starting 1 October 2026.",
    textId: "gerai Kopdes Merah Putih dilaporkan siap, dengan operasi mulai 1 Oktober 2026.",
    date: "2026-09-29",
    sourceName: "RCTI+ / Okezone",
    sourceUrl: "https://www.rctiplus.com/news/detail/okezone/5483215/1-oktober-kopdes-merah-putih-mulai-operasi--26-661-gerai-sudah-siap",
    buildCheck: "confirmed",
    buildCheckNote: "RCTI+/Okezone and iNews report 26,661 outlets ready and operations from 1 Oct 2026.",
  },
  {
    id: "banyumas-kopdes",
    value: "41 of 331",
    valueId: "41 dari 331",
    textEn: "Kopdes formed in Banyumas were operating, as of 30 June 2026.",
    textId: "Kopdes yang terbentuk di Banyumas sudah beroperasi, per 30 Juni 2026.",
    date: "2026-06-30",
    sourceName: "ANTARA Jateng",
    sourceUrl: "https://jateng.antaranews.com/berita/636865/dpkukm-sebut-sebanyak-41-kdmp-di-banyumas-telah-beroperasi",
    buildCheck: "unconfirmed",
    buildCheckNote: "Article not reachable. Other reports mention 331 planned outlets in Banyumas and 41 KDKMP ready for inauguration (May 2026).",
  },
  {
    id: "banyumas-partners",
    value: "~218",
    valueId: "~218",
    textEn: "MBG partners operate in Banyumas, and the Regent said kitchens still buy ingredients from outside the region or through middlemen.",
    textId: "mitra MBG beroperasi di Banyumas, dan Bupati menyebut dapur masih membeli bahan dari luar daerah atau lewat tengkulak.",
    date: "2026-09-28",
    sourceName: "iFakta",
    sourceUrl: "https://ifakta.co/2026/09/28/mitra-mbg-banyumas-bentuk-paguyuban-bupati-dorong-pemanfaatan-produk-lokal/",
    buildCheck: "unconfirmed",
    buildCheckNote: "iFakta article not reachable; the number 218 was not found elsewhere.",
  },
  {
    id: "chicken-pasar-wage",
    value: "Rp35k → Rp42k",
    valueId: "Rp35 rb → Rp42 rb",
    textEn: "per kg: chicken at Pasar Wage, Purwokerto rose from about Rp35,000 to Rp42,000 in December 2025.",
    textId: "per kg: harga ayam di Pasar Wage, Purwokerto naik dari sekitar Rp35.000 menjadi Rp42.000 pada Desember 2025.",
    date: "2025-12-20",
    sourceName: "detikJateng",
    sourceUrl: "https://www.detik.com/jateng/bisnis/d-8269021/harga-daging-ayam-di-pasar-wage-purwokerto-tembus-rp-42-ribu",
    buildCheck: "confirmed",
    buildCheckNote: "detikJateng, 20 Dec 2025: normal about Rp35,000/kg, now Rp42,000/kg.",
  },
  {
    id: "raw-food-budget",
    value: "Rp8,000 / Rp10,000",
    valueId: "Rp8.000 / Rp10.000",
    textEn: "raw-food budget per portion: PAUD to SD grade 3, and SD grade 4 and above.",
    textId: "anggaran bahan baku per porsi: PAUD sampai SD kelas 3, dan SD kelas 4 ke atas.",
    date: "2026-02-24",
    sourceName: "Tirto (BGN)",
    sourceUrl: "https://tirto.id/bgn-anggaran-bahan-makan-mbg-rp8000-rp10000-bukan-rp15000-hrtK",
    buildCheck: "confirmed",
    buildCheckNote: "Tirto, 24 Feb 2026: Rp8,000 (PAUD to SD 3) and Rp10,000 (SD 4+) per portion.",
  },
  {
    id: "min-15-suppliers",
    value: "15",
    valueId: "15",
    textEn: "raw-material suppliers at least, for each SPPG (BGN rule; Perpres No. 115/2025, Art. 38(1) prioritizes cooperatives and local MSMEs).",
    textId: "pemasok bahan baku minimal untuk setiap SPPG (aturan BGN; Perpres No. 115/2025 Pasal 38 ayat 1 memprioritaskan koperasi dan UMKM lokal).",
    date: "2026-02-24",
    sourceName: "BGN",
    sourceUrl: "https://www.bgn.go.id/news/siaran-pers/masih-banyak-mitra-sppg-memark-up-bahan-baku-pangan-mbg",
    buildCheck: "confirmed",
    buildCheckNote: "BGN (Nanik S. Deyang) requires at least 15 suppliers per SPPG. Perpres 115/2025 Art. 38(1) sets the priority for local MSMEs and cooperatives; the number 15 comes from BGN.",
  },
  {
    id: "no-shared-data",
    value: "No",
    valueId: "Belum ada",
    textEn: "real-time shared data across farmers, suppliers and SPPG, found by a Central Java policy study (Ambarwati et al., 2025).",
    textId: "data bersama real-time antara petani, pemasok, dan SPPG, menurut kajian kebijakan Jawa Tengah (Ambarwati dkk., 2025).",
    date: "2025",
    sourceName: "Jurnal Litbang Provinsi Jawa Tengah",
    sourceUrl: "https://ejournal.jatengprov.go.id/index.php/AKD/article/download/1509/857/",
    buildCheck: "unconfirmed",
    buildCheckNote: "Journal PDF not reachable from the build sandbox.",
  },
  {
    id: "brazil-45",
    value: "45%",
    valueId: "45%",
    textEn: "of federal school-food funds must buy directly from family farmers in Brazil, effective 1 January 2026 (Lei 15.226/2025).",
    textId: "dana makan sekolah federal di Brasil wajib membeli langsung dari petani keluarga, berlaku 1 Januari 2026 (Lei 15.226/2025).",
    date: "2026-01-01",
    sourceName: "Planalto (Brazil)",
    sourceUrl: "https://www.planalto.gov.br/CCIVIL_03/_Ato2023-2026/2025/Lei/L15226.htm",
    buildCheck: "confirmed",
    buildCheckNote: "Lei 15.226 of 30 Sep 2025 raises the PNAE family-farming minimum from 30% to 45%, from 1 Jan 2026.",
  },
];

export const LANDING_FACT_IDS = ["kopdes-share-2026-05", "banyumas-kopdes", "banyumas-partners", "chicken-pasar-wage"];

export function getFact(id: string): Fact {
  const f = FACTS.find((x) => x.id === id);
  if (!f) throw new Error(`Unknown fact ${id}`);
  return f;
}
