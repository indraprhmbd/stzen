export interface Copy {
  nav: { shop: string; myOrders: string; admin: string }
  auth: { signIn: string; signOut: string; signInWithGoogle: string; email: string; password: string; or: string; backToStore: string }
  hero: { title1: string; title2: string; tagline: string; cta: string; statusPill: string; searchPlaceholder: string; searchHint: string }
  marquee: string[]
  products: { title: string; buy: string; soldOut: string; inStock: string; onlyXLeft: string; outOfStock: string; sortNewest: string; sortPrice: string; sortStock: string; viewGrid: string; viewList: string; verifiedBuyer: string; features: string[] }
  howItWorks: { title: string; steps: { num: string; title: string; desc: string }[] }
  whyUs: { title: string; items: { title: string; desc: string }[] }
  testimonials: { title: string; items: { quote: string; name: string; product: string }[] }
  footer: { rights: string; howToOrder: string; paymentMethods: string; faq: string; myOrders: string }
  filter: { all: string }
  dashboard: { title: string; subtitle: string; tabs: string[]; noOrders: string; selectOrder: string }
  common: { noProducts: string; copiedToClipboard: string }
}

const id: Copy = {
  nav: { shop: 'Belanja', myOrders: 'Pesanan Saya', admin: 'Admin' },
  auth: { signIn: 'Masuk', signOut: 'Keluar', signInWithGoogle: 'Masuk dengan Google', email: 'EMAIL', password: 'PASSWORD', or: 'ATAU', backToStore: 'Kembali ke toko' },
  hero: {
    title1: 'AKSES INSTAN',
    title2: 'AKUN DIGITAL PREMIUM',
    tagline: 'Akses Instan Akun Digital Premium',
    cta: 'BELI SEKARANG',
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
    soldOut: 'Habis',
    inStock: 'Stok Tersedia',
    onlyXLeft: 'Sisa',
    outOfStock: 'Habis',
    sortNewest: 'Terbaru',
    sortPrice: 'Termurah',
    sortStock: 'Stok Ada',
    viewGrid: 'Grid',
    viewList: 'List',
    verifiedBuyer: 'PEMBELI TERVERIFIKASI',
    features: ['Akses Langsung', 'Garansi 30 Hari', 'PIN Pribadi', 'Support Chat'],
  },
  howItWorks: {
    title: 'CARA KERJA',
    steps: [
      { num: '1', title: 'Pilih Produk', desc: 'Pilih akun digital yang kamu butuhkan' },
      { num: '2', title: 'Pesan & Bayar', desc: 'Buat pesanan dan transfer pembayaran' },
      { num: '3', title: 'Verifikasi', desc: 'Tim kami memverifikasi pembayaranmu' },
      { num: '4', title: 'Terima Akses', desc: 'Kredensial dikirim ke dashboard kamu' },
    ],
  },
  whyUs: {
    title: 'KENAPA ST.ZEN?',
    items: [
      { title: 'Akses Instan', desc: 'Dapatkan kredensial langsung setelah pembayaran dikonfirmasi' },
      { title: 'Privasi & Aman', desc: 'Kredensialmu tetap terenkripsi dan terlindungi' },
      { title: 'Diverifikasi Orang', desc: 'Setiap pesanan dicek sebelum dikirim' },
    ],
  },
  testimonials: {
    title: 'APA KATA MEREKA',
    items: [
      { quote: 'Prosesnya cepat, langsung dapat akses setelah bayar. Recommended!', name: 'Rizky A.', product: 'Netflix Premium' },
      { quote: 'Aman dan terpercaya. Kredensialnya work semua.', name: 'Diana P.', product: 'ChatGPT Plus' },
      { quote: 'Pertama beli di sini, hasilnya memuaskan. Akan beli lagi.', name: 'Fajar M.', product: 'Spotify Family' },
    ],
  },
  footer: { rights: 'Hak cipta dilindungi', howToOrder: 'Cara Pesan', paymentMethods: 'Metode Pembayaran', faq: 'FAQ', myOrders: 'Pesanan Saya' },
  filter: { all: 'Semua' },
  dashboard: { title: 'PEMBELIAN AKTIF', subtitle: 'Lihat dan kelola pesanan kredensialmu', tabs: ['Semua', 'Menunggu', 'Dibayar', 'Dikirim', 'Ditolak'], noOrders: 'Belum ada pesanan', selectOrder: 'Pilih pesanan yang sudah dikirim untuk melihat kredensial' },
  common: { noProducts: 'Belum ada produk tersedia', copiedToClipboard: 'Disalin ke clipboard!' },
}

const en: Copy = {
  nav: { shop: 'Shop', myOrders: 'My Orders', admin: 'Admin' },
  auth: { signIn: 'Sign In', signOut: 'Sign Out', signInWithGoogle: 'Sign in with Google', email: 'EMAIL', password: 'PASSWORD', or: 'OR', backToStore: 'Back to store' },
  hero: {
    title1: 'INSTANT ACCESS',
    title2: 'PREMIUM DIGITAL ACCOUNTS',
    tagline: 'Instant Access to Premium Digital Accounts',
    cta: 'SHOP NOW',
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
    soldOut: 'Sold Out',
    inStock: 'In Stock',
    onlyXLeft: 'Only',
    outOfStock: 'Out of Stock',
    sortNewest: 'Newest',
    sortPrice: 'Lowest Price',
    sortStock: 'In Stock Only',
    viewGrid: 'Grid',
    viewList: 'List',
    verifiedBuyer: 'VERIFIED BUYER',
    features: ['Instant Access', '30-Day Warranty', 'Private PIN', 'Chat Support'],
  },
  howItWorks: {
    title: 'HOW IT WORKS',
    steps: [
      { num: '1', title: 'Browse', desc: 'Find the digital account you need' },
      { num: '2', title: 'Order & Pay', desc: 'Place your order and transfer payment' },
      { num: '3', title: 'Verify', desc: 'Our team verifies your payment' },
      { num: '4', title: 'Get Access', desc: 'Credentials delivered to your dashboard' },
    ],
  },
  whyUs: {
    title: 'WHY ST.ZEN?',
    items: [
      { title: 'Instant Access', desc: 'Get your credentials right after payment is confirmed' },
      { title: 'Private & Safe', desc: 'Your credentials stay encrypted and protected' },
      { title: 'Verified by Real People', desc: 'Every order is checked before delivery' },
    ],
  },
  testimonials: {
    title: 'WHAT OUR CUSTOMERS SAY',
    items: [
      { quote: 'Fast process, got access right after paying. Recommended!', name: 'Rizky A.', product: 'Netflix Premium' },
      { quote: 'Safe and trustworthy. All credentials work perfectly.', name: 'Diana P.', product: 'ChatGPT Plus' },
      { quote: 'First time buying here, very satisfied. Will buy again.', name: 'Fajar M.', product: 'Spotify Family' },
    ],
  },
  footer: { rights: 'All rights reserved', howToOrder: 'How to Order', paymentMethods: 'Payment Methods', faq: 'FAQ', myOrders: 'My Orders' },
  filter: { all: 'All' },
  dashboard: { title: 'MY ACTIVE PURCHASES', subtitle: 'View and manage your credential orders', tabs: ['All', 'Pending', 'Paid', 'Delivered', 'Rejected'], noOrders: 'No orders found', selectOrder: 'Select a delivered order to view credentials' },
  common: { noProducts: 'No products available', copiedToClipboard: 'Copied to clipboard!' },
}

export const copy: Record<'id' | 'en', Copy> = { id, en }
