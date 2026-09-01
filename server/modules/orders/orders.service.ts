import { eq, desc } from 'drizzle-orm'
import { db } from '../../shared/db'
import { orders, products } from '../../shared/db/schema'
import { NotFoundError, ConflictError } from '../../shared/errors/http'
import { generatePublicId } from '../../shared/lib/publicId'
import {
  type OrderWithProduct,
  type OrderAction,
  VALID_TRANSITIONS,
  ACTION_TO_STATUS,
} from './orders.types'

// ─── Orders Service ─────────────────────────────────────────────────────────
// Business logic for order management. Centralized state machine.

export const ordersService = {
  async listByUser(userId: string): Promise<OrderWithProduct[]> {
    return db
      .select({
        id: orders.publicId,
        userId: orders.userId,
        productId: orders.productId,
        vaultItemId: orders.vaultItemId,
        status: orders.status,
        paymentRef: orders.paymentRef,
        amount: orders.amount,
        createdAt: orders.createdAt,
        paidAt: orders.paidAt,
        productName: products.name,
        productCategory: products.category,
      })
      .from(orders)
      .innerJoin(products, eq(orders.productId, products.id))
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt))
  },

  async getById(publicId: string, userId?: string): Promise<OrderWithProduct> {
    const [order] = await db
      .select({
        id: orders.publicId,
        userId: orders.userId,
        productId: orders.productId,
        vaultItemId: orders.vaultItemId,
        status: orders.status,
        paymentRef: orders.paymentRef,
        amount: orders.amount,
        createdAt: orders.createdAt,
        paidAt: orders.paidAt,
        productName: products.name,
        productCategory: products.category,
      })
      .from(orders)
      .innerJoin(products, eq(orders.productId, products.id))
      .where(eq(orders.publicId, publicId))

    if (!order) {
      throw new NotFoundError('Order not found')
    }

    if (userId && order.userId !== userId) {
      throw new NotFoundError('Order not found')
    }

    return order
  },

  async create(data: { userId: string; productId: string; amount: string | number }) {
    const publicId = generatePublicId()
    const amountInt = typeof data.amount === 'string' ? parseInt(data.amount, 10) : data.amount
    const [order] = await db
      .insert(orders)
      .values({
        publicId,
        userId: data.userId,
        productId: data.productId,
        status: 'PENDING',
        amount: amountInt,
      })
      .returning()

    return { ...order, id: publicId }
  },

  async transitionStatus(publicId: string, action: OrderAction) {
    const order = await this.getById(publicId)
    const targetStatus = ACTION_TO_STATUS[action]

    if (!VALID_TRANSITIONS[order.status].includes(targetStatus)) {
      throw new ConflictError(
        `Cannot ${action} order in ${order.status} status`
      )
    }

    const updateData: Record<string, any> = { status: targetStatus }
    if (targetStatus === 'PAID') {
      updateData.paidAt = new Date()
    }

    const [updated] = await db
      .update(orders)
      .set(updateData)
      .where(eq(orders.publicId, publicId))
      .returning()

    return { ...updated, id: (updated as any).publicId }
  },

  async listAll(status?: string) {
    const whereClause = status ? eq(orders.status, status as any) : undefined

    return db
      .select({
        id: orders.publicId,
        userId: orders.userId,
        productId: orders.productId,
        status: orders.status,
        amount: orders.amount,
        paymentRef: orders.paymentRef,
        createdAt: orders.createdAt,
        paidAt: orders.paidAt,
        productName: products.name,
      })
      .from(orders)
      .innerJoin(products, eq(orders.productId, products.id))
      .where(whereClause)
      .orderBy(desc(orders.createdAt))
  },
}
