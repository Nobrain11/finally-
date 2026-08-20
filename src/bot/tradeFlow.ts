// src/bot/tradeFlow.ts

import { ethers } from 'ethers';
import { Token, TradeExecutionResult, TradeSimulation, TradeSide, OrderType, TokenStatus } from '../types';
import { WalletService } from '../services/wallet';
import { MarketService } from '../services/market';
import { RiskService } from '../services/risk';
import { PositionsService } from '../services/positions';
import { OrderService } from '../services/orders';
import { RPCService } from '../services/rpc';
import { ConfirmationService } from '../services/confirmation';

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
    // 1. Get active wallet
    const wallet = this.walletService.getActiveWallet();
    if (!wallet) throw new Error('No active wallet');

    // 2. Fetch token data
    const token = await this.marketService.getTokenInfo(tokenAddress);

    // 3. Run scanner & risk
    const passesRisk = this.riskService.passesRiskCheck(token, 50, 40); // example thresholds
    if (!passesRisk) {
      throw new Error('Token fails risk check');
    }

    // 4. Trade Guard - basic checks (balance, gas)
    const balance = await this.walletService.getBalance();
    const ethNeeded = ethers.parseEther(ethAmount.toString());
    if (balance < ethNeeded) throw new Error('Insufficient ETH balance');

    const gasPrice = await this.rpc.getGasPrice();
    const maxGas = this.rpc.config.maxGasPrice * 1e9; // convert gwei to wei
    if (gasPrice > maxGas) throw new Error('Gas price too high');

    // 5. Simulation
    const simulation = await this.simulateTrade(token, ethAmount, TradeSide.BUY, slippage || this.defaultSlippage);
    if (!simulation.willSucceed) {
      throw new Error('Trade simulation failed: ' + JSON.stringify(simulation));
    }

    // 6. Confirmation (if not auto)
    if (!skipConfirmation) {
      const confirmMsg = this.buildConfirmationMessage(token, ethAmount, simulation);
      const confirmed = await this.confirmationService.requestConfirmation(
        { from: { id: userId } } as any, // simplified
        confirmMsg
      );
      if (!confirmed) throw new Error('Trade cancelled by user');
    }

    // 7. Execution
    const result = await this.executeBuyTransaction(wallet, token, ethAmount, simulation.minOut);

    // 8. Record position & order
    if (result.success && result.txHash) {
      const executedPrice = result.executedPrice || token.price;
      const amountOut = result.amountOut || 0;
      // Create position
      this.positionsService.createPosition(
        wallet.id,
        token,
        executedPrice,
        amountOut,
        ethAmount
      );
      // Create order
      this.orderService.createOrder(
        wallet.id,
        token.address,
        OrderType.MARKET,
        TradeSide.BUY,
        ethAmount,
        executedPrice
      );
    }

    return result;
  }

  async executeSell(
    userId: string,
    tokenAddress: string,
    percentage: number, // 0-100
    skipConfirmation?: boolean
  ): Promise<TradeExecutionResult> {
    const wallet = this.walletService.getActiveWallet();
    if (!wallet) throw new Error('No active wallet');

    // Find position for this token
    const positions = this.positionsService.getPositionsByWallet(wallet.id);
    const pos = positions.find(p => p.token.address.toLowerCase() === tokenAddress.toLowerCase());
    if (!pos) throw new Error('No position for this token');

    const sellAmount = (pos.amount * percentage) / 100;
    if (sellAmount <= 0) throw new Error('Sell amount too small');

    const token = pos.token;

    // Simulation
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

    // Execute
    const result = await this.executeSellTransaction(wallet, token, sellAmount, simulation.minOut);

    if (result.success && result.txHash) {
      // Update position: reduce amount
      const remaining = pos.amount - sellAmount;
      if (remaining <= 0) {
        this.positionsService.closePosition(pos.id);
      } else {
        this.positionsService.updatePosition(pos.id, { amount: remaining });
      }
      // Record order
      this.orderService.createOrder(
        wallet.id,
        token.address,
        OrderType.MARKET,
        TradeSide.SELL,
        sellAmount,
        result.executedPrice || token.price
      );
    }

    return result;
  }

  // Simulation
  private async simulateTrade(token: Token, amount: number, side: TradeSide, slippage: number): Promise<TradeSimulation> {
    // In a real implementation, use on-chain quotes (e.g., Uniswap V4 quote)
    // For now, return a dummy simulation
    const priceImpact = 0.5; // 0.5%
    const expectedOut = side === TradeSide.BUY ? amount / token.price : amount * token.price;
    const slippageAmount = expectedOut * (slippage / 100);
    const minOut = expectedOut - slippageAmount;
    const gasEstimate = 200000;
    return {
      priceImpact,
      slippage: slippage,
      expectedOut,
      minOut,
      gasEstimate,
      willSucceed: true,
    };
  }

  private async executeBuyTransaction(wallet: any, token: Token, ethAmount: number, minOut: number): Promise<TradeExecutionResult> {
    const signer = this.walletService.getSigner(wallet);
    // Determine execution route
    if (token.status === TokenStatus.BONDING_CURVE) {
      // Call bonding curve buy function
      // Placeholder
      return { success: true, txHash: '0x...', executedPrice: token.price, amountOut: ethAmount / token.price };
    } else {
      // Uniswap V4 swap
      // Placeholder
      return { success: true, txHash: '0x...', executedPrice: token.price, amountOut: ethAmount / token.price };
    }
  }

  private async executeSellTransaction(wallet: any, token: Token, tokenAmount: number, minOut: number): Promise<TradeExecutionResult> {
    const signer = this.walletService.getSigner(wallet);
    if (token.status === TokenStatus.BONDING_CURVE) {
      // Bonding curve sell
      return { success: true, txHash: '0x...', executedPrice: token.price, amountOut: tokenAmount * token.price };
    } else {
      // Uniswap V4 swap
      return { success: true, txHash: '0x...', executedPrice: token.price, amountOut: tokenAmount * token.price };
    }
  }

  private buildConfirmationMessage(token: Token, ethAmount: number, sim: TradeSimulation): string {
    return `
🚀 Trade Confirmation
Token: ${token.symbol} (${token.address})
Amount: ${ethAmount} ETH
Price: ~${token.price} ETH
Slippage: ${sim.slippage}%
Min out: ${sim.minOut}
Gas estimate: ${sim.gasEstimate}
Risk: ${token.riskScore}/100
Score: ${token.overallScore}/100
Confirm?`;
  }
}
