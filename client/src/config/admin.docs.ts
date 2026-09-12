// ─── Admin Guide Content ────────────────────────────────────────────────────
// Non-technical operator manual, Indonesian only. Hardcoded by design: content
// changes with releases, versioned with code, zero backend cost.
// Every section ends with links to the real page or tab it describes.

export interface AdminDocLink {
  label: string
  to: string
}

export interface AdminDocSection {
  id: string
  title: string
  intro: string
  points: string[]
  links: AdminDocLink[]
}

export interface AdminDocFaq {
  q: string
  a: string
  links: AdminDocLink[]
}

export const adminDocSections: AdminDocSection[] = [
  {
    id: 'ringkasan',
    title: 'Ringkasan',
    intro:
      'Halaman pembuka admin. Berisi angka penting toko, grafik penjualan, antrean yang butuh tindakan, dan varian yang stoknya menipis. Mulai hari dari sini.',
    points: [
      'Kartu Produk Aktif: jumlah produk yang tampil di katalog. Klik untuk buka halaman Produk.',
      'Kartu Stok Tersedia: total kredensial siap jual di vault. Klik untuk buka tab Stok.',
      'Kartu Perlu Tindakan: pesanan PENDING dan PAID yang menunggu Anda. Klik untuk buka antrean Pesanan.',
      'Kartu Pendapatan: total dari pesanan PAID dan DELIVERED. Ikon mata untuk sembunyikan angka saat layar dilihat orang lain.',
      'Grafik: pilih rentang 7, 30, atau 90 hari untuk lihat tren penjualan per hari, per status, dan produk terlaris.',
      'Stok Menipis: varian di bawah ambang batas. Tambah kredensial sebelum habis agar pesanan tidak tertahan.',
    ],
    links: [
      { label: 'Buka Produk', to: '/admin/products' },
      { label: 'Buka tab Stok', to: '/admin/products?tab=stok' },
      { label: 'Buka antrean Pesanan', to: '/admin/orders' },
    ],
  },
  {
    id: 'produk',
    title: 'Produk (tab Produk)',
    intro:
      'Produk adalah induk barang dagangan, misalnya Akun Netflix atau Spotify. Pelanggan melihat produk di katalog, lalu memilih varian (durasi dan tipe akun) saat membeli.',
    points: [
      'Tambah produk: tombol Tambah, isi nama, kategori, deskripsi, dan instruksi untuk pembeli.',
      'Status aktif: hanya produk aktif yang tampil di katalog. Nonaktifkan untuk sembunyikan sementara tanpa menghapus.',
      'Ubah dan hapus: ikon pensil untuk ubah, ikon sampah untuk hapus. Produk berisi varian tidak bisa dihapus dari sini, hapus permanen lewat Danger Zone di Pengaturan (beserta variannya, tuntas dalam satu tindakan).',
      'Harga tidak diatur di sini. Harga diatur per varian di tab Varian.',
    ],
    links: [{ label: 'Buka tab Produk', to: '/admin/products?tab=basis' }],
  },
  {
    id: 'varian',
    title: 'Varian (tab Varian)',
    intro:
      'Varian adalah pilihan beli di dalam satu produk, misalnya Netflix 1 Bulan Sharing atau 1 Bulan Private. Setiap varian punya harga, durasi, dan cara pemenuhan sendiri.',
    points: [
      'Tambah varian: pilih produk induk, isi nama, harga, durasi bulan, dan tipe akun.',
      'Vault: stok berupa kredensial yang Anda impor. Pesanan dikirim otomatis dari stok saat Anda tekan Kirim.',
      'On-demand: tidak punya stok. Saat kirim, Anda ketik atau tempel kredensial manual di dialog.',
      'Tombol Impor di tiap varian langsung lompat ke tab Stok dengan varian sudah terpilih.',
      'Menonaktifkan varian menyembunyikannya dari pembeli tanpa menghapus stok yang sudah ada.',
    ],
    links: [
      { label: 'Buka tab Varian', to: '/admin/products?tab=varian' },
      { label: 'Buka tab Stok', to: '/admin/products?tab=stok' },
    ],
  },
  {
    id: 'stok',
    title: 'Stok (tab Stok)',
    intro:
      'Stok adalah gudang kredensial (vault). Setiap baris berisi satu akun format email:password dan terikat ke satu varian. Pesanan vault mengambil dari sini.',
    points: [
      'Impor: pilih varian, tempel daftar kredensial satu per baris format email:password, lalu simpan.',
      'Satu kredensial hanya bisa dipakai satu pesanan. Setelah dikirim, statusnya berubah dan tidak dikirim dua kali.',
      'Vault dikunci otomatis setelah beberapa menit. Tekan Buka untuk token 10 menit, kunci lagi setelah selesai.',
      'Angka di kartu Stok Menipis ikut ambang di Pengaturan Operasional. Minta ubah ambang jika terlalu sering atau jarang muncul.',
    ],
    links: [{ label: 'Buka tab Stok', to: '/admin/products?tab=stok' }],
  },
  {
    id: 'pesanan',
    title: 'Pesanan',
    intro:
      'Semua uang masuk lewat sini. Tab Butuh Tindakan adalah antrean kerja utama: pesanan paling lama di atas, kerjakan dari atas ke bawah.',
    points: [
      'Butuh Tindakan: gabungan PENDING (menunggu verifikasi bayar) dan PAID (siap kirim), diurut paling lama dulu.',
      'Setujui: PENDING menjadi PAID. Artinya pembayaran terverifikasi, pesanan siap dikirim.',
      'Tolak: PENDING menjadi DITOLAK. Selalu konfirmasi dulu di dialog, penolakan tidak bisa dibatalkan.',
      'Kirim: PAID menjadi TERKIRIM. Varian vault mengambil kredensial otomatis dari stok. Varian on-demand meminta Anda ketik kredensial di dialog.',
      'Refund: PAID kembali menjadi REFUND. Stok vault yang sudah terambil dilepas kembali.',
      'Struk: semua pesanan selain PENDING punya struk berisi ID, tanggal, produk, jumlah, dan ref bayar. Bisa dicetak.',
      'Manual: buat pesanan atas nama pelanggan yang bayar di luar sistem (tunai atau transfer langsung). Pelanggan harus sudah punya akun.',
      'Ekspor CSV: unduh maksimal sejumlah Batas ekspor CSV per sekali unduh. Persempit dengan filter atau tab bila data besar.',
      'Semua: arsip seluruh status untuk audit dan pencarian pesanan lama.',
    ],
    links: [
      { label: 'Buka antrean', to: '/admin/orders' },
      { label: 'Buka arsip Semua', to: '/admin/orders?status=semua' },
      { label: 'Buka Terkirim', to: '/admin/orders?status=terkirim' },
    ],
  },
  {
    id: 'riwayat',
    title: 'Riwayat',
    intro:
      'Catatan permanen semua kejadian: siapa melakukan apa, kapan, ke pesanan mana. Dipakai untuk audit dan melacak kesalahan.',
    points: [
      'Filter tipe: saring berdasarkan jenis kejadian, misalnya approve, deliver, atau refund.',
      'Filter pelaku: admin (Anda dan tim), user (pelanggan), atau system (otomatis).',
      'Pencarian: cari berdasarkan ID pesanan, nama produk, atau email.',
      'Klik judul kolom untuk ubah urutan naik atau turun.',
      'Riwayat tidak bisa dihapus. Inilah bukti bila ada selisih dengan pelanggan.',
    ],
    links: [{ label: 'Buka Riwayat', to: '/admin/history' }],
  },
  {
    id: 'pengaturan',
    title: 'Pengaturan',
    intro:
      'Identitas toko, info bantuan, rekening pembayaran, dan angka operasional. Perubahan disimpan per grup dan langsung berlaku.',
    points: [
      'Toko: nama toko dan pengumuman. Pengumuman tampil sebagai teks berjalan di katalog. Kosongkan untuk sembunyikan. Perubahan teks berjalan butuh waktu sampai satu menit tampil di semua pengunjung.',
      'Bantuan: kontak WhatsApp, Telegram, dan email yang dilihat pelanggan.',
      'Pembayaran: nama bank, nomor, dan nama rekening untuk pembayaran manual. Periksa dua kali sebelum simpan.',
      'Operasional: ambang stok menipis, lama vault terbuka, dan batas ekspor CSV.',
      'Ganti kata sandi: wajib isi kata sandi saat ini dulu sebagai konfirmasi, lalu sandi baru dua kali.',
      'Danger Zone: tiga tier permanen di bawah kartu Akun. Tier 1 menolak massal pesanan basi, Tier 2 menghapus produk atau varian TANPA riwayat (nol pesanan, nol stok), Tier 3 purge stok basi dan wajib ekspor CSV dulu. Pesanan tidak pernah dihapus (arsip pajak 10 tahun). Setiap eksekusi minta frasa ketik plus kata sandi saat ini.',
    ],
    links: [{ label: 'Buka Pengaturan', to: '/admin/settings' }],
  },
  {
    id: 'danger',
    title: 'Danger Zone',
    intro:
      'Tiga tier tindakan permanen. Menonaktifkan dari tab Produk selalu cukup untuk barang yang tidak dijual lagi; penghapusan hanya untuk baris yang benar-benar tanpa jejak. Semua tindakan tercatat di Riwayat.',
    points: [
      'Tier 1 tolak basi: pratinjau hitung pesanan PENDING tanpa payment_ref lebih tua dari N hari, ketik TOLAK, eksekusi maksimal 200 per tindakan. Ulangi sampai pratinjau nol.',
      'Tier 2 hapus katalog: pratinjau tunjukkan varian, stok, dan pesanan terkait. Ditolak bila ada pesanan aktif, riwayat pesanan, atau sisa stok maupun kredensial terjual. Frasa konfirmasi adalah public_id persis.',
      'Tier 3 purge: hanya stok AVAILABLE di atas 180 hari. Alur wajib dua langkah: Ekspor CSV dulu (token sekali pakai 15 menit), lalu ketik HAPUS PERMANEN.',
      'Pesanan PAID, TERKIRIM, dan REFUND tidak bisa dihapus atau di purge oleh siapa pun. Ini arsip pajak 10 tahun.',
    ],
    links: [{ label: 'Buka Danger Zone', to: '/admin/settings' }],
  },
]

export const adminDocFaq: AdminDocFaq[] = [
  {
    q: 'Pesanan macet di PENDING, apa yang harus dilakukan?',
    a: 'Cek bukti bayar dari pelanggan, lalu tekan Setujui bila valid atau Tolak bila tidak. Antrean Butuh Tindakan mengurut paling lama di atas, jadi yang macet selalu paling terlihat.',
    links: [{ label: 'Buka antrean', to: '/admin/orders' }],
  },
  {
    q: 'Stok habis saat mau kirim pesanan vault?',
    a: 'Jangan kirim dulu. Impor kredensial untuk varian tersebut di tab Stok, lalu kembali dan tekan Kirim. Pesanan tetap PAID dan aman menunggu.',
    links: [{ label: 'Buka tab Stok', to: '/admin/products?tab=stok' }],
  },
  {
    q: 'Salah tekan refund, bisa dibatalkan?',
    a: 'Tidak. Refund melepas stok kembali ke vault dan statusnya final. Buat pesanan manual baru bila pelanggan tetap harus dilayani.',
    links: [{ label: 'Buka antrean', to: '/admin/orders' }],
  },
  {
    q: 'Pengumuman katalog belum berubah setelah disimpan?',
    a: 'Tunggu sampai satu menit, teks berjalan disimpan di cache. Bila lebih dari itu, muat ulang halaman katalog tanpa cache.',
    links: [{ label: 'Buka Pengaturan', to: '/admin/settings' }],
  },
  {
    q: 'Halaman admin tiba-tiba 404 padahal kemarin bisa dibuka?',
    a: 'Sesi login kedaluwarsa. Buka halaman masuk, login lagi, lalu kembali ke halaman admin. Ini normal dan bukan error.',
    links: [],
  },
  {
    q: 'Pelanggan komplain pesanan tidak ada, bagaimana lacaknya?',
    a: 'Cari email atau ID pesanan di tab Semua, lalu cek Riwayat untuk lihat seluruh kejadian pesanan itu dari dibuat sampai dikirim.',
    links: [
      { label: 'Buka arsip Semua', to: '/admin/orders?status=semua' },
      { label: 'Buka Riwayat', to: '/admin/history' },
    ],
  },
  {
    q: 'Kapan boleh pakai Danger Zone Tier 3 purge?',
    a: 'Hanya untuk stok AVAILABLE basi di atas 180 hari yang tidak pernah terjual. Wajib ekspor CSV dulu sebagai cadangan, token sekali pakai 15 menit. Pesanan tidak pernah bisa di purge: arsip pajak wajib 10 tahun.',
    links: [{ label: 'Buka Danger Zone', to: '/admin/settings' }],
  },
  {
    q: 'Kenapa hapus produk ditolak padahal sudah tidak dijual?',
    a: 'Selama masih ada pesanan, stok, atau kredensial terjual yang merujuk produk itu, penghapusan ditolak agar kredensial pembeli tetap bisa dibuka. Nonaktifkan saja dari tab Produk: hilang dari katalog, riwayat utuh.',
    links: [{ label: 'Buka Danger Zone', to: '/admin/settings' }],
  },
]
