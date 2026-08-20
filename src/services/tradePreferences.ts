// src/services/tradePreferences.ts

export interface TradePreferences {
  defaultSlippage: number; // percentage
  maxGasPrice: number; // gwei
  autoConfirm: boolean; // skip confirmation
  // per-user settings
}

export class TradePreferencesService {
  private userPrefs: Map<string, TradePreferences> = new Map();

  getPreferences(userId: string): TradePreferences {
    const defaults: TradePreferences = {
      defaultSlippage: 1,
      maxGasPrice: 50,
      autoConfirm: false,
    };
    return this.userPrefs.get(userId) || defaults;
  }

  setPreferences(userId: string, prefs: Partial<TradePreferences>): TradePreferences {
    const current = this.getPreferences(userId);
    const updated = { ...current, ...prefs };
    this.userPrefs.set(userId, updated);
    return updated;
  }
}
