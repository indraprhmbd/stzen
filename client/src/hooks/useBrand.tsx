import { createContext, useContext } from 'react'
import { brandConfig, type BrandConfig } from '../config/brand.config'

const BrandContext = createContext<BrandConfig | null>(null)

export const BrandProvider = ({ children }: { children: React.ReactNode }) => (
  <BrandContext.Provider value={brandConfig}>
    {children}
  </BrandContext.Provider>
)

export function useBrand(): BrandConfig {
  const ctx = useContext(BrandContext)
  if (!ctx) {
    // Fallback if used outside BrandProvider
    return brandConfig
  }
  return ctx
}
