import { AutopilotConfig } from '../types';
import { ScannerService } from './scanner';
import { WalletService } from './wallet';
import { PositionsService } from './positions';
import { OrdersService } from './orders';
import { TradeFlow } from '../bot/tradeFlow';
import { logger } from '../utils/logger';
import cron from 'node-cron';

export class AutopilotService {
  private config: AutopilotConfig = {
    enabled: false,
    tradingCapital: 1,
    maxTradeSize: 0.2,
    maxPositions: 5,
    minScore: 75,
    maxRisk: 25,
    minLiquidity: 10,
    stopLoss: 10,
    trailingStop: 5,
    takeProfitLevels: [10, 20, 50],
    maxDailyLoss: 0.5,
    cooldown: 60,
    currentDayLoss: 0,
    lastTradeTimestamp: new Date(0),
    positions: [],
  };
  private task: cron.ScheduledTask | null = null;

  constructor(
    private scanner: ScannerService,
    private walletService: WalletService,
    private positionsService: PositionsService,
    private ordersService: OrdersService,
    private tradeFlow: TradeFlow,
    private globalConfig: any
  ) {}

  start() {
    if (this.task) return;
    this.config.enabled = true;
    // Run every 30 seconds
    this.task = cron.schedule('*/30 * * * * *', async () => {
      await this.autopilotCycle();
    });
    logger.info('Autopilot started');
  }

  stop() {
    if (this.task) {
      this.task.stop();
      this.task = null;
    }
    this.config.enabled = false;
    logger.info('Autopilot stopped');
  }

  private async autopilotCycle() {
    if (!this.config.enabled) return;
    // Check cooldown
    const now = new Date();
    const diff = (now.getTime() - this.config.lastTradeTimestamp.getTime()) / 1000;
    if (diff < this.config.cooldown) return;

    // Check daily loss limit
    // Reset daily loss if new day
    if (new Date().getDate() !== this.config.lastTradeTimestamp.getDate()) {
      this.config.currentDayLoss = 0;
    }
    if (this.config.currentDayLoss >= this.config.maxDailyLoss) {
      logger.warn('Daily loss limit reached, autopilot paused');
      return;
    }

    // Manage existing positions: check stop-loss, take-profit, trailing stops
    await this.managePositions();

    // Look for new opportunities if under max positions
    if (this.config.positions.length < this.config.maxPositions) {
      await this.lookForNewTrade();
    }
  }

  private async managePositions() {
    const wallet = this.walletService.getActiveWallet();
    if (!wallet) return;
    const positions = this.positionsService.getPositionsByWallet(wallet.id);
    for (const pos of positions) {
      const currentPrice = pos.token.price; // update price
      // Update position
      this.positionsService.updatePosition(pos.id, { currentPrice });
      // Check stop loss
      if (this.config.stopLoss && pos.pnlPercentage && pos.pnlPercentage <= -this.config.stopLoss) {
        await this.tradeFlow.executeSell('autopilot', pos.token.address, 100, true);
        this.config.positions = this.config.positions.filter(id => id !== pos.id);
        continue;
      }
      // Check take profit levels
      if (this.config.takeProfitLevels.some(level => pos.pnlPercentage && pos.pnlPercentage >= level)) {
        // Sell portion
        await this.tradeFlow.executeSell('autopilot', pos.token.address, 25, true); // partial
        // Remove from autopilot tracking? We'll keep it but maybe remove later.
      }
      // Trailing stop
      if (this.config.trailingStop && pos.peakPrice) {
        const peak = pos.peakPrice;
        const drop = (peak - currentPrice) / peak * 100;
        if (drop >= this.config.trailingStop) {
          await this.tradeFlow.executeSell('autopilot', pos.token.address, 100, true);
          this.config.positions = this.config.positions.filter(id => id !== pos.id);
        }
      }
    }
  }

  private async lookForNewTrade() {
    // Scan for new tokens (simplified)
    // In real implementation, fetch from DEX or use scanner
    // For demo, skip
    logger.debug('Autopilot looking for new trades...');
  }

  updateConfig(updates: Partial<AutopilotConfig>) {
    Object.assign(this.config, updates);
  }

  getConfig(): AutopilotConfig {
    return { ...this.config };
  }
}
