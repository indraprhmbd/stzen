export interface BrandConfig {
  name: string
  tagline: string
  logoUrl: string
  faviconUrl: string
  defaultTheme: string
  support: {
    whatsappNumber: string
    telegramUsername: string
    email: string
  }
  payment: {
    bankName: string
    accountNumber: string
    accountName: string
    gateways: string[]
  }
  storefront: {
    heroTitle: string
    heroSubtitle: string
    currencySymbol: string
    badgeTextDefault: string
  }
  seo: {
    metaTitle: string
    metaDescription: string
  }
}

export const brandConfig: BrandConfig = {
  name: import.meta.env.VITE_BRAND_NAME || 'st.zen',
  tagline: import.meta.env.VITE_BRAND_TAGLINE || 'Standing Up for Yourself!',
  logoUrl: import.meta.env.VITE_BRAND_LOGO_URL || '/assets/logo.svg',
  faviconUrl: '/favicon.ico',
  defaultTheme: import.meta.env.VITE_BRAND_THEME || 'dark',
  support: {
    whatsappNumber: import.meta.env.VITE_WHATSAPP_NUMBER || '62882003457148',
    telegramUsername: import.meta.env.VITE_TELEGRAM_USERNAME || 'stzen_bot',
    email: 'akieera.store@gmail.com',
  },
  payment: {
    bankName: 'SeaBank',
    accountNumber: '901886539680',
    accountName: 'Yusyfi Akira Arlyn Alzena',
    gateways: ['Pakasir', 'Manual QRIS'],
  },
  storefront: {
    heroTitle: 'Instant Access to Premium Digital Accounts',
    heroSubtitle: 'Fully automated dispatch, guaranteed working accounts, instant delivery',
    currencySymbol: 'Rp',
    badgeTextDefault: 'Instant Stock',
  },
  seo: {
    metaTitle: 'st.zen | Instant Digital Credential Storefront',
    metaDescription: 'Buy premium streaming, productivity, and AI subscription accounts with instant delivery.',
  },
}
