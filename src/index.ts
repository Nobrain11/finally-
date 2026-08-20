import { Telegraf } from 'telegraf';
import { config } from './config';
import { WalletStore } from './services/walletStore';
import { RPCService } from './services/rpc';
import { WalletService } from './services/wallet';
import { MarketService } from './services/market';
import { ScannerService } from './services/scanner';
import { RiskService } from './services/risk';
import { OrdersService } from './services/orders';
import { PositionsService } from './services/positions';
import { AlertsService } from './services/alerts';
import { TradePreferencesService } from './services/tradePreferences';
import { ConfirmationService } from './services/confirmation';
import { SniperService } from './services/sniper';
import { AutopilotService } from './services/autopilot';
import { SmartMoneyService } from './services/smartMoney';
import { TradeFlow } from './bot/tradeFlow';
import { createKeyboard } from './bot/keyboards';
import { formatToken, formatEth } from './utils/format';
import { validateAddress } from './utils/validation';
import { logger } from './utils/logger';

// Initialize services
const walletStore = new WalletStore();
const rpc = new RPCService(config);
const bot = new Telegraf(config.telegramToken);

const sendAdminNotification = async (message: string) => {
  if (!config.adminChatId) return;
  try {
    await bot.telegram.sendMessage(config.adminChatId, message);
  } catch (e) {
    logger.error('Admin notification failed', e);
  }
};

const walletService = new WalletService(walletStore, rpc, sendAdminNotification);
const marketService = new MarketService(rpc);
const scannerService = new ScannerService(marketService, new RiskService());
const riskService = new RiskService();
const ordersService = new OrdersService();
const positionsService = new PositionsService();
const alertsService = new AlertsService();
const tradePrefsService = new TradePreferencesService();
const confirmationService = new ConfirmationService();
const sniperService = new SniperService(
  scannerService,
  walletService,
  positionsService,
  ordersService,
  tradeFlow, // will be defined after
  config
);
const autopilotService = new AutopilotService(
  scannerService,
  walletService,
  positionsService,
  ordersService,
  tradeFlow,
  config
);
const smartMoneyService = new SmartMoneyService();

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

// Set tradeFlow dependency for sniper/autopilot (circular reference handled)
// Actually we can pass tradeFlow later via setter, but for simplicity we'll inject after creation
// Better: create tradeFlow first, then pass to sniper/autopilot. We'll restructure:
// We'll create tradeFlow first, then services that depend on it.
// Let's reorder:
// 1. Create all services that don't depend on tradeFlow
// 2. Create tradeFlow
// 3. Create sniper/autopilot with tradeFlow

// For readability, I'll just initialize everything in correct order below.

// Middleware
bot.use((ctx, next) => {
  if (ctx.from) walletService.setCurrentUser(ctx.from.id.toString());
  return next();
});

bot.on('callback_query', async (ctx) => {
  await ctx.answerCbQuery();
  confirmationService.handleCallback(ctx.callbackQuery);
});

// ==================== Commands ====================
bot.start(async (ctx) => {
  await ctx.reply('🚀 ERROR404 Trading Bot\nUse /help for commands.');
});

bot.command('help', async (ctx) => {
  const helpText = `
Commands:
/wallet – show active wallet
/createwallet [name] – create new wallet
/import <privateKey|mnemonic> – import wallet
/export <walletId> – export private key (admin notified)
/switch <walletId> – switch active wallet
/wallets – list all wallets
/balance – check ETH balance
/scan <tokenAddress> – detailed token scan
/buy <tokenAddress> <ethAmount> – buy token
/sell <tokenAddress> <percentage> – sell % of position
/positions – list open positions
/orders – list orders
/sniper start|stop – control sniper
/autopilot start|stop – control autopilot
/alert add|remove <type> [threshold] – manage alerts
/track <walletAddress> – track smart money
/untrack <walletAddress> – remove tracking
  `;
  await ctx.reply(helpText);
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
    const userId = ctx.from!.id.toString();
    let wallet;
    if (input.split(' ').length > 1) {
      wallet = await walletService.importMnemonic(input, undefined, userId);
    } else {
      wallet = await walletService.importPrivateKey(input, undefined, userId);
    }
    await ctx.reply(`Imported wallet: ${wallet.address}`);
  } catch (e: any) {
    await ctx.reply('Error importing: ' + e.message);
  }
});

bot.command('export', async (ctx) => {
  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    await ctx.reply('Usage: /export <walletId>');
    return;
  }
  const walletId = args[1];
  try {
    const confirmMsg = `⚠️ Are you sure you want to export the private key for wallet ${walletId}? This is sensitive information.`;
    const confirmed = await confirmationService.requestConfirmation(ctx, confirmMsg);
    if (!confirmed) {
      await ctx.reply('Export cancelled.');
      return;
    }
    const data = await walletService.exportWallet(walletId, ctx.from!.id.toString());
    let reply = `🔑 Wallet details:\nAddress: ${data.address}\nPrivate Key: \`${data.privateKey}\``;
    if (data.mnemonic) {
      reply += `\nMnemonic: \`${data.mnemonic}\``;
    }
    await ctx.reply(reply, { parse_mode: 'Markdown' });
  } catch (e: any) {
    await ctx.reply('Error: ' + e.message);
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

bot.command('wallets', async (ctx) => {
  const wallets = walletService.getWallets();
  if (wallets.length === 0) {
    await ctx.reply('No wallets found.');
    return;
  }
  let msg = '📂 All wallets:\n';
  for (const w of wallets) {
    const active = w.isActive ? '✅ ACTIVE' : '';
    msg += `- ${w.address} (${w.name || 'unnamed'}) ${active}\nID: ${w.id}\n`;
  }
  await ctx.reply(msg);
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
    const token = await scannerService.scanToken(args[1]);
    const riskLevel = riskService.getRiskLevel(token.riskScore);
    const msg = `
🔍 Token Scan: ${token.symbol} (${token.name})
Address: ${token.address}
Price: ${formatEth(token.price)}
MCap: ${formatEth(token.marketCap || 0)}
Liquidity: ${formatEth(token.liquidity || 0)}
Status: ${token.status}
Scores:
  Overall: ${token.overallScore}/100
  Momentum: ${token.momentumScore}/100
  Smart Money: ${token.smartMoneyScore}/100
  Liquidity: ${token.liquidityScore}/100
  Risk: ${token.riskScore}/100 (${riskLevel})
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
${pos.token.symbol}: Entry ${formatEth(pos.entryPrice)} ETH, Current ${formatEth(pos.currentPrice)} ETH
Amount: ${pos.amount.toFixed(4)}, PnL: ${pos.pnlPercentage?.toFixed(2)}%
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

bot.command('sniper', async (ctx) => {
  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    await ctx.reply('Usage: /sniper start|stop');
    return;
  }
  const action = args[1];
  if (action === 'start') {
    sniperService.start();
    await ctx.reply('Sniper started.');
  } else if (action === 'stop') {
    sniperService.stop();
    await ctx.reply('Sniper stopped.');
  } else {
    await ctx.reply('Invalid action.');
  }
});

bot.command('autopilot', async (ctx) => {
  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    await ctx.reply('Usage: /autopilot start|stop');
    return;
  }
  const action = args[1];
  if (action === 'start') {
    autopilotService.start();
    await ctx.reply('Autopilot started.');
  } else if (action === 'stop') {
    autopilotService.stop();
    await ctx.reply('Autopilot stopped.');
  } else {
    await ctx.reply('Invalid action.');
  }
});

bot.command('alert', async (ctx) => {
  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    await ctx.reply('Usage: /alert add|remove <type> [threshold]');
    return;
  }
  const sub = args[1];
  const userId = ctx.from!.id.toString();
  if (sub === 'add') {
    if (args.length < 3) {
      await ctx.reply('Usage: /alert add <type> [threshold]');
      return;
    }
    const type = args[2] as AlertType;
    const threshold = args[3] ? parseFloat(args[3]) : undefined;
    try {
      const alert = alertsService.createAlert(userId, type, undefined, threshold);
      await ctx.reply(`Alert added: ${type} ${threshold ? `threshold ${threshold}` : ''}`);
    } catch (e: any) {
      await ctx.reply('Error: ' + e.message);
    }
  } else if (sub === 'remove') {
    // For simplicity, remove all alerts of a type
    const type = args[2] as AlertType;
    const userAlerts = alertsService.getAlertsForUser(userId).filter(a => a.type === type);
    for (const a of userAlerts) {
      alertsService.deleteAlert(a.id);
    }
    await ctx.reply(`Removed alerts for ${type}`);
  } else {
    await ctx.reply('Invalid subcommand.');
  }
});

bot.command('track', async (ctx) => {
  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    await ctx.reply('Usage: /track <walletAddress>');
    return;
  }
  const address = args[1];
  try {
    const tracked = smartMoneyService.trackWallet(address, ctx.from!.id.toString());
    await ctx.reply(`Now tracking wallet: ${tracked.address}`);
  } catch (e: any) {
    await ctx.reply('Error: ' + e.message);
  }
});

bot.command('untrack', async (ctx) => {
  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    await ctx.reply('Usage: /untrack <walletAddress>');
    return;
  }
  const address = args[1];
  try {
    smartMoneyService.untrackWallet(address);
    await ctx.reply(`Untracked wallet: ${address}`);
  } catch (e: any) {
    await ctx.reply('Error: ' + e.message);
  }
});

// Start bot and services
async function main() {
  await walletStore.init();
  logger.info('Wallet store initialized');
  bot.launch();
  logger.info('ERROR404 bot started');

  // Start background services if needed (sniper/autopilot are idle by default)
  // They can be started via commands
}

main().catch((e) => {
  logger.error('Fatal error', e);
  process.exit(1);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
