// src/index.ts

import { Telegraf, Context } from 'telegraf';
import { Config } from './types';
import { WalletStore } from './services/walletStore';
import { RPCService } from './services/rpc';
import { WalletService } from './services/wallet';
import { MarketService } from './services/market';
import { RiskService } from './services/risk';
import { OrdersService } from './services/orders';
import { PositionsService } from './services/positions';
import { AlertsService } from './services/alerts';
import { TradePreferencesService } from './services/tradePreferences';
import { ConfirmationService } from './services/confirmation';
import { TradeFlow } from './bot/tradeFlow';

// Load config from env or file
const config: Config = {
  rpcUrl: process.env.RPC_URL || 'https://rpc.robinhoodchain.com',
  chainId: parseInt(process.env.CHAIN_ID || '1'),
  privateKey: process.env.PRIVATE_KEY || '',
  telegramToken: process.env.TELEGRAM_TOKEN || '',
  defaultSlippage: parseFloat(process.env.DEFAULT_SLIPPAGE || '1'),
  defaultGasLimit: 300000,
  maxGasPrice: 100, // gwei
};

// Initialize services
const walletStore = new WalletStore();
const rpc = new RPCService(config);
const walletService = new WalletService(walletStore, rpc);
const marketService = new MarketService(rpc);
const riskService = new RiskService();
const ordersService = new OrdersService();
const positionsService = new PositionsService();
const alertsService = new AlertsService();
const tradePrefsService = new TradePreferencesService();
const confirmationService = new ConfirmationService();

const tradeFlow = new TradeFlow(
  walletService,
  marketService,
  riskService,
  positionsService,
  ordersService,
  rpc,
  confirmationService,
  config.defaultSlippage
);

// Telegram bot
const bot = new Telegraf(config.telegramToken);

// Middleware to handle confirmation callbacks
bot.on('callback_query', async (ctx) => {
  await ctx.answerCbQuery();
  confirmationService.handleCallback(ctx.callbackQuery);
});

// Commands

bot.start(async (ctx) => {
  await ctx.reply('🚀 ERROR404 Trading Bot\nUse /help for commands.');
});

bot.command('help', async (ctx) => {
  await ctx.reply(`
Commands:
/wallet - show active wallet
/createwallet [name] - create new wallet
/import [privateKey|mnemonic] - import wallet
/switch <walletId> - switch active wallet
/balance - check ETH balance
/scan <tokenAddress> - scan token
/buy <tokenAddress> <ethAmount> - buy token
/sell <tokenAddress> <percentage> - sell % of position
/positions - list open positions
/orders - list orders
/sniper start|stop - control sniper
/autopilot start|stop - control autopilot
/alert add|remove <type> [threshold] - manage alerts
/track <walletAddress> - track smart money
/untrack <walletAddress> - remove tracking
  `);
});

bot.command('wallet', async (ctx) => {
  const wallet = walletService.getActiveWallet();
  if (!wallet) {
    await ctx.reply('No active wallet. Create one with /createwallet');
    return;
  }
  const balance = await walletService.getEthBalanceFormatted();
  await ctx.reply(`Active Wallet:\nAddress: ${wallet.address}\nBalance: ${balance} ETH`);
});

bot.command('createwallet', async (ctx) => {
  const name = ctx.message.text.split(' ').slice(1).join(' ') || undefined;
  const wallet = await walletService.createWallet(name);
  await ctx.reply(`Wallet created:\nAddress: ${wallet.address}\nID: ${wallet.id}`);
});

bot.command('import', async (ctx) => {
  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    await ctx.reply('Usage: /import <privateKey or mnemonic>');
    return;
  }
  const input = args.slice(1).join(' ');
  try {
    let wallet;
    if (input.split(' ').length > 1) {
      wallet = await walletService.importMnemonic(input);
    } else {
      wallet = await walletService.importPrivateKey(input);
    }
    await ctx.reply(`Imported wallet: ${wallet.address}`);
  } catch (e: any) {
    await ctx.reply('Error importing: ' + e.message);
  }
});

bot.command('switch', async (ctx) => {
  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    await ctx.reply('Usage: /switch <walletId>');
    return;
  }
  try {
    const wallet = await walletService.switchWallet(args[1]);
    await ctx.reply(`Switched to wallet: ${wallet.address}`);
  } catch (e: any) {
    await ctx.reply('Error: ' + e.message);
  }
});

bot.command('balance', async (ctx) => {
  try {
    const balance = await walletService.getEthBalanceFormatted();
    await ctx.reply(`Balance: ${balance} ETH`);
  } catch (e: any) {
    await ctx.reply('Error: ' + e.message);
  }
});

bot.command('scan', async (ctx) => {
  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    await ctx.reply('Usage: /scan <tokenAddress>');
    return;
  }
  try {
    const token = await marketService.getTokenInfo(args[1]);
    const riskBreakdown = riskService.getRiskBreakdown(token);
    const msg = `
🔍 Token Scan: ${token.symbol} (${token.name})
Address: ${token.address}
Price: ${token.price} ETH
MCap: ${token.marketCap} ETH
Liquidity: ${token.liquidity} ETH
Status: ${token.status}
Scores:
  Overall: ${token.overallScore}/100
  Momentum: ${token.momentumScore}/100
  Smart Money: ${token.smartMoneyScore}/100
  Liquidity: ${token.liquidityScore}/100
  Risk: ${token.riskScore}/100 (${riskBreakdown.level})
    `;
    await ctx.reply(msg);
  } catch (e: any) {
    await ctx.reply('Scan failed: ' + e.message);
  }
});

bot.command('buy', async (ctx) => {
  const args = ctx.message.text.split(' ');
  if (args.length < 3) {
    await ctx.reply('Usage: /buy <tokenAddress> <ethAmount>');
    return;
  }
  const tokenAddr = args[1];
  const ethAmount = parseFloat(args[2]);
  if (isNaN(ethAmount) || ethAmount <= 0) {
    await ctx.reply('Invalid amount');
    return;
  }
  try {
    const result = await tradeFlow.executeBuy(ctx.from!.id.toString(), tokenAddr, ethAmount);
    if (result.success) {
      await ctx.reply(`✅ Buy successful!\nTx: ${result.txHash}\nExecuted price: ${result.executedPrice}`);
    } else {
      await ctx.reply(`❌ Buy failed: ${result.error}`);
    }
  } catch (e: any) {
    await ctx.reply('Error: ' + e.message);
  }
});

bot.command('sell', async (ctx) => {
  const args = ctx.message.text.split(' ');
  if (args.length < 3) {
    await ctx.reply('Usage: /sell <tokenAddress> <percentage> (e.g., 50 for 50%)');
    return;
  }
  const tokenAddr = args[1];
  const pct = parseFloat(args[2]);
  if (isNaN(pct) || pct <= 0 || pct > 100) {
    await ctx.reply('Percentage must be between 1 and 100');
    return;
  }
  try {
    const result = await tradeFlow.executeSell(ctx.from!.id.toString(), tokenAddr, pct);
    if (result.success) {
      await ctx.reply(`✅ Sell successful!\nTx: ${result.txHash}\nExecuted price: ${result.executedPrice}`);
    } else {
      await ctx.reply(`❌ Sell failed: ${result.error}`);
    }
  } catch (e: any) {
    await ctx.reply('Error: ' + e.message);
  }
});

bot.command('positions', async (ctx) => {
  const wallet = walletService.getActiveWallet();
  if (!wallet) {
    await ctx.reply('No active wallet');
    return;
  }
  const positions = positionsService.getPositionsByWallet(wallet.id);
  if (positions.length === 0) {
    await ctx.reply('No open positions.');
    return;
  }
  let msg = '📊 Positions:\n';
  for (const pos of positions) {
    msg += `
${pos.token.symbol}: Entry ${pos.entryPrice} ETH, Current ${pos.currentPrice} ETH
Amount: ${pos.amount}, PnL: ${pos.pnlPercentage?.toFixed(2)}%
`;
  }
  await ctx.reply(msg);
});

bot.command('orders', async (ctx) => {
  const wallet = walletService.getActiveWallet();
  if (!wallet) {
    await ctx.reply('No active wallet');
    return;
  }
  const orders = ordersService.getOrdersByWallet(wallet.id);
  if (orders.length === 0) {
    await ctx.reply('No orders.');
    return;
  }
  let msg = '📋 Orders:\n';
  for (const order of orders) {
    msg += `${order.side} ${order.type} ${order.amount} tokens, status: ${order.status}\n`;
  }
  await ctx.reply(msg);
});

// Sniper controls (simplified)
bot.command('sniper', async (ctx) => {
  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    await ctx.reply('Usage: /sniper start|stop');
    return;
  }
  const action = args[1];
  if (action === 'start') {
    // In real implementation, start background scanning
    await ctx.reply('Sniper started (placeholder)');
  } else if (action === 'stop') {
    await ctx.reply('Sniper stopped (placeholder)');
  } else {
    await ctx.reply('Invalid action');
  }
});

// Autopilot controls
bot.command('autopilot', async (ctx) => {
  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    await ctx.reply('Usage: /autopilot start|stop');
    return;
  }
  const action = args[1];
  if (action === 'start') {
    await ctx.reply('Autopilot started (placeholder)');
  } else if (action === 'stop') {
    await ctx.reply('Autopilot stopped (placeholder)');
  } else {
    await ctx.reply('Invalid action');
  }
});

// Alert commands
bot.command('alert', async (ctx) => {
  // Simplified: just list
  const alerts = alertsService.getAlertsForUser(ctx.from!.id.toString());
  if (alerts.length === 0) {
    await ctx.reply('No alerts set.');
    return;
  }
  let msg = '🔔 Your alerts:\n';
  for (const a of alerts) {
    msg += `${a.type} ${a.tokenAddress || 'any'} threshold: ${a.threshold} - ${a.enabled ? 'enabled' : 'disabled'}\n`;
  }
  await ctx.reply(msg);
});

// Smart money tracking
bot.command('track', async (ctx) => {
  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    await ctx.reply('Usage: /track <walletAddress>');
    return;
  }
  // Placeholder
  await ctx.reply(`Tracking wallet ${args[1]} (placeholder)`);
});

bot.command('untrack', async (ctx) => {
  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    await ctx.reply('Usage: /untrack <walletAddress>');
    return;
  }
  await ctx.reply(`Untracked ${args[1]} (placeholder)`);
});

// Start bot
async function main() {
  await walletStore.init();
  console.log('Wallet store initialized');
  bot.launch();
  console.log('ERROR404 bot started');
}

main().catch(console.error);

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
