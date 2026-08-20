// ===================== Enums =====================
export enum TokenStatus {
  BONDING_CURVE = 'bonding_curve',
  GRADUATED = 'graduated',
}
export enum OrderType {
  MARKET = 'market',
  LIMIT = 'limit',
  STOP_LOSS = 'stop_loss',
  TAKE_PROFIT = 'take_profit',
}
export enum OrderStatus {
  PENDING = 'pending',
  FILLED = 'filled',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
}
export enum TradeSide {
  BUY = 'buy',
  SELL = 'sell',
}
export enum AlertType {
  MOMENTUM = 'momentum',
  SMART_MONEY = 'smart_money',
  LIQUIDITY = 'liquidity',
  RISK = 'risk',
  OPPORTUNITY = 'opportunity',
}
export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// ===================== Core Types =====================
export interface Wallet {
  id: string;
  name?: string;
  address: string;
  privateKey: string;
  mnemonic?: string;
  createdAt: Date;
  isActive: boolean;
}

export interface Token {
  address: string;
  chainId: number;
  name?: string;
  symbol?: string;
  decimals: number;
  status: TokenStatus;
  bondingCurveAddress?: string;
  poolAddress?: string;
  price: number;
  marketCap?: number;
  liquidity?: number;
  volume24h?: number;
  momentumScore: number;
  smartMoneyScore: number;
  liquidityScore: number;
  riskScore: number;
  overallScore: number;
  lastUpdated: Date;
}

export interface Position {
  id: string;
  walletId: string;
  token: Token;
  entryPrice: number;
  currentPrice: number;
  amount: number;
  investedEth: number;
  realizedPnl?: number;
  unrealizedPnl?: number;
  pnlPercentage?: number;
  entryTimestamp: Date;
  lastUpdated: Date;
  stopLoss?: number;
  takeProfit?: number;
  trailingStop?: number;
  peakPrice?: number;
}

export interface Order {
  id: string;
  walletId: string;
  tokenAddress: string;
  type: OrderType;
  side: TradeSide;
  amount: number;
  price?: number;
  executedPrice?: number;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
  txHash?: string;
}

export interface Alert {
  id: string;
  userId: string;
  type: AlertType;
  tokenAddress?: string;
  threshold?: number;
  enabled: boolean;
  createdAt: Date;
}

export interface SniperConfig {
  enabled: boolean;
  minScore: number;
  maxRisk: number;
  minLiquidity: number;
  maxMarketCap: number;
  maxBuyAmount: number;
  slippage: number;
  maxGasPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  minMomentum?: number;
  minSmartMoney?: number;
  scannedTokens: Set<string>;
}

export interface AutopilotConfig {
  enabled: boolean;
  tradingCapital: number;
  maxTradeSize: number;
  maxPositions: number;
  minScore: number;
  maxRisk: number;
  minLiquidity: number;
  stopLoss: number;
  trailingStop: number;
  takeProfitLevels: number[];
  maxDailyLoss: number;
  cooldown: number;
  currentDayLoss: number;
  lastTradeTimestamp: Date;
  positions: string[];
}

export interface TrackedWallet {
  id: string;
  address: string;
  label?: string;
  addedBy: string;
  createdAt: Date;
  lastActivity?: Date;
  totalTrades?: number;
  winRate?: number;
}

export interface TradeExecutionResult {
  success: boolean;
  txHash?: string;
  error?: string;
  executedPrice?: number;
  gasUsed?: number;
  amountOut?: number;
}

export interface TradeSimulation {
  priceImpact: number;
  slippage: number;
  expectedOut: number;
  minOut: number;
  gasEstimate: number;
  willSucceed: boolean;
}

export interface Config {
  rpcUrl: string;
  chainId: number;
  privateKey: string;
  telegramToken: string;
  adminChatId: string;
  defaultSlippage: number;
  defaultGasLimit: number;
  maxGasPrice: number;
  bondingCurveFactory?: string;
  uniswapV4Router?: string;
}
