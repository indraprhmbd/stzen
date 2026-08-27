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
  name: import.meta.env.VITE_BRAND_NAME || 'VaultFlex',
  tagline: import.meta.env.VITE_BRAND_TAGLINE || 'Instant Automated Digital Credentials',
  logoUrl: import.meta.env.VITE_BRAND_LOGO_URL || '/assets/logo.svg',
  faviconUrl: '/favicon.ico',
  defaultTheme: import.meta.env.VITE_BRAND_THEME || 'dark',
  support: {
    whatsappNumber: import.meta.env.VITE_WHATSAPP_NUMBER || '6281234567890',
    telegramUsername: import.meta.env.VITE_TELEGRAM_USERNAME || 'vaultflex_support',
    email: 'support@vaultflex.io',
  },
  storefront: {
    heroTitle: 'Instant Access to Premium Digital Accounts',
    heroSubtitle: 'Fully automated dispatch, guaranteed working accounts, instant delivery',
    currencySymbol: '$',
    badgeTextDefault: 'Instant Stock',
  },
  seo: {
    metaTitle: 'VaultFlex | Instant Digital Credential Storefront',
    metaDescription: 'Buy premium streaming, productivity, and AI subscription accounts with instant delivery.',
  },
}
