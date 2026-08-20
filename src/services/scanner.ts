import { Token } from '../types';
import { MarketService } from './market';
import { RiskService } from './risk';

export class ScannerService {
  constructor(
    private marketService: MarketService,
    private riskService: RiskService
  ) {}

  async scanToken(address: string): Promise<Token> {
    const token = await this.marketService.getTokenInfo(address);
    // Enhance with risk breakdown (already computed)
    return token;
  }

  // Additional scan logic: check smart money activity, etc.
  async enhancedScan(address: string): Promise<any> {
    const token = await this.scanToken(address);
    const riskLevel = this.riskService.getRiskLevel(token.riskScore);
    return {
      ...token,
      riskLevel,
      // Add more analytics: buy pressure, holder distribution etc.
    };
  }
}
