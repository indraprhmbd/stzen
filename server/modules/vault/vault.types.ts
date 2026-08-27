// ─── Vault Types ────────────────────────────────────────────────────────────

export type VaultStatus = 'AVAILABLE' | 'SOLD' | 'RESERVED'

export interface VaultItem {
  id: string
  productId: string
  credentialPayload: string
  status: VaultStatus
  createdAt: Date
  allocatedAt: Date | null
}
