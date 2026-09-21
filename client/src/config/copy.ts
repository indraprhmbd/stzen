export interface LegalSection { h: string; p: string[] }
export interface LegalDoc { title: string; desc: string; updated: string; sections: LegalSection[]; matrix?: { title: string; formula: string; note: string; head: string[]; rows: string[][] } }

export interface Copy {
  nav: { home: string; shop: string; myOrders: string; admin: string; profile: string }
  auth: {
    signIn: string; signOut: string; signInWithGoogle: string; email: string; password: string; or: string; backToStore: string;
    signUp: string; signUpTitle: string; signUpSubtitle: string; confirmPassword: string; noAccount: string; hasAccount: string;
    forgotPassword: string; forgotPasswordTitle: string; forgotPasswordSubtitle: string; backToLogin: string;
    updatePassword: string; updatePasswordTitle: string; updatePasswordSubtitle: string; newPassword: string; confirmNewPassword: string;
    verifyEmail: string; verifyEmailTitle: string; verifyEmailSubtitle: string; resendEmail: string; emailSent: string;
    checkInbox: string; spamHint: string; successRedirect: string;
  }
  hero: { title1: string; title2: string; tagline: string; cta: string; cardTitle1: string; cardTitle2: string; cardTagline: string; statusPill: string; searchPlaceholder: string; searchHint: string }
  marquee: string[]
  products: { title: string; buy: string; buyNow: string; soldOut: string; inStock: string; onlyXLeft: string; outOfStock: string; sortNewest: string; sortPrice: string; sortStock: string; sortOutOfStock: string; viewGrid: string; viewList: string; verifiedBuyer: string; loginForMore: string; confirmTitle: string; confirmNote: string; confirmCancel: string; confirmGo: string; confirmPlace: string; processing: string; methodTitle: string; methodAutoMin: string; methodManualHours: string; methodAuto: string; methodAutoDesc: string; methodManual: string; methodManualDesc: string; accountLabel: string; accountPlaceholder: string; waLabel: string; waPlaceholder: string; errAccount: string; errWa: string; termsAgree: string; termsShow: string; errTerms: string; manualPlaced: string; manualPlacedNote: string; waConfirm: string; waConfirmText: string; feeLabel: string; viewCategory: string; viewBadge: string; askAdmin: string; askAdminText: string }
  howItWorks: { title: string; steps: { num: string; title: string; desc: string }[] }
  whyUs: { title: string; items: { title: string; desc: string }[] }
  testimonials: { title: string; items: { quote: string; name: string; product: string }[] }
  footer: { rights: string; howToOrder: string; paymentMethods: string; faq: string; myOrders: string; terms: string; privacy: string; refunds: string }
  filter: { all: string }
  dashboard: { title: string; subtitle: string; tabs: string[]; noOrders: string; selectOrder: string; payNow: string; contactWa: string; cancelOrder: string; viewCredentials: string; receipt: string; reportIssue: string; cancelConfirm: string; paymentVerified: string; accountDelivered: string; paymentFailed: string; orderCancelled: string; loadMore: string }
  profile: { title: string; guest: string; guestHint: string; language: string; quickLinks: string; signOutTitle: string; signOutDesc: string; cancel: string; confirmSignOut: string }
  payment: { waiting: string; paid: string; failed: string; cancelled: string; waitingHint: string; paidHint: string; deliveredHint: string; failedHint: string; toDashboard: string }
  common: { noProducts: string; copiedToClipboard: string }
  pagination: { showing: string; of: string }
  notFound: { title: string; subtitle: string; home: string; login: string }
  info: {
    howToOrder: { title: string; desc: string; steps: { num: string; title: string; desc: string }[] }
    paymentMethods: { title: string; desc: string; methods: { name: string; detail: string; badge: string }[] }
    faq: { title: string; desc: string; items: { q: string; a: string }[] }
  }
  legal: { terms: LegalDoc; privacy: LegalDoc; refunds: LegalDoc }
  admin: {
    sidebar: { overview: string; products: string; orders: string }
    overview: { title: string; totalProducts: string; totalStock: string; pendingOrders: string; revenue: string; recentOrders: string; lowStock: string; noData: string }
    products: { title: string; searchPlaceholder: string; categoryAll: string; addProduct: string; editProduct: string; createProduct: string; updateProduct: string; deleteConfirm: string; name: string; category: string; price: string; badge: string; description: string; instructions: string; status: string; stock: string; actions: string; edit: string; delete: string; active: string; inactive: string; stockImport: string; targetProduct: string; selectProduct: string; rawDataLabel: string; rawDataPlaceholder: string; importButton: string; cancel: string }
    orders: { title: string; searchPlaceholder: string; statusAll: string; approve: string; reject: string; deliver: string; id: string; date: string; product: string; customer: string; amount: string; status: string; actions: string; noOrders: string }
  }
}

const id: Copy = {
  nav: { home: 'Beranda', shop: 'Belanja', myOrders: 'Pesanan Saya', admin: 'Admin', profile: 'Akun' },
  auth: { signIn: 'Masuk', signOut: 'Keluar', signInWithGoogle: 'Masuk dengan Google', email: 'EMAIL', password: 'PASSWORD', or: 'ATAU', backToStore: 'Kembali ke toko', signUp: 'Daftar', signUpTitle: 'BUAT AKUN', signUpSubtitle: 'Daftar untuk mulai berbelanja', confirmPassword: 'KONFIRMASI PASSWORD', noAccount: 'Belum punya akun?', hasAccount: 'Sudah punya akun?', forgotPassword: 'Lupa Password', forgotPasswordTitle: 'RESET PASSWORD', forgotPasswordSubtitle: 'Masukkan email untuk menerima link reset', backToLogin: 'Kembali ke login', updatePassword: 'Update Password', updatePasswordTitle: 'PASSWORD BARU', updatePasswordSubtitle: 'Masukkan password baru untuk akunmu', newPassword: 'PASSWORD BARU', confirmNewPassword: 'KONFIRMASI PASSWORD BARU', verifyEmail: 'Verifikasi Email', verifyEmailTitle: 'CEK EMAIL KAMU', verifyEmailSubtitle: 'Kami sudah mengirim link verifikasi', resendEmail: 'Kirim ulang email', emailSent: 'Email terkirim', checkInbox: 'Cek inbox kamu', spamHint: 'Jangan lupa cek folder spam jika tidak menemukan email', successRedirect: 'Verifikasi berhasil, mengalihkan...' },
  hero: {
    title1: 'AKSES INSTAN',
    title2: 'AKUN DIGITAL PREMIUM',
    tagline: 'Akses Instan Akun Digital Premium',
    cta: 'BELI SEKARANG',
    cardTitle1: 'PILIH. BAYAR.',
    cardTitle2: 'LANGSUNG DAPAT.',
    cardTagline: 'Terkirim otomatis. Garansi 30 hari.',
    statusPill: '1.420+ AKUN OTOMATIS TERKIRIM HARI INI',
    searchPlaceholder: 'CARI PRODUK...',
    searchHint: 'Ctrl+K',
  },
  marquee: [
    'LANGSUNG SAMPAI',
    'AMAN & TERENKRIPSI',
    'PROSES CEPAT',
    'BANTUAN 24 JAM',
  ],
  products: {
    title: 'SEMUA PRODUK',
    buy: 'Beli',
    buyNow: 'BELI SEKARANG',
    soldOut: 'Habis',
    inStock: 'Stok Tersedia',
    onlyXLeft: 'Sisa',
    outOfStock: 'Habis',
    sortNewest: 'Terbaru',
    sortPrice: 'Termurah',
    sortStock: 'Stok Ada',
    sortOutOfStock: 'Stok Habis',
    viewGrid: 'Grid',
    viewList: 'List',
    verifiedBuyer: 'PEMBELI TERVERIFIKASI',
    loginForMore: 'Login untuk melihat semua produk',
    confirmTitle: 'KONFIRMASI PESANAN',
    confirmNote: 'Tanpa keranjang, pesanan langsung dibuat dan lanjut ke pembayaran. Pastikan produk dan harga sudah benar.',
    confirmCancel: 'BATAL',
    confirmGo: 'LANJUT BAYAR',
    confirmPlace: 'TARUH PESANAN',
    processing: 'Memproses...',
    methodTitle: 'METODE PEMBAYARAN',
    methodAutoMin: 'QRIS otomatis tersedia untuk harga Rp{min} ke atas. Di bawah itu hanya pesanan manual.',
    methodManualHours: 'Admin aktif 08.00-20.00 WIB. Pesanan di luar jam itu tetap tercatat dan diproses jam aktif berikutnya.',
    methodAuto: 'QRIS Otomatis',
    methodAutoDesc: 'Bayar sekarang via QRIS, akun langsung diproses.',
    methodManual: 'Pesanan Manual',
    methodManualDesc: 'Taruh pesanan, konfirmasi via WhatsApp ke admin.',
    accountLabel: 'AKUN TUJUAN',
    accountPlaceholder: 'Email / username untuk aktivasi',
    waLabel: 'NOMOR WHATSAPP',
    waPlaceholder: '08xxxxxxxxxx',
    errAccount: 'Akun tujuan wajib diisi (3-120 karakter).',
    errWa: 'Nomor WA tidak valid (format 08..).',
    termsAgree: 'Saya menyetujui Syarat & Ketentuan di atas.',
    termsShow: 'Lihat Syarat & Ketentuan',
    errTerms: 'Centang persetujuan Syarat & Ketentuan dulu.',
    manualPlaced: 'PESANAN DITERIMA',
    manualPlacedNote: 'Pesanan manual tercatat. Konfirmasi ke admin via WhatsApp agar segera diproses.',
    waConfirm: 'KONFIRMASI VIA WA',
    waConfirmText: 'Halo, konfirmasi pesanan manual {id} ({product}).',
    feeLabel: 'BIAYA LAYANAN',
    viewCategory: 'Lihat produk kategori {category}',
    viewBadge: 'Lihat produk berlabel {badge}',
    askAdmin: 'Tanya Admin!',
    askAdminText: 'Halo admin, saya mau tanya tentang {product}.',
  },
  howItWorks: {
    title: 'CARA KERJA',
    steps: [
      { num: '1', title: 'Pilih Produk', desc: 'Cari akun, cek stok' },
      { num: '2', title: 'Pesan & Bayar', desc: 'QRIS atau transfer' },
      { num: '3', title: 'Verifikasi', desc: 'Otomatis, hitungan detik' },
      { num: '4', title: 'Terima Akses', desc: 'Masuk dashboard, langsung pakai' },
    ],
  },
  whyUs: {
    title: 'KENAPA ST.ZEN?',
    items: [
      { title: 'GARANSI 30 HARI', desc: 'Error? Ganti baru, tanpa drama.' },
      { title: 'TERENKRIPSI AES-256', desc: 'Kredensial tak pernah plain text.' },
      { title: 'SUPPORT 24 JAM', desc: 'WhatsApp dijawab manusia.' },
    ],
  },
  testimonials: {
    title: 'APA KATA MEREKA',
    items: [
      { quote: 'Bayar QRIS, 2 menit akun masuk.', name: 'Yoga P.', product: 'CapCut Pro' },
      { quote: 'Garansinya beneran, ganti tanpa drama.', name: 'Putri H.', product: 'Viu Premium' },
      { quote: 'Langganan 3x, belum pernah kecewa.', name: 'Nadia L.', product: 'Disney+ Hotstar' },
      { quote: 'Akun error, langsung diganti baru.', name: 'Sinta W.', product: 'Canva Pro' },
      { quote: 'Harga termurah yang saya temuin.', name: 'Bagas R.', product: 'YouTube Premium' },
    ],
  },
  footer: { rights: 'Hak cipta dilindungi', howToOrder: 'Cara Pesan', paymentMethods: 'Metode Pembayaran', faq: 'FAQ', myOrders: 'Pesanan Saya', terms: 'Syarat & Ketentuan', privacy: 'Kebijakan Privasi', refunds: 'Pengembalian Dana' },
  filter: { all: 'Semua' },
  dashboard: { title: 'PEMBELIAN AKTIF', subtitle: 'Lihat dan kelola pesanan kredensialmu', tabs: ['Semua', 'Menunggu', 'Dibayar', 'Dikirim', 'Ditolak', 'Refund'], noOrders: 'Belum ada pesanan', selectOrder: 'Pilih pesanan yang sudah dikirim untuk melihat kredensial', payNow: 'BAYAR', contactWa: 'HUBUNGI WA', cancelOrder: 'BATAL', viewCredentials: 'KREDENSIAL', receipt: 'STRUK', reportIssue: 'LAPOR', cancelConfirm: 'Batalkan order ini? Order PENDING yang belum dibayar akan dihapus.', paymentVerified: 'Pembayaran terverifikasi', accountDelivered: 'Akun terkirim, cek kredensial', paymentFailed: 'Pembayaran gagal', orderCancelled: 'Order dibatalkan', loadMore: 'MUAT LEBIH BANYAK' },
  payment: { waiting: 'Menunggu Pembayaran', paid: 'Pembayaran Berhasil', failed: 'Pembayaran Gagal', cancelled: 'Pembayaran Dibatalkan', waitingHint: 'Selesaikan QRIS di tab pembayaran, status terupdate otomatis…', paidHint: 'Lunas, akun sedang disiapkan, cek dashboard.', deliveredHint: 'Akun sudah terkirim, cek kredensial di dashboard.', failedHint: 'Order masih PENDING, ulangi pembayaran dari dashboard.', toDashboard: 'Ke Dashboard' },
  common: { noProducts: 'Belum ada produk tersedia', copiedToClipboard: 'Disalin ke clipboard!' },
  pagination: { showing: 'Menampilkan', of: 'dari' },
  notFound: { title: 'HALAMAN TIDAK DITEMUKAN', subtitle: 'Alamat yang kamu tuju tidak ada di toko ini.', home: 'KEMBALI KE TOKO', login: 'MASUK' },
  profile: { title: 'AKUN', guest: 'Belum masuk', guestHint: 'Masuk untuk lacak pesanan dan lihat kredensial', language: 'BAHASA', quickLinks: 'PINTASAN', signOutTitle: 'KELUAR DARI AKUN?', signOutDesc: 'Kamu harus masuk lagi untuk lacak pesanan dan lihat kredensial.', cancel: 'BATAL', confirmSignOut: 'YA, KELUAR' },
  info: {
    howToOrder: {
      title: 'CARA PESAN',
      desc: 'Beli akun digital premium dalam 4 langkah mudah.',
      steps: [
        { num: '1', title: 'PILIH PRODUK', desc: 'Browse katalog, pilih akun yang kamu inginkan. Lihat detail harga dan stok.' },
        { num: '2', title: 'CHECKOUT', desc: 'Klik Belanja pada produk, masuk ke halaman detail. Klik GET ACCESS untuk melanjutkan.' },
        { num: '3', title: 'BAYAR', desc: 'Transfer ke rekening SeaBank atau scan QRIS. Pembayaran diverifikasi otomatis.' },
        { num: '4', title: 'TERIMA AKUN', desc: 'Kredensial dikirim instan ke dashboard kamu. Bisa langsung dipakai.' },
      ],
    },
    paymentMethods: {
      title: 'METODE PEMBAYARAN',
      desc: 'Kami menerima berbagai metode pembayaran untuk kemudahanmu.',
      methods: [
        { name: 'SeaBank', detail: 'Transfer langsung ke rekening SeaBank. Proses cepat, bebas admin.', badge: 'INSTAN' },
        { name: 'QRIS', detail: 'Scan kode QRIS. Support semua e-wallet dan mobile banking.', badge: 'UNIVERSAL' },
        { name: 'Manual Transfer', detail: 'Transfer ke bank mana saja. Konfirmasi manual via WhatsApp.', badge: 'SEMUA BANK' },
      ],
    },
    faq: {
      title: 'PERTANYAAN UMUM',
      desc: 'Jawaban atas pertanyaan yang sering ditanyakan.',
      items: [
        { q: 'Berapa lama proses pengiriman?', a: 'Instan. Setelah pembayaran dikonfirmasi, kredensial langsung dikirim ke dashboard kamu. Tanpa tunggu.' },
        { q: 'Metode pembayaran apa yang diterima?', a: 'SeaBank (transfer langsung), QRIS (semua e-wallet), dan manual transfer ke bank apa saja.' },
        { q: 'Bagaimana jika akun tidak work?', a: 'Hubungi support via WhatsApp. Kami akan ganti atau refund dalam 24 jam.' },
        { q: 'Apakah ada garansi?', a: 'Ya, garansi 30 hari. Jika akun bermasalah dalam 30 hari, kami ganti gratis.' },
        { q: 'Bagaimana cara menghubungi support?', a: 'WhatsApp: 0882-0034-57148. Telegram: @stzen_bot. Email: akieera.store@gmail.com.' },
        { q: 'Apakah data saya aman?', a: 'Semua kredensial terenkripsi AES-256. Data kamu tidak pernah disimpan dalam bentuk plain text.' },
        { q: 'Bisa beli untuk orang lain?', a: 'Bisa. Setelah checkout, kredensial bisa kamu bagikan ke orang lain. Tapi akun tetap atas nama kamu.' },
        { q: 'Bagaimana cara cek status pesanan?', a: 'Login ke Dashboard, lihat tab Pesanan Saya. Status update secara real-time.' },
      ],
    },
  },
  legal: {
    terms: {
      title: 'SYARAT & KETENTUAN',
      desc: 'Aturan main belanja di stzen. Dengan menyelesaikan checkout, kamu dianggap membaca dan menyetujui seluruh isi halaman ini.',
      updated: 'Diperbarui: September 2026',
      sections: [
        { h: '1. Penyelenggara', p: ['stzen (stzen.web.id) adalah toko akun digital premium. Kontak dukungan: WhatsApp 0882-0034-57148, Telegram @stzen_bot, email akieera.store@gmail.com.'] },
        { h: '2. Bentuk Produk', p: ['Yang kamu beli adalah hak akses ke akun digital selama masa berlaku paket, bukan kepemilikan akun. Kredensial tetap milik penyedia layanan aslinya dan tunduk pada aturan mereka (misalnya batas perangkat).', 'Detail tiap produk (durasi, jumlah profil, aturan pakai) tertera di halaman produk dan mengikat seperti bagian dari dokumen ini.'] },
        { h: '3. Harga', p: ['Harga tertera dalam Rupiah dan bersifat final sebelum biaya layanan. Pembayaran QRIS otomatis dikenai biaya layanan yang ditanggung pembeli dan ditampilkan sebelum kamu membayar.', 'Harga dapat berubah sewaktu-waktu; harga yang berlaku adalah harga saat kamu checkout.'] },
        { h: '4. Pembayaran', p: ['QRIS otomatis diverifikasi oleh gerbang pembayaran. Transfer manual wajib dikonfirmasi via WhatsApp beserta ID pesanan.', 'Pesanan PENDING yang belum dibayar dapat dibatalkan kapan saja oleh kamu dari dashboard.'] },
        { h: '5. Pengiriman', p: ['Kredensial dikirim instan ke dashboard kamu setelah pembayaran terkonfirmasi. Buka Pesanan Saya, pilih pesanan berstatus Dikirim, lalu tekan Kredensial.', 'Pastikan kamu bisa login ke akun stzen sebelum membayar. Kami tidak bertanggung jawab atas keterlambatan akibat email yang salah ketik atau akun yang tidak bisa diakses.'] },
        { h: '6. Kewajiban Pembeli', p: ['Dilarang mengubah email, password, atau PIN profil tanpa izin tertulis dari kami.', 'Dilarang menjual kembali, menyewakan, atau membagikan kredensial di luar ketentuan paket yang kamu beli.', 'Pelanggaran dapat berujung pada pencabutan akses tanpa pengembalian dana, setelah peringatan satu kali via kontak pesanan.'] },
        { h: '7. Kendala & Garansi', p: ['Kredensial tidak berfungsi saat diterima? Laporkan maksimal 1x24 jam via WhatsApp dengan menyertakan ID pesanan. Kami mengganti kredensial terlebih dahulu; refund diberikan bila stok pengganti habis atau pengganti ikut bermasalah.', 'Garansi penggantian 30 hari sejak pengiriman untuk kendala yang bukan akibat pelanggaran pasal 6.'] },
        { h: '8. Batasan Tanggung Jawab', p: ['Tanggung jawab kami maksimal sebesar nilai pesanan yang bersangkutan.', 'Kami tidak bertanggung jawab atas perubahan sepihak dari penyedia layanan asli (reset password massal, pemblokiran wilayah, penutupan layanan) di luar kendali kami. Dalam kasus tersebut kami bantu semaksimal mungkin, termasuk penggantian selama stok tersedia.'] },
        { h: '9. Perubahan & Hukum', p: ['Dokumen ini dapat diperbarui sewaktu-waktu; tanggal pembaruan selalu tertera di atas dan versi terbaru yang berlaku.', 'Tunduk pada hukum Republik Indonesia. Sengketa diselesaikan musyawarah dulu; bila buntu, melalui jalur hukum yang berlaku.'] },
      ],
    },
    privacy: {
      title: 'KEBIJAKAN PRIVASI',
      desc: 'Penjelasan UU PDP No. 27 Tahun 2022: data apa yang kami kumpulkan, untuk apa, dan hak-hak kamu atas datamu. Ditulis dalam Bahasa Indonesia dengan bahasa sederhana.',
      updated: 'Diperbarui: September 2026',
      sections: [
        { h: '1. Pengelola Data', p: ['Pengelola data pribadi (data controller) adalah stzen, stzen.web.id. Kontak pengelola: WhatsApp 0882-0034-57148, email akieera.store@gmail.com.'] },
        { h: '2. Data yang Dikumpulkan', p: ['Email akun, nomor WhatsApp yang kamu isi saat checkout, ID dan referensi pembayaran, serta riwayat pesananmu.', 'Kredensial produk (username/password akun digital) adalah barang dagangan, bukan data pribadimu. Kredensial disimpan terenkripsi AES-256 dan tidak pernah dalam bentuk teks polos.'] },
        { h: '3. Tujuan & Dasar Pemrosesan', p: ['Memenuhi pesananmu (dasar: pelaksanaan kontrak), layanan pelanggan dan garansi (kontrak), serta keamanan dan pencegahan penipuan (kepentingan sah).', 'Kami tidak memakai datamu untuk iklan pihak ketiga dan tidak menjual datamu ke siapa pun.'] },
        { h: '4. Pihak yang Menerima Data', p: ['Penyedia infrastruktur: Supabase (basis data, Singapura), Cloudflare (hosting dan keamanan), Sumopod (gerbang pembayaran QRIS).', 'Masing-masing hanya menerima data yang mereka butuhkan untuk fungsinya, terikat kontrak pemrosesan data.'] },
        { h: '5. Penyimpanan & Penghapusan', p: ['Data pesanan disimpan selama akunmu aktif, ditambah arsip transaksi sesuai kewajiban perpajakan dan pembukuan.', 'Kamu bisa meminta penghapusan data kapan saja via kontak di pasal 1; data yang wajib diarsip menurut hukum dikecualikan sampai masa arsipnya habis.'] },
        { h: '6. Hak-Hak Kamu', p: ['Akses, koreksi, penghapusan, dan penarikan persetujuan atas datamu. Ajukan via WhatsApp atau email dengan menyebut email akunmu.', 'Kami merespons maksimal 3x24 jam. Bila tidak puas, kamu berhak mengadu ke Kementerian Komunikasi dan Digital (Komdigi).'] },
        { h: '7. Transfer Lintas Negara', p: ['Server dan layanan kami berada di Singapura dan Amerika Serikat. Dengan memakai layanan ini, kamu memahami datamu diproses di luar Indonesia dengan perlindungan setara melalui kontrak dan enkripsi.'] },
        { h: '8. Keamanan & Insiden', p: ['Enkripsi AES-256 untuk kredensial, koneksi HTTPS menyeluruh, akses admin berlapis peran.', 'Bila terjadi insiden kebocoran data pribadimu, kami memberitahumu dan melapor ke otoritas maksimal 3x24 jam sejak kami mengetahuinya.'] },
        { h: '9. Anak di Bawah Umur', p: ['Layanan ini untuk pengguna yang cakap hukum. Pengguna di bawah umur wajib memakai layanan dengan persetujuan orang tua atau wali.'] },
        { h: '10. Perubahan', p: ['Kebijakan ini dapat diperbarui mengikuti perubahan layanan atau peraturan. Perubahan material diumumkan lewat pengumuman toko sebelum berlaku.'] },
      ],
    },
    refunds: {
      title: 'KEBIJAKAN PENGEMBALIAN DANA',
      desc: 'Prinsip kami: pesanan yang terkirim dan berfungsi bersifat final. Pesanan yang cacat kami ganti dulu; refund bila penggantian gagal.',
      updated: 'Diperbarui: September 2026',
      sections: [
        { h: '1. Prinsip', p: ['Akses digital tidak bisa dikembalikan seperti barang fisik. Karena itu pesanan yang sudah terkirim dan berfungsi tidak dapat di-refund.', 'Pengecualian satu-satunya: pesanan yang cacat (pasal 2). Untuk itu berlaku ganti-dulu-baru-refund.'] },
        { h: '2. Yang Berhak Diganti atau Di-refund', p: ['Kredensial mati atau tidak bisa login saat pertama diterima, dilaporkan maksimal 1x24 jam.', 'Pembayaran ganda (double charge) untuk pesanan yang sama.', 'Pembayaran terkonfirmasi tetapi kredensial tidak kunjung terkirim.'] },
        { h: '3. Yang Tidak Berhak', p: ['Kredensial sudah berfungsi normal.', 'Berubah pikiran setelah kredensial terkirim.', 'Akun diblokir akibat pelanggaran Syarat & Ketentuan pasal 6.', 'Laporan melewati batas waktu 1x24 jam tanpa alasan yang dapat diverifikasi.'] },
        { h: '4. Cara Mengajukan', p: ['Hubungi WhatsApp 0882-0034-57148 atau email akieera.store@gmail.com dengan ID pesanan, deskripsi kendala, dan tangkapan layar bila ada.', 'Kami merespons maksimal 1x24 jam. Simpan ID pesananmu; tanpa ID, verifikasi bisa tertunda.'] },
        { h: '5. Metode & Waktu Refund', p: ['Refund dikembalikan ke kanal pembayaran asal; untuk transfer manual via transfer bank ke rekening yang kamu tunjuk.', 'Diproses maksimal 7 hari kerja setelah disetujui. Waktu sampai ke rekeningmu mengikuti bank masing-masing.'] },
        { h: '6. Bukti Pengiriman', p: ['Setiap pengiriman kredensial tercatat (waktu, status). Log ini menjadi dasar verifikasi sengketa: klaim tidak terkirim gugur bila log menunjukkan pengiriman berhasil dan kredensial berfungsi.'] },
      ],
      matrix: {
        title: 'TABEL PERHITUNGAN REFUND',
        formula: 'Refund = Harga × Sisa Durasi ÷ Total Durasi × Fee',
        note: '1 bulan dihitung 30 hari. Hasil dibulatkan ke bawah ke rupiah penuh.',
        head: ['Lama Pakai', 'Klaim Garansi', 'Fee'],
        rows: [
          ['< 7 hari', 'Berapa pun', '× 0.8'],
          ['≥ 7 hari', '0', '× 0.7'],
          ['≥ 7 hari', '1–2', '× 0.6'],
          ['≥ 7 hari', '3', '× 0.5'],
          ['≥ 7 hari', '> 3', '× 0.4'],
        ],
      },
    },
  },
  admin: {
    sidebar: { overview: 'Ringkasan', products: 'Produk', orders: 'Pesanan' },
    overview: { title: 'RINGKASAN', totalProducts: 'Total Produk', totalStock: 'Total Stok', pendingOrders: 'Pesanan Pending', revenue: 'Pendapatan', recentOrders: 'Pesanan Terbaru', lowStock: 'Stok Menipis', noData: 'Belum ada data' },
    products: { title: 'PRODUK', searchPlaceholder: 'Cari produk...', categoryAll: 'Semua Kategori', addProduct: 'TAMBAH PRODUK', editProduct: 'EDIT PRODUK', createProduct: 'BUAT PRODUK', updateProduct: 'PERBARUI', deleteConfirm: 'Hapus produk ini? Kredensial juga akan terhapus.', name: 'Nama', category: 'Kategori', price: 'Harga', badge: 'Badge', description: 'Deskripsi', instructions: 'Instruksi', status: 'Status', stock: 'Stok', actions: 'Aksi', edit: 'EDIT', delete: 'HAPUS', active: 'AKTIF', inactive: 'NONAKTIF', stockImport: 'Impor Stok', targetProduct: 'PRODUK TARGET', selectProduct: 'Pilih produk', rawDataLabel: 'DATA KREDENSIAL [FORMAT: USER:PASS]', rawDataPlaceholder: 'user@email.com:password123', importButton: 'IMPOR KE VAULT', cancel: 'BATAL' },
    orders: { title: 'PESANAN', searchPlaceholder: 'Cari produk / pelanggan...', statusAll: 'Semua Status', approve: 'SETUJUI', reject: 'TOLAK', deliver: 'KIRIM', id: 'ID', date: 'Tanggal', product: 'Produk', customer: 'Pelanggan', amount: 'Jumlah', status: 'Status', actions: 'Aksi', noOrders: 'Belum ada pesanan' },
  },
}

const en: Copy = {
  nav: { home: 'Home', shop: 'Shop', myOrders: 'My Orders', admin: 'Admin', profile: 'Account' },
  auth: { signIn: 'Sign In', signOut: 'Sign Out', signInWithGoogle: 'Sign in with Google', email: 'EMAIL', password: 'PASSWORD', or: 'OR', backToStore: 'Back to store', signUp: 'Sign Up', signUpTitle: 'CREATE ACCOUNT', signUpSubtitle: 'Sign up to start shopping', confirmPassword: 'CONFIRM PASSWORD', noAccount: "Don't have an account?", hasAccount: 'Already have an account?', forgotPassword: 'Forgot Password', forgotPasswordTitle: 'RESET PASSWORD', forgotPasswordSubtitle: 'Enter your email to receive a reset link', backToLogin: 'Back to login', updatePassword: 'Update Password', updatePasswordTitle: 'NEW PASSWORD', updatePasswordSubtitle: 'Enter your new password', newPassword: 'NEW PASSWORD', confirmNewPassword: 'CONFIRM NEW PASSWORD', verifyEmail: 'Verify Email', verifyEmailTitle: 'CHECK YOUR INBOX', verifyEmailSubtitle: 'We sent you a verification link', resendEmail: 'Resend email', emailSent: 'Email sent', checkInbox: 'Check your inbox', spamHint: "Don't forget to check spam if you can't find it", successRedirect: 'Verification successful, redirecting...' },
  hero: {
    title1: 'INSTANT ACCESS',
    title2: 'PREMIUM DIGITAL ACCOUNTS',
    tagline: 'Instant Access to Premium Digital Accounts',
    cta: 'SHOP NOW',
    cardTitle1: 'PICK. PAY.',
    cardTitle2: 'GOT IT.',
    cardTagline: 'Auto-delivered. 30-day warranty.',
    statusPill: '1,420+ ACCOUNTS AUTO-DELIVERED TODAY',
    searchPlaceholder: 'SEARCH PRODUCTS...',
    searchHint: 'Ctrl+K',
  },
  marquee: [
    'INSTANT DELIVERY',
    'SAFE & ENCRYPTED',
    'LIGHTNING FAST',
    '24/7 SUPPORT',
  ],
  products: {
    title: 'ALL PRODUCTS',
    buy: 'Buy',
    buyNow: 'BUY NOW',
    soldOut: 'Sold Out',
    inStock: 'In Stock',
    onlyXLeft: 'Only',
    outOfStock: 'Out of Stock',
    sortNewest: 'Newest',
    sortPrice: 'Lowest Price',
    sortStock: 'In Stock Only',
    sortOutOfStock: 'Out of Stock',
    viewGrid: 'Grid',
    viewList: 'List',
    verifiedBuyer: 'VERIFIED BUYER',
    loginForMore: 'Log in to see all products',
    confirmTitle: 'CONFIRM ORDER',
    confirmNote: 'No cart, the order is created immediately and continues to payment. Make sure the product and price are correct.',
    confirmCancel: 'CANCEL',
    confirmGo: 'CONTINUE TO PAY',
    confirmPlace: 'PLACE ORDER',
    processing: 'Processing...',
    methodTitle: 'PAYMENT METHOD',
    methodAutoMin: 'Automatic QRIS is available for prices Rp{min} and up. Below that, manual orders only.',
    methodManualHours: 'Admin is active 08:00-20:00 WIB. Orders outside these hours are still recorded and processed next active hours.',
    methodAuto: 'Automatic QRIS',
    methodAutoDesc: 'Pay now via QRIS, account processed instantly.',
    methodManual: 'Manual Order',
    methodManualDesc: 'Place the order, confirm via WhatsApp to admin.',
    accountLabel: 'TARGET ACCOUNT',
    accountPlaceholder: 'Email / username for activation',
    waLabel: 'WHATSAPP NUMBER',
    waPlaceholder: '08xxxxxxxxxx',
    errAccount: 'Target account is required (3-120 characters).',
    errWa: 'Invalid WA number (08.. format).',
    termsAgree: 'I agree to the Terms & Conditions above.',
    termsShow: 'View Terms & Conditions',
    errTerms: 'Please accept the Terms & Conditions first.',
    manualPlaced: 'ORDER RECEIVED',
    manualPlacedNote: 'Manual order recorded. Confirm to admin via WhatsApp to get it processed.',
    waConfirm: 'CONFIRM VIA WA',
    waConfirmText: 'Hello, confirming manual order {id} ({product}).',
    feeLabel: 'SERVICE FEE',
    viewCategory: 'Browse {category} products',
    viewBadge: 'Browse products tagged {badge}',
    askAdmin: 'Ask Admin!',
    askAdminText: 'Hi admin, I want to ask about {product}.',
  },
  howItWorks: {
    title: 'HOW IT WORKS',
    steps: [
      { num: '1', title: 'Browse', desc: 'Pick an account, check stock' },
      { num: '2', title: 'Order & Pay', desc: 'QRIS or bank transfer' },
      { num: '3', title: 'Verify', desc: 'Automatic, in seconds' },
      { num: '4', title: 'Get Access', desc: 'In your dashboard, ready to use' },
    ],
  },
  whyUs: {
    title: 'WHY ST.ZEN?',
    items: [
      { title: '30-DAY WARRANTY', desc: 'Broken? Replaced, no drama.' },
      { title: 'AES-256 ENCRYPTED', desc: 'Credentials never stored plain.' },
      { title: '24/7 SUPPORT', desc: 'WhatsApp answered by humans.' },
    ],
  },
  testimonials: {
    title: 'WHAT OUR CUSTOMERS SAY',
    items: [
      { quote: 'Paid with QRIS, account arrived in 2 minutes.', name: 'Yoga P.', product: 'CapCut Pro' },
      { quote: 'Warranty is real, replaced without drama.', name: 'Putri H.', product: 'Viu Premium' },
      { quote: 'Subscribed 3 times, never disappointed.', name: 'Nadia L.', product: 'Disney+ Hotstar' },
      { quote: 'Broken account, replaced with a new one fast.', name: 'Sinta W.', product: 'Canva Pro' },
      { quote: 'Cheapest price I could find.', name: 'Bagas R.', product: 'YouTube Premium' },
    ],
  },
  footer: { rights: 'All rights reserved', howToOrder: 'How to Order', paymentMethods: 'Payment Methods', faq: 'FAQ', myOrders: 'My Orders', terms: 'Terms & Conditions', privacy: 'Privacy Policy', refunds: 'Refund Policy' },
  filter: { all: 'All' },
  profile: { title: 'ACCOUNT', guest: 'Not signed in', guestHint: 'Sign in to track orders and view credentials', language: 'LANGUAGE', quickLinks: 'SHORTCUTS', signOutTitle: 'SIGN OUT?', signOutDesc: 'You need to sign in again to track orders and view credentials.', cancel: 'CANCEL', confirmSignOut: 'YES, SIGN OUT' },
  dashboard: { title: 'MY ACTIVE PURCHASES', subtitle: 'View and manage your credential orders', tabs: ['All', 'Pending', 'Paid', 'Delivered', 'Rejected', 'Refunded'], noOrders: 'No orders found', selectOrder: 'Select a delivered order to view credentials', payNow: 'PAY', contactWa: 'CONTACT WA', cancelOrder: 'CANCEL', viewCredentials: 'CREDENTIALS', receipt: 'RECEIPT', reportIssue: 'REPORT', cancelConfirm: 'Cancel this order? Unpaid PENDING orders will be deleted.', paymentVerified: 'Payment verified', accountDelivered: 'Account delivered, check credentials', paymentFailed: 'Payment failed', orderCancelled: 'Order cancelled', loadMore: 'LOAD MORE' },
  payment: { waiting: 'Waiting for Payment', paid: 'Payment Successful', failed: 'Payment Failed', cancelled: 'Payment Cancelled', waitingHint: 'Finish the QRIS in the payment tab, status updates automatically…', paidHint: 'Paid, account is being prepared, check dashboard.', deliveredHint: 'Account delivered, check credentials in dashboard.', failedHint: 'Order still PENDING, retry payment from dashboard.', toDashboard: 'To Dashboard' },
  common: { noProducts: 'No products available', copiedToClipboard: 'Copied to clipboard!' },
  pagination: { showing: 'Showing', of: 'of' },
  notFound: { title: 'PAGE NOT FOUND', subtitle: 'The address you are looking for does not exist in this store.', home: 'BACK TO STORE', login: 'SIGN IN' },
  info: {
    howToOrder: {
      title: 'HOW TO ORDER',
      desc: 'Buy premium digital accounts in 4 easy steps.',
      steps: [
        { num: '1', title: 'BROWSE', desc: 'Browse the catalog, pick the account you want. Check price and stock details.' },
        { num: '2', title: 'CHECKOUT', desc: 'Click Shop on a product, go to the detail page. Click GET ACCESS to proceed.' },
        { num: '3', title: 'PAY', desc: 'Transfer to SeaBank or scan QRIS. Payment is verified automatically.' },
        { num: '4', title: 'GET ACCESS', desc: 'Credentials are delivered instantly to your dashboard. Ready to use.' },
      ],
    },
    paymentMethods: {
      title: 'PAYMENT METHODS',
      desc: 'We accept various payment methods for your convenience.',
      methods: [
        { name: 'SeaBank', detail: 'Direct transfer to SeaBank account. Fast process, zero fees.', badge: 'INSTANT' },
        { name: 'QRIS', detail: 'Scan QRIS code. Supports all e-wallets and mobile banking.', badge: 'UNIVERSAL' },
        { name: 'Manual Transfer', detail: 'Transfer to any bank. Manual confirmation via WhatsApp.', badge: 'ALL BANKS' },
      ],
    },
    faq: {
      title: 'FAQ',
      desc: 'Answers to frequently asked questions.',
      items: [
        { q: 'How long does delivery take?', a: 'Instant. Once payment is confirmed, credentials are sent to your dashboard immediately. No waiting.' },
        { q: 'What payment methods are accepted?', a: 'SeaBank (direct transfer), QRIS (all e-wallets), and manual transfer to any bank.' },
        { q: 'What if the account does not work?', a: 'Contact support via WhatsApp. We will replace or refund within 24 hours.' },
        { q: 'Is there a warranty?', a: 'Yes, 30-day warranty. If the account has issues within 30 days, we replace it for free.' },
        { q: 'How do I contact support?', a: 'WhatsApp: 0882-0034-57148. Telegram: @stzen_bot. Email: akieera.store@gmail.com.' },
        { q: 'Is my data safe?', a: 'All credentials are AES-256 encrypted. Your data is never stored in plain text.' },
        { q: 'Can I buy for someone else?', a: 'Yes. After checkout, you can share the credentials. But the account remains under your name.' },
        { q: 'How do I check my order status?', a: 'Log in to Dashboard, check the My Orders tab. Status updates in real-time.' },
      ],
    },
  },
  legal: {
    terms: {
      title: 'TERMS & CONDITIONS',
      desc: 'The ground rules for shopping at stzen. By completing checkout, you acknowledge reading and agreeing to this entire page.',
      updated: 'Updated: September 2026',
      sections: [
        { h: '1. Operator', p: ['stzen (stzen.web.id) is a premium digital-accounts store. Support: WhatsApp 0882-0034-57148, Telegram @stzen_bot, email akieera.store@gmail.com.'] },
        { h: '2. Product Form', p: ['What you buy is access rights to a digital account for the package duration, not account ownership. Credentials remain the property of the original service provider and follow their rules (e.g. device limits).', 'Each product page details (duration, profiles, usage rules) bind as part of this document.'] },
        { h: '3. Pricing', p: ['Prices are in IDR and final before service fees. Automatic QRIS payments carry a buyer-paid service fee shown before you pay.', 'Prices may change anytime; the price at checkout applies.'] },
        { h: '4. Payment', p: ['Automatic QRIS is verified by the payment gateway. Manual transfers must be confirmed via WhatsApp with your order ID.', 'Unpaid PENDING orders can be cancelled anytime from your dashboard.'] },
        { h: '5. Delivery', p: ['Credentials are delivered instantly to your dashboard once payment is confirmed. Open My Orders, pick the Delivered order, press Credentials.', 'Make sure you can log in to your stzen account before paying. We are not liable for delays caused by mistyped emails or inaccessible accounts.'] },
        { h: '6. Buyer Duties', p: ['Do not change the email, password, or profile PIN without our written permission.', 'Do not resell, rent out, or share credentials beyond your package terms.', 'Violations may lead to access revocation without refund, after one warning via the order contact.'] },
        { h: '7. Issues & Warranty', p: ['Credentials dead on arrival? Report within 24 hours via WhatsApp with your order ID. We replace first; refund follows if replacement stock runs out or the replacement fails too.', '30-day replacement warranty from delivery for issues not caused by section 6 violations.'] },
        { h: '8. Liability Cap', p: ['Our liability is capped at the value of the order in question.', 'We are not liable for unilateral changes by the original service provider (mass password resets, region blocks, shutdowns) beyond our control. We help as far as possible, including replacement while stock lasts.'] },
        { h: '9. Changes & Law', p: ['This document may be updated anytime; the update date above always applies and the newest version governs.', 'Governed by the laws of the Republic of Indonesia. Disputes are settled by deliberation first.'] },
      ],
    },
    privacy: {
      title: 'PRIVACY POLICY',
      desc: 'Our Law No. 27 of 2022 (UU PDP) notice: what we collect, why, and your rights over your data. The Indonesian version governs in case of divergence.',
      updated: 'Updated: September 2026',
      sections: [
        { h: '1. Data Controller', p: ['The personal-data controller is stzen, stzen.web.id. Contact: WhatsApp 0882-0034-57148, email akieera.store@gmail.com.'] },
        { h: '2. Data Collected', p: ['Account email, the WhatsApp number you enter at checkout, payment IDs and references, and your order history.', 'Product credentials (digital-account usernames/passwords) are merchandise, not your personal data. They are stored AES-256 encrypted, never in plain text.'] },
        { h: '3. Purposes & Basis', p: ['Fulfilling your orders (basis: contract performance), customer service and warranty (contract), security and fraud prevention (legitimate interest).', 'We never use your data for third-party ads and never sell it.'] },
        { h: '4. Recipients', p: ['Infrastructure providers: Supabase (database, Singapore), Cloudflare (hosting and security), Sumopod (QRIS payment gateway).', 'Each receives only the data its function needs, bound by data-processing contracts.'] },
        { h: '5. Retention & Deletion', p: ['Order data is kept while your account is active, plus transaction archives as tax and bookkeeping duties require.', 'You may request deletion anytime via the section 1 contacts; legally mandated archives are exempt until their retention lapses.'] },
        { h: '6. Your Rights', p: ['Access, correction, deletion, and consent withdrawal over your data. File via WhatsApp or email quoting your account email.', 'We respond within 3x24 hours. Unsatisfied? You may complain to the Ministry of Communication and Digital Affairs (Komdigi).'] },
        { h: '7. Cross-Border Transfer', p: ['Our servers and services sit in Singapore and the United States. By using this service you understand your data is processed outside Indonesia with equivalent protection via contracts and encryption.'] },
        { h: '8. Security & Incidents', p: ['AES-256 for credentials, HTTPS everywhere, role-layered admin access.', 'If your personal data is breached, we notify you and report to the authority within 3x24 hours of learning about it.'] },
        { h: '9. Minors', p: ['This service is for legally capable users. Minors must use it with parent or guardian consent.'] },
        { h: '10. Changes', p: ['This policy may be updated as the service or regulations change. Material changes are announced via store notice before taking effect.'] },
      ],
    },
    refunds: {
      title: 'REFUND POLICY',
      desc: 'Our principle: delivered-and-working orders are final. Defective orders are replaced first; refunded if replacement fails.',
      updated: 'Updated: September 2026',
      sections: [
        { h: '1. Principle', p: ['Digital access cannot be returned like physical goods. Orders delivered and working cannot be refunded.', 'The sole exception: defective orders (section 2). Replace-first-then-refund applies.'] },
        { h: '2. Eligible for Replace or Refund', p: ['Credentials dead or unloginnable on first receipt, reported within 24 hours.', 'Double charges for the same order.', 'Confirmed payment but credentials never delivered.'] },
        { h: '3. Not Eligible', p: ['Credentials already working normally.', 'Change of mind after delivery.', 'Accounts blocked for Terms section 6 violations.', 'Reports past the 24-hour window without verifiable cause.'] },
        { h: '4. How to File', p: ['WhatsApp 0882-0034-57148 or email akieera.store@gmail.com with order ID, issue description, and screenshots if any.', 'We respond within 24 hours. Keep your order ID; verification stalls without it.'] },
        { h: '5. Refund Method & Timing', p: ['Refunds return via the original payment channel; manual transfers via bank transfer to your named account.', 'Processed within 7 business days of approval. Bank arrival times vary.'] },
        { h: '6. Delivery Evidence', p: ['Every credential delivery is logged (time, status). Logs ground dispute verification: never-delivered claims fail where logs show successful, working delivery.'] },
      ],
      matrix: {
        title: 'REFUND CALCULATION TABLE',
        formula: 'Refund = Price × Remaining Duration ÷ Total Duration × Fee',
        note: '1 month counts as 30 days. Results are rounded down to the nearest rupiah.',
        head: ['Usage', 'Warranty Claims', 'Fee'],
        rows: [
          ['< 7 days', 'Any', '× 0.8'],
          ['≥ 7 days', '0', '× 0.7'],
          ['≥ 7 days', '1–2', '× 0.6'],
          ['≥ 7 days', '3', '× 0.5'],
          ['≥ 7 days', '> 3', '× 0.4'],
        ],
      },
    },
  },
  admin: {
    sidebar: { overview: 'Overview', products: 'Products', orders: 'Orders' },
    overview: { title: 'OVERVIEW', totalProducts: 'Total Products', totalStock: 'Total Stock', pendingOrders: 'Pending Orders', revenue: 'Revenue', recentOrders: 'Recent Orders', lowStock: 'Low Stock', noData: 'No data' },
    products: { title: 'PRODUCTS', searchPlaceholder: 'Search products...', categoryAll: 'All Categories', addProduct: 'ADD PRODUCT', editProduct: 'EDIT PRODUCT', createProduct: 'CREATE PRODUCT', updateProduct: 'UPDATE', deleteConfirm: 'Delete this product? Credentials will also be deleted.', name: 'Name', category: 'Category', price: 'Price', badge: 'Badge', description: 'Description', instructions: 'Instructions', status: 'Status', stock: 'Stock', actions: 'Actions', edit: 'EDIT', delete: 'DELETE', active: 'ACTIVE', inactive: 'INACTIVE', stockImport: 'Stock Import', targetProduct: 'TARGET PRODUCT', selectProduct: 'Select product', rawDataLabel: 'CREDENTIAL DATA [FORMAT: USER:PASS]', rawDataPlaceholder: 'user@email.com:password123', importButton: 'IMPORT TO VAULT', cancel: 'CANCEL' },
    orders: { title: 'ORDERS', searchPlaceholder: 'Search product / customer...', statusAll: 'All Statuses', approve: 'APPROVE', reject: 'REJECT', deliver: 'DELIVER', id: 'ID', date: 'Date', product: 'Product', customer: 'Customer', amount: 'Amount', status: 'Status', actions: 'Actions', noOrders: 'No orders' },
  },
}

export const copy: Record<'id' | 'en', Copy> = { id, en }
