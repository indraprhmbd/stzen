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
  hero: { title1: string; title2: string; tagline: string; cta: string; statusPill: string; searchPlaceholder: string; searchHint: string }
  marquee: string[]
  products: { title: string; buy: string; buyNow: string; soldOut: string; inStock: string; onlyXLeft: string; outOfStock: string; sortNewest: string; sortPrice: string; sortStock: string; sortOutOfStock: string; viewGrid: string; viewList: string; verifiedBuyer: string; loginForMore: string; confirmTitle: string; confirmNote: string; confirmCancel: string; confirmGo: string; processing: string }
  howItWorks: { title: string; steps: { num: string; title: string; desc: string }[] }
  whyUs: { title: string; items: { title: string; desc: string }[] }
  testimonials: { title: string; items: { quote: string; name: string; product: string }[] }
  footer: { rights: string; howToOrder: string; paymentMethods: string; faq: string; myOrders: string }
  filter: { all: string }
  dashboard: { title: string; subtitle: string; tabs: string[]; noOrders: string; selectOrder: string; payNow: string; cancelOrder: string; viewCredentials: string; receipt: string; reportIssue: string; cancelConfirm: string; paymentVerified: string; accountDelivered: string; paymentFailed: string; orderCancelled: string; loadMore: string }
  profile: { title: string; guest: string; guestHint: string; language: string; quickLinks: string }
  payment: { waiting: string; paid: string; failed: string; cancelled: string; waitingHint: string; paidHint: string; deliveredHint: string; failedHint: string; toDashboard: string }
  common: { noProducts: string; copiedToClipboard: string }
  notFound: { title: string; subtitle: string; home: string; login: string }
  info: {
    howToOrder: { title: string; desc: string; steps: { num: string; title: string; desc: string }[] }
    paymentMethods: { title: string; desc: string; methods: { name: string; detail: string; badge: string }[] }
    faq: { title: string; desc: string; items: { q: string; a: string }[] }
  }
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
    processing: 'Memproses...',
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
      { quote: 'CS fast respon, akun bermasalah langsung diganti baru.', name: 'Sinta W.', product: 'Canva Pro' },
      { quote: 'Harga paling miring dibanding tempat lain, mantap.', name: 'Bagas R.', product: 'YouTube Premium' },
      { quote: 'Sudah langganan 3x, tidak pernah kecewa.', name: 'Nadia L.', product: 'Disney+ Hotstar' },
      { quote: 'Bayar pakai QRIS, 2 menit langsung masuk akunnya.', name: 'Yoga P.', product: 'CapCut Pro' },
      { quote: 'Garansinya beneran, akun error diganti tanpa drama.', name: 'Putri H.', product: 'Viu Premium' },
    ],
  },
  footer: { rights: 'Hak cipta dilindungi', howToOrder: 'Cara Pesan', paymentMethods: 'Metode Pembayaran', faq: 'FAQ', myOrders: 'Pesanan Saya' },
  filter: { all: 'Semua' },
  dashboard: { title: 'PEMBELIAN AKTIF', subtitle: 'Lihat dan kelola pesanan kredensialmu', tabs: ['Semua', 'Menunggu', 'Dibayar', 'Dikirim', 'Ditolak', 'Refund'], noOrders: 'Belum ada pesanan', selectOrder: 'Pilih pesanan yang sudah dikirim untuk melihat kredensial', payNow: 'BAYAR', cancelOrder: 'BATAL', viewCredentials: 'KREDENSIAL', receipt: 'STRUK', reportIssue: 'LAPOR', cancelConfirm: 'Batalkan order ini? Order PENDING yang belum dibayar akan dihapus.', paymentVerified: 'Pembayaran terverifikasi', accountDelivered: 'Akun terkirim, cek kredensial', paymentFailed: 'Pembayaran gagal', orderCancelled: 'Order dibatalkan', loadMore: 'MUAT LEBIH BANYAK' },
  payment: { waiting: 'Menunggu Pembayaran', paid: 'Pembayaran Berhasil', failed: 'Pembayaran Gagal', cancelled: 'Pembayaran Dibatalkan', waitingHint: 'Selesaikan QRIS di tab pembayaran, status terupdate otomatis…', paidHint: 'Lunas, akun sedang disiapkan, cek dashboard.', deliveredHint: 'Akun sudah terkirim, cek kredensial di dashboard.', failedHint: 'Order masih PENDING, ulangi pembayaran dari dashboard.', toDashboard: 'Ke Dashboard' },
  common: { noProducts: 'Belum ada produk tersedia', copiedToClipboard: 'Disalin ke clipboard!' },
  notFound: { title: 'HALAMAN TIDAK DITEMUKAN', subtitle: 'Alamat yang kamu tuju tidak ada di toko ini.', home: 'KEMBALI KE TOKO', login: 'MASUK' },
  profile: { title: 'AKUN', guest: 'Belum masuk', guestHint: 'Masuk untuk lacak pesanan dan lihat kredensial', language: 'BAHASA', quickLinks: 'PINTASAN' },
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
        { name: 'QRIS', detail: 'Scan kode QRIS via Pakasir. Support semua e-wallet dan mobile banking.', badge: 'UNIVERSAL' },
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
    processing: 'Processing...',
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
      { quote: 'Fast support, broken account replaced immediately.', name: 'Sinta W.', product: 'Canva Pro' },
      { quote: 'Cheapest price around, awesome.', name: 'Bagas R.', product: 'YouTube Premium' },
      { quote: 'Subscribed 3 times already, never disappointed.', name: 'Nadia L.', product: 'Disney+ Hotstar' },
      { quote: 'Paid with QRIS, account arrived in 2 minutes.', name: 'Yoga P.', product: 'CapCut Pro' },
      { quote: 'Warranty is real, faulty account replaced no questions asked.', name: 'Putri H.', product: 'Viu Premium' },
    ],
  },
  footer: { rights: 'All rights reserved', howToOrder: 'How to Order', paymentMethods: 'Payment Methods', faq: 'FAQ', myOrders: 'My Orders' },
  filter: { all: 'All' },
  profile: { title: 'ACCOUNT', guest: 'Not signed in', guestHint: 'Sign in to track orders and view credentials', language: 'LANGUAGE', quickLinks: 'SHORTCUTS' },
  dashboard: { title: 'MY ACTIVE PURCHASES', subtitle: 'View and manage your credential orders', tabs: ['All', 'Pending', 'Paid', 'Delivered', 'Rejected', 'Refunded'], noOrders: 'No orders found', selectOrder: 'Select a delivered order to view credentials', payNow: 'PAY', cancelOrder: 'CANCEL', viewCredentials: 'CREDENTIALS', receipt: 'RECEIPT', reportIssue: 'REPORT', cancelConfirm: 'Cancel this order? Unpaid PENDING orders will be deleted.', paymentVerified: 'Payment verified', accountDelivered: 'Account delivered, check credentials', paymentFailed: 'Payment failed', orderCancelled: 'Order cancelled', loadMore: 'LOAD MORE' },
  payment: { waiting: 'Waiting for Payment', paid: 'Payment Successful', failed: 'Payment Failed', cancelled: 'Payment Cancelled', waitingHint: 'Finish the QRIS in the payment tab, status updates automatically…', paidHint: 'Paid, account is being prepared, check dashboard.', deliveredHint: 'Account delivered, check credentials in dashboard.', failedHint: 'Order still PENDING, retry payment from dashboard.', toDashboard: 'To Dashboard' },
  common: { noProducts: 'No products available', copiedToClipboard: 'Copied to clipboard!' },
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
        { name: 'QRIS', detail: 'Scan QRIS code via Pakasir. Supports all e-wallets and mobile banking.', badge: 'UNIVERSAL' },
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
  admin: {
    sidebar: { overview: 'Overview', products: 'Products', orders: 'Orders' },
    overview: { title: 'OVERVIEW', totalProducts: 'Total Products', totalStock: 'Total Stock', pendingOrders: 'Pending Orders', revenue: 'Revenue', recentOrders: 'Recent Orders', lowStock: 'Low Stock', noData: 'No data' },
    products: { title: 'PRODUCTS', searchPlaceholder: 'Search products...', categoryAll: 'All Categories', addProduct: 'ADD PRODUCT', editProduct: 'EDIT PRODUCT', createProduct: 'CREATE PRODUCT', updateProduct: 'UPDATE', deleteConfirm: 'Delete this product? Credentials will also be deleted.', name: 'Name', category: 'Category', price: 'Price', badge: 'Badge', description: 'Description', instructions: 'Instructions', status: 'Status', stock: 'Stock', actions: 'Actions', edit: 'EDIT', delete: 'DELETE', active: 'ACTIVE', inactive: 'INACTIVE', stockImport: 'Stock Import', targetProduct: 'TARGET PRODUCT', selectProduct: 'Select product', rawDataLabel: 'CREDENTIAL DATA [FORMAT: USER:PASS]', rawDataPlaceholder: 'user@email.com:password123', importButton: 'IMPORT TO VAULT', cancel: 'CANCEL' },
    orders: { title: 'ORDERS', searchPlaceholder: 'Search product / customer...', statusAll: 'All Statuses', approve: 'APPROVE', reject: 'REJECT', deliver: 'DELIVER', id: 'ID', date: 'Date', product: 'Product', customer: 'Customer', amount: 'Amount', status: 'Status', actions: 'Actions', noOrders: 'No orders' },
  },
}

export const copy: Record<'id' | 'en', Copy> = { id, en }
