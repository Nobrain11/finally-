// src/services/market.ts

import { ethers } from 'ethers';
import { Token, TokenStatus } from '../types';
import { RPCService } from './rpc';

// Minimal ABI for ERC20
const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
];

// Dummy bonding curve ABI (simplified)
const BONDING_CURVE_ABI = [
  'function getCurrentPrice() view returns (uint256)',
  'function getLiquidity() view returns (uint256)',
];

// Uniswap V4 pool ABI (simplified)
const POOL_ABI = [
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function liquidity() view returns (uint128)',
];

export class MarketService {
  constructor(private rpc: RPCService) {}

  async getTokenInfo(address: string): Promise<Token> {
    const contract = this.rpc.getContract(address, ERC20_ABI);
    const [name, symbol, decimals] = await Promise.all([
      contract.name().catch(() => 'Unknown'),
      contract.symbol().catch(() => 'UNKNOWN'),
      contract.decimals().catch(() => 18),
    ]);

    // Determine token status: if it's in bonding curve or migrated
    // For this demo, we check if there's a bonding curve contract (placeholder)
    // In reality, you'd have a factory or registry.
    const status = await this.detectTokenStatus(address);
    let price = 0;
    let liquidity = 0;
    let marketCap = 0;

    if (status === TokenStatus.BONDING_CURVE) {
      // Fetch from bonding curve
      const bcAddress = await this.getBondingCurveAddress(address); // placeholder
      if (bcAddress) {
        const bc = this.rpc.getContract(bcAddress, BONDING_CURVE_ABI);
        const priceBn = await bc.getCurrentPrice().catch(() => 0n);
        price = Number(ethers.formatEther(priceBn));
        const liqBn = await bc.getLiquidity().catch(() => 0n);
        liquidity = Number(ethers.formatEther(liqBn));
      }
    } else {
      // Uniswap V4 pool
      const poolAddress = await this.getUniswapPoolAddress(address); // placeholder
      if (poolAddress) {
        const pool = this.rpc.getContract(poolAddress, POOL_ABI);
        const slot0 = await pool.slot0().catch(() => null);
        if (slot0) {
          // sqrtPriceX96 to price (ETH per token) – simplified
          const sqrtPrice = slot0[0];
          // This is a placeholder conversion; actual formula depends on token decimals and pool fee
          price = Number(sqrtPrice) / 2**96; // very rough
          // Also fetch liquidity
          const liq = await pool.liquidity().catch(() => 0n);
          liquidity = Number(liq) / 1e18; // rough
        }
      }
    }

    // Estimate market cap: price * totalSupply
    const totalSupply = await contract.totalSupply().catch(() => 0n);
    marketCap = price * Number(ethers.formatUnits(totalSupply, decimals));

    // For demo, generate scores (random but within reasonable range)
    const momentumScore = Math.floor(Math.random() * 60) + 20;
    const smartMoneyScore = Math.floor(Math.random() * 60) + 20;
    const liquidityScore = Math.min(100, Math.floor((liquidity / 10) * 100));
    const riskScore = Math.floor(Math.random() * 50) + 10;
    const overallScore = (momentumScore * 0.3 + smartMoneyScore * 0.3 + liquidityScore * 0.2 + (100 - riskScore) * 0.2);

    return {
      address,
      chainId: this.rpc.config.chainId,
      name,
      symbol,
      decimals,
      status,
      price,
      marketCap,
      liquidity,
      volume24h: 0, // would need to fetch from DEX or subgraph
      momentumScore,
      smartMoneyScore,
      liquidityScore,
      riskScore,
      overallScore: Math.round(overallScore),
      lastUpdated: new Date(),
    };
  }

  private async detectTokenStatus(address: string): Promise<TokenStatus> {
    // In reality, check if token is in bonding curve factory or uniswap pool.
    // For demo, we return random.
    return Math.random() > 0.5 ? TokenStatus.BONDING_CURVE : TokenStatus.GRADUATED;
  }

  private async getBondingCurveAddress(token: string): Promise<string | null> {
    // Placeholder: maybe call factory to get bonding curve address
    return null;
  }

  private async getUniswapPoolAddress(token: string): Promise<string | null> {
    // Placeholder: compute pool address via factory
    return null;
  }

  // Additional: get price, liquidity, volume from external APIs (DexScreener, etc.)
}
