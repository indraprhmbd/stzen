# i18n System + Homepage Sections

**Date:** 2026-08-28
**Scope:** 10 files (2 new, 8 modified)
**Status:** Implemented

## Problem

1. All UI text hardcoded in English — main customer base is Indonesian
2. Homepage missing key sections: How It Works, Why st.zen, Testimonials
3. No centralized copy — strings scattered across components

## Decisions

1. **Option C: Centralized copy with language toggle** — no i18n library, pure TypeScript
2. **Indonesian as default language** — English available via toggle
3. **Language toggle in header** — simple ID/EN button, persists to localStorage
4. **All UI strings extracted** to `config/copy.ts` — components never hardcode text
5. **Homepage additions:** How It Works (4 steps), Why st.zen (3 benefits), Testimonials (2-3 quotes)

## Architecture

### i18n System

```
config/copy.ts     — all strings in id + en
hooks/useCopy.ts   — hook: { t, lang, toggle }
Header.tsx         — language toggle button
```

- `copy.ts`: single source of truth, ~30-40 strings per language
- `useCopy.ts`: reads/writes `localStorage('stzen-lang')`, returns `t` (current copy)
- No deps beyond React useState

### Homepage Sections

```
Hero Banner (existing)
How It Works (NEW — 4 steps)
Section Header + FilterBar + Product Grid (existing)
Why st.zen (NEW — 3 benefits)
Testimonials (NEW — 2-3 quotes)
Footer (existing)
```

## Changes

### New Files

| File | Purpose |
|---|---|
| `client/src/config/copy.ts` | All UI strings, id + en |
| `client/src/hooks/useCopy.ts` | Language hook with localStorage |

### Modified Files

| File | Changes |
|---|---|
| `components/Header.tsx` | Add lang toggle, wire nav labels |
| `components/Footer.tsx` | Wire footer labels |
| `components/ProductCard.tsx` | Wire button/stock labels |
| `components/FilterBar.tsx` | Wire "All" label |
| `pages/Catalog.tsx` | Add 3 sections, wire all copy |
| `pages/Login.tsx` | Wire form labels |
| `pages/Dashboard.tsx` | Wire tab labels |

## Indonesian Copy

```ts
hero: { tagline: 'Akses Instan Akun Digital Premium', cta: 'BELI SEKARANG' }
howItWorks: {
  title: 'CARA KERJA',
  steps: [
    { num: '01', title: 'Pilih Produk', desc: 'Pilih akun digital yang kamu butuhkan' },
    { num: '02', title: 'Pesan & Bayar', desc: 'Buat pesanan dan transfer pembayaran' },
    { num: '03', title: 'Verifikasi', desc: 'Tim kami memverifikasi pembayaranmu' },
    { num: '04', title: 'Terima Akses', desc: 'Kredensial dikirim ke dashboard kamu' },
  ]
}
whyUs: {
  title: 'KENAPA ST.ZEN?',
  items: [
    { title: 'Akses Instan', desc: 'Dapatkan kredensial langsung setelah pembayaran dikonfirmasi' },
    { title: 'Privasi & Aman', desc: 'Kredensialmu tetap terenkripsi dan terlindungi' },
    { title: 'Diverifikasi Orang', desc: 'Setiap pesanan dicek sebelum dikirim' },
  ]
}
testimonials: {
  title: 'APA KATA MEREKA',
  items: [
    { quote: 'Prosesnya cepat, langsung dapat akses setelah bayar. Recommended!', name: 'Rizky A.', product: 'Netflix Premium' },
    { quote: 'Aman dan terpercaya. Kredensialnya work semua.', name: 'Diana P.', product: 'ChatGPT Plus' },
    { quote: 'Pertama beli di sini, hasilnya memuaskan. Akan beli lagi.', name: 'Fajar M.', product: 'Spotify Family' },
  ]
}
```

## Visual Summary

| Section | Style |
|---|---|
| How It Works | 4-col grid, step numbers lime, `bg-surface-container rounded-md` |
| Why st.zen | 3-col grid, lighter borders, icons + text |
| Testimonials | 3-col grid, quote cards, `bg-surface-container rounded-md` |
| Lang Toggle | Header, `ID`/`EN` button, `border-[2px] rounded-sm` |
