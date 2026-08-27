import { createContext, useContext } from 'react'
import { brandConfig, type BrandConfig } from '../config/brand.config'

const BrandContext = createContext<BrandConfig>(brandConfig)

export const BrandProvider = ({ children }: { children: React.ReactNode }) => (
  <BrandContext.Provider value={brandConfig}>
    {children}
  </BrandContext.Provider>
)

export const useBrand = () => useContext(BrandContext)
