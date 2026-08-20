import { TrackedWallet } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class SmartMoneyService {
  private tracked: TrackedWallet[] = [];

  trackWallet(address: string, addedBy: string, label?: string): TrackedWallet {
    const existing = this.tracked.find(w => w.address.toLowerCase() === address.toLowerCase());
    if (existing) return existing;
    const tw: TrackedWallet = {
      id: uuidv4(),
      address,
      label,
      addedBy,
      createdAt: new Date(),
    };
    this.tracked.push(tw);
    return tw;
  }

  untrackWallet(address: string): void {
    this.tracked = this.tracked.filter(w => w.address.toLowerCase() !== address.toLowerCase());
  }

  getTrackedWallets(): TrackedWallet[] {
    return this.tracked;
  }

  getWalletActivity(address: string): any {
    // Placeholder: fetch on-chain activity
    return { trades: 0, winRate: 0 };
  }

  // Called by scanner to improve smartMoneyScore
  async analyzeSmartMoney(tokenAddress: string): Promise<number> {
    // Dummy: return random score influenced by tracked wallets
    if (this.tracked.length === 0) return 50;
    const base = Math.random() * 100;
    return Math.min(100, base + this.tracked.length * 5);
  }
}
