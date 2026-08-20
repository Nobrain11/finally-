// src/services/positions.ts

import { Position, Token } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class PositionsService {
  private positions: Position[] = [];

  createPosition(
    walletId: string,
    token: Token,
    entryPrice: number,
    amount: number,
    investedEth: number
  ): Position {
    const pos: Position = {
      id: uuidv4(),
      walletId,
      token,
      entryPrice,
      currentPrice: entryPrice,
      amount,
      investedEth,
      entryTimestamp: new Date(),
      lastUpdated: new Date(),
      unrealizedPnl: 0,
      pnlPercentage: 0,
    };
    this.positions.push(pos);
    return pos;
  }

  updatePosition(id: string, updates: Partial<Position>): Position {
    const pos = this.positions.find(p => p.id === id);
    if (!pos) throw new Error('Position not found');
    Object.assign(pos, updates);
    pos.lastUpdated = new Date();
    // Recalculate PnL
    this.recalculatePnL(pos);
    return pos;
  }

  recalculatePnL(pos: Position): void {
    const currentValue = pos.currentPrice * pos.amount;
    pos.unrealizedPnl = currentValue - pos.investedEth;
    pos.pnlPercentage = (pos.unrealizedPnl / pos.investedEth) * 100;
  }

  getPosition(id: string): Position | undefined {
    return this.positions.find(p => p.id === id);
  }

  getPositionsByWallet(walletId: string): Position[] {
    return this.positions.filter(p => p.walletId === walletId);
  }

  getOpenPositions(): Position[] {
    return this.positions; // all are open; you could add status field if needed
  }

  closePosition(id: string): void {
    // Mark as closed, or remove
    this.positions = this.positions.filter(p => p.id !== id);
  }
}
