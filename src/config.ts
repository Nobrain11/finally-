import dotenv from 'dotenv';
import { Config } from './types';

dotenv.config();

export const config: Config = {
  rpcUrl: process.env.RPC_URL || 'https://rpc.robinhoodchain.com',
  chainId: parseInt(process.env.CHAIN_ID || '1'),
  privateKey: process.env.PRIVATE_KEY || '',
  telegramToken: process.env.TELEGRAM_TOKEN || '',
  adminChatId: process.env.ADMIN_CHAT_ID || '',
  defaultSlippage: parseFloat(process.env.DEFAULT_SLIPPAGE || '1'),
  defaultGasLimit: parseInt(process.env.DEFAULT_GAS_LIMIT || '300000'),
  maxGasPrice: parseFloat(process.env.MAX_GAS_PRICE || '100'),
  bondingCurveFactory: process.env.BONDING_CURVE_FACTORY,
  uniswapV4Router: process.env.UNISWAP_V4_ROUTER,
};
