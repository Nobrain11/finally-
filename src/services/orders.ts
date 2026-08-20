// src/services/orders.ts

import { Order, OrderType, TradeSide, OrderStatus } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class OrderService {
  private orders: Order[] = [];

  createOrder(
    walletId: string,
    tokenAddress: string,
    type: OrderType,
    side: TradeSide,
    amount: number,
    price?: number
  ): Order {
    const order: Order = {
      id: uuidv4(),
      walletId,
      tokenAddress,
      type,
      side,
      amount,
      price,
      status: OrderStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.orders.push(order);
    return order;
  }

  updateOrder(id: string, updates: Partial<Order>): Order {
    const order = this.orders.find(o => o.id === id);
    if (!order) throw new Error('Order not found');
    Object.assign(order, updates);
    order.updatedAt = new Date();
    return order;
  }

  getOrder(id: string): Order | undefined {
    return this.orders.find(o => o.id === id);
  }

  getOrdersByWallet(walletId: string): Order[] {
    return this.orders.filter(o => o.walletId === walletId);
  }

  getPendingOrders(): Order[] {
    return this.orders.filter(o => o.status === OrderStatus.PENDING);
  }

  // For market orders, execute immediately
  async executeMarketOrder(order: Order, executedPrice: number, txHash: string): Promise<void> {
    this.updateOrder(order.id, {
      status: OrderStatus.FILLED,
      executedPrice,
      txHash,
    });
  }
}
