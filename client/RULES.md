# st.zen Admin - UI and Copy Rules
As of Aug 2026. Root client folder. Applies to `client/src/layouts` and `client/src/pages/admin`.

## Scope
Indonesian store operator. Repeat tasks. Check stock, fulfill order, import vault. Not marketing reader.

## Voice
Calm, direct, task focused. Fixed voice, shifting tone by context.

| Context | Tone | Example |
| --- | --- | --- |
| Table, filter | Neutral, noun labels | `Produk` `Kategori` |
| Success | Restrained | `Tersimpan` |
| Error | Honest plus actionable | `Gagal menyimpan. Periksa harga.` |
| Empty | Why plus next step | `Belum ada produk. Tambah produk.` |
| Destructive | Explicit consequence | `Hapus produk ini akan menghapus 40 kredensial.` |

## Hard Rules
1. No emojis in UI copy, toasts, buttons, empty states.
2. No em dashes or en dashes to join ideas. Use colon or separate line. Wrong: `Impor Stok - Vault`. Right: `Impor stok` plus hint `Format: email:password per baris`.
3. No gibberish paragraph under heading. Headings are navigation. `Ringkasan` alone is enough. No `Operasional harian st.zen stok, pesanan, dan pendapatan`.
4. No AI tone. No `Seamlessly manage`, `Elevate your workflow`, `Unlock potential`, `Effortlessly`.
5. No over technical copy in UI. No `payload`, `AES-256-GCM`, `PG Bouncer`, `allocation`, `transaction pooler`. Keep `vault` lowercased in hints only.
6. Sentence case everywhere. `Tambah produk` not `TAMBAH PRODUK`. Use weight and size for hierarchy, not caps.
7. One term always same. `Produk`, `Pesanan`, `Stok`, `Kategori`, `Harga`. Never alternate `item` or `credential` in UI. Glossary in `copy.ts`.
8. Buttons are verb plus object, 1 to 3 words. `Simpan`, `Hapus produk`, `Impor ke vault` not `Submit` or `PUSH TO VAULT`.
9. Labels are labels, placeholders are examples. Placeholder ends with ellipsis. `Nama produk` label plus `Contoh: Netflix Premium...`
10. Concise, under 14 words per sentence. Active voice. `Masukkan harga` not `Harga harus dimasukkan`.
11. State design for every table. Loading, empty with action, error with retry. Never blank.
12. Scannable. Most important information first. No long blocks. No header repeating intro.

## Button and Label Examples
* `Simpan` not `Persist modifications`
* `Hapus Spotify Family` not `Delete` or `OK`
* `Impor ke vault` not `PUSH TO VAULT`
* `Format: email:password per baris` not `RAW CREDENTIAL DATA [FORMAT: USER:PASS]`

## Empty and Error Examples
* Empty: `Belum ada produk. Tambah produk.` plus button `Tambah produk`
* Empty: `Belum ada pesanan. Pesanan masuk akan tampil di sini.`
* Error: `Gagal memuat produk. Periksa koneksi.` plus `Coba lagi`
* Empty stock: `Tidak ada produk di bawah ambang.`

## Visual Rules for Admin
* Flat white `border-zinc-200` cards, no colored left borders, no primary accent.
* Header is `Space Grotesk` `22px` `black` plus mono date. No paragraph.
* Table header `11px` `tracking 0.12em` `bold` `zinc-500` on `zinc-50`, rows `13px` `medium` plus `mono` for numbers.
* Badges are mono bordered `border-zinc-200` `bg-white` `11px`. Functional status only, no background tint except `stok 0` is `zinc-900` inverted.
* No `rounded-xl shadow-sm` card soup. Use `border` `p-5` with `h-px zinc-100` divider.
* Sidebar stays `bg-[#0f172a]` dark, topbar `bg-white` `border-b zinc-200`, main `bg-[#f4f5f7]` warm gray.

## Icon Pack
Current: `material-symbols-outlined`. Considered generic plus lucide-like, to be removed.
Replacement: personalized, monochrome, 1.5px stroke, square caps, consistent. No emoji style, no fill, no multi color. Use text fallback where icon adds no value. Options: custom st.zen line set or Tabler Outline 1.5px as interim. Never mix icon families in one view.

## Checklist Before Ship
* [ ] Every string read aloud, sounds like person to person
* [ ] Every word necessary, most important information first
* [ ] Clear next step for errors and empty states
* [ ] Consistent terms against glossary
* [ ] No jargon, no hedging `mungkin`, no apologies for system errors
* [ ] Button starts with verb, destructive includes object
