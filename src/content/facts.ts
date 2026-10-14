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
    sourceName: "detikFinance (BGN data)",
    sourceUrl: "https://finance.detik.com/berita-ekonomi-bisnis/d-8501449/program-mbg-serap-1-28-juta-pekerja-tersebar-di-29-ribu-sppg",
    buildCheck: "confirmed",
    buildCheckNote:
      "BGN figures to 22 May 2026 (142,387 suppliers, 690 KDKMP) reported by detikFinance, TIMES Indonesia and ANTARA (seen in search results, Oct 2026). A later minister statement cites about 148,000 suppliers without a Kopdes breakdown.",
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
    buildCheck: "confirmed",
    buildCheckNote:
      "ANTARA Jateng, 30 Jun 2026 (DPKUKM Banyumas): all 331 KDMP formed with legal status, 41 inaugurated and operating (seen in search results, Oct 2026). A Sep 2026 village-heads report mentions about 56 operating.",
  },
  {
    id: "banyumas-partners",
    value: "~218",
    valueId: "~218",
    textEn: "MBG partners operate in Banyumas, and the Regent said food still reaches MBG kitchens through middlemen (tengkulak).",
    textId: "mitra MBG beroperasi di Banyumas, dan Bupati menyebut bahan pangan masih masuk ke dapur MBG lewat perantara atau tengkulak.",
    date: "2026-09-26",
    sourceName: "Suara Merdeka Banyumas",
    sourceUrl: "https://banyumas.suaramerdeka.com/banyumas/0917682538/paguyuban-mitra-mbg-dibentuk-dorong-standarisasi-dan-peningkatan-kualitas-dapur",
    buildCheck: "confirmed",
    buildCheckNote:
      "Suara Merdeka Banyumas (association launch, 26 Sep 2026): about 141 of 218 MBG partners joined; the Regent still finds food entering MBG kitchens through middlemen. iFakta (28 Sep 2026) also reports 218 partners. Seen in search results, Oct 2026.",
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
    value: "Not yet met",
    valueId: "Belum terpenuhi",
    textEn: "MBG demand from local raw materials, found a Central Java government study, which recommended an information system linking kitchens' ingredient needs to local producers (Ambarwati et al., 2025).",
    textId: "kebutuhan MBG dari bahan baku lokal, menurut kajian BRIDA Jawa Tengah, yang merekomendasikan sistem informasi kebutuhan bahan yang terhubung dengan produsen lokal (Ambarwati dkk., 2025).",
    date: "2025",
    sourceName: "BRIDA Jawa Tengah (Ambarwati et al.)",
    sourceUrl: "https://ejournal.jatengprov.go.id/index.php/AKD/article/view/1509",
    buildCheck: "confirmed",
    buildCheckNote:
      "\"Strategi Pemanfaatan Potensi Pangan Lokal untuk Mendukung Program MBG di Jawa Tengah\" (BRIDA Jawa Tengah, 2025): local demand not yet met; recommends an information system for material needs linked to local producers. Seen in search results, Oct 2026.",
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
