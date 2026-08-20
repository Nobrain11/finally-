// src/services/risk.ts

import { Token, RiskLevel } from '../types';

export class RiskService {
  // Compute risk level based on riskScore
  getRiskLevel(riskScore: number): RiskLevel {
    if (riskScore < 20) return RiskLevel.LOW;
    if (riskScore < 40) return RiskLevel.MEDIUM;
    if (riskScore < 70) return RiskLevel.HIGH;
    return RiskLevel.CRITICAL;
  }

  // Check if token passes risk filters
  passesRiskCheck(token: Token, maxRisk: number, minScore: number): boolean {
    return token.riskScore <= maxRisk && token.overallScore >= minScore;
  }

  // Get detailed risk breakdown
  getRiskBreakdown(token: Token): any {
    return {
      overall: token.riskScore,
      level: this.getRiskLevel(token.riskScore),
      liquidity: token.liquidityScore,
      momentum: token.momentumScore,
      smartMoney: token.smartMoneyScore,
    };
  }
}
