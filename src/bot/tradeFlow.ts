import { ethers } from 'ethers';
import { Token, TradeExecutionResult, TradeSimulation, TradeSide, OrderType, TokenStatus } from '../types';
import { WalletService } from '../services/wallet';
import { MarketService } from '../services/market';
import { RiskService } from '../services/risk';
import { PositionsService } from '../services/positions';
import { OrderService } from '../services/orders';
import { RPCService } from '../services/rpc';
import { ConfirmationService } from '../services/confirmation';
import { logger } from '../utils/logger';
import { formatEth } from '../utils/format';

export class TradeFlow {
  constructor(
    private walletService: WalletService,
    private marketService: MarketService,
    private riskService: RiskService,
    private positionsService: PositionsService,
    private orderService: OrderService,
    private rpc: RPCService,
    private confirmationService: ConfirmationService,
    private defaultSlippage: number = 1,
  ) {}

  async executeBuy(
    userId: string,
    tokenAddress: string,
    ethAmount: number,
    slippage?: number,
    skipConfirmation?: boolean
  ): Promise<TradeExecutionResult> {
    try {
      const wallet = this.walletService.getActiveWallet();
      if (!wallet) throw new Error('No active wallet');

      const token = await this.marketService.getTokenInfo(tokenAddress);
      const passesRisk = this.riskService.passesRiskCheck(token, 50, 40);
      if (!passesRisk) throw new Error('Token fails risk check');

      const balance = await this.walletService.getBalance();
      const ethNeeded = ethers.parseEther(ethAmount.toString());
      if (balance < ethNeeded) throw new Error('Insufficient ETH balance');

      const gasPrice = await this.rpc.getGasPrice();
      const maxGas = this.rpc.config.maxGasPrice * 1e9;
      if (gasPrice > maxGas) throw new Error('Gas price too high');

      const simulation = await this.simulateTrade(token, ethAmount, TradeSide.BUY, slippage || this.defaultSlippage);
      if (!simulation.willSucceed) throw new Error('Trade simulation failed');

      if (!skipConfirmation) {
        const confirmMsg = this.buildConfirmationMessage(token, ethAmount, simulation);
        const confirmed = await this.confirmationService.requestConfirmation(
          { from: { id: userId } } as any,
          confirmMsg
        );
        if (!confirmed) throw new Error('Trade cancelled by user');
      }

      const result = await this.executeBuyTransaction(wallet, token, ethAmount, simulation.minOut);
      if (result.success && result.txHash) {
        const executedPrice = result.executedPrice || token.price;
        const amountOut = result.amountOut || 0;
        this.positionsService.createPosition(wallet.id, token, executedPrice, amountOut, ethAmount);
        this.orderService.createOrder(wallet.id, token.address, OrderType.MARKET, TradeSide.BUY, ethAmount, executedPrice);
      }
      return result;
    } catch (e: any) {
      logger.error('Buy execution failed', e);
      return { success: false, error: e.message };
    }
  }

  async executeSell(
    userId: string,
    tokenAddress: string,
    percentage: number,
    skipConfirmation?: boolean
  ): Promise<TradeExecutionResult> {
    try {
      const wallet = this.walletService.getActiveWallet();
      if (!wallet) throw new Error('No active wallet');

      const positions = this.positionsService.getPositionsByWallet(wallet.id);
      const pos = positions.find(p => p.token.address.toLowerCase() === tokenAddress.toLowerCase());
      if (!pos) throw new Error('No position for this token');

      const sellAmount = (pos.amount * percentage) / 100;
      if (sellAmount <= 0) throw new Error('Sell amount too small');

      const token = pos.token;
      const simulation = await this.simulateTrade(token, sellAmount, TradeSide.SELL, this.defaultSlippage);
      if (!simulation.willSucceed) throw new Error('Simulation failed');

      if (!skipConfirmation) {
        const confirmMsg = `Sell ${percentage}% of ${token.symbol} (${sellAmount} tokens) at ~${token.price} ETH each. Confirm?`;
        const confirmed = await this.confirmationService.requestConfirmation(
          { from: { id: userId } } as any,
          confirmMsg
        );
        if (!confirmed) throw new Error('Cancelled');
      }

      const result = await this.executeSellTransaction(wallet, token, sellAmount, simulation.minOut);
      if (result.success && result.txHash) {
        const remaining = pos.amount - sellAmount;
        if (remaining <= 0) {
          this.positionsService.closePosition(pos.id);
        } else {
          this.positionsService.updatePosition(pos.id, { amount: remaining });
        }
        this.orderService.createOrder(wallet.id, token.address, OrderType.MARKET, TradeSide.SELL, sellAmount, result.executedPrice || token.price);
      }
      return result;
    } catch (e: any) {
      logger.error('Sell execution failed', e);
      return { success: false, error: e.message };
    }
  }

  private async simulateTrade(token: Token, amount: number, side: TradeSide, slippage: number): Promise<TradeSimulation> {
    const priceImpact = 0.5;
    const expectedOut = side === TradeSide.BUY ? amount / token.price : amount * token.price;
    const slippageAmount = expectedOut * (slippage / 100);
    const minOut = expectedOut - slippageAmount;
    const gasEstimate = 200000;
    return {
      priceImpact,
      slippage,
      expectedOut,
      minOut,
      gasEstimate,
      willSucceed: true,
    };
  }

  private async executeBuyTransaction(wallet: any, token: Token, ethAmount: number, minOut: number): Promise<TradeExecutionResult> {
    const signer = this.walletService.getSigner(wallet);
    if (token.status === TokenStatus.BONDING_CURVE) {
      // Placeholder
      return { success: true, txHash: '0x...', executedPrice: token.price, amountOut: ethAmount / token.price };
    } else {
      return { success: true, txHash: '0x...', executedPrice: token.price, amountOut: ethAmount / token.price };
    }
  }

  private async executeSellTransaction(wallet: any, token: Token, tokenAmount: number, minOut: number): Promise<TradeExecutionResult> {
    if (token.status === TokenStatus.BONDING_CURVE) {
      return { success: true, txHash: '0x...', executedPrice: token.price, amountOut: tokenAmount * token.price };
    } else {
      return { success: true, txHash: '0x...', executedPrice: token.price, amountOut: tokenAmount * token.price };
    }
  }

  private buildConfirmationMessage(token: Token, ethAmount: number, sim: TradeSimulation): string {
    return `
🚀 Trade Confirmation
Token: ${token.symbol} (${token.address})
Amount: ${formatEth(ethAmount)} ETH
Price: ~${formatEth(token.price)} ETH
Slippage: ${sim.slippage}%
Min out: ${formatEth(sim.minOut)}
Gas estimate: ${sim.gasEstimate}
Risk: ${token.riskScore}/100
Score: ${token.overallScore}/100
Confirm?
`;
  }
}
