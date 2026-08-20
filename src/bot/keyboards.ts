import { Markup } from 'telegraf';

export const confirmationKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('✅ Confirm', 'confirm_yes')],
  [Markup.button.callback('❌ Cancel', 'confirm_no')],
]);

export const sellPercentageKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback('25%', 'sell_25'),
    Markup.button.callback('50%', 'sell_50'),
    Markup.button.callback('75%', 'sell_75'),
    Markup.button.callback('100%', 'sell_100'),
  ],
  [Markup.button.callback('❌ Cancel', 'sell_cancel')],
]);

export const mainMenuKeyboard = Markup.keyboard([
  ['/wallet', '/balance', '/positions'],
  ['/scan', '/buy', '/sell'],
  ['/sniper', '/autopilot', '/alerts'],
]).resize();
