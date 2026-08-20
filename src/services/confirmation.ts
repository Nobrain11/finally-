// src/services/confirmation.ts

import { Context } from 'telegraf';

export class ConfirmationService {
  // Store pending confirmations: userId -> { action, data, resolve, reject }
  private pending: Map<string, any> = new Map();

  async requestConfirmation(
    ctx: Context,
    message: string,
    timeout: number = 60000
  ): Promise<boolean> {
    const userId = ctx.from?.id.toString();
    if (!userId) throw new Error('No user');

    // Send confirmation message with inline buttons
    const sent = await ctx.reply(message, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Confirm', callback_data: 'confirm_yes' },
            { text: '❌ Cancel', callback_data: 'confirm_no' },
          ],
        ],
      },
    });

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(userId);
        reject(new Error('Confirmation timeout'));
      }, timeout);

      this.pending.set(userId, {
        resolve: (result: boolean) => {
          clearTimeout(timer);
          this.pending.delete(userId);
          resolve(result);
        },
        reject: (err: any) => {
          clearTimeout(timer);
          this.pending.delete(userId);
          reject(err);
        },
        messageId: sent.message_id,
      });
    });
  }

  handleCallback(query: any) {
    const userId = query.from.id.toString();
    const data = query.data;
    const pending = this.pending.get(userId);
    if (!pending) {
      query.answer('No pending confirmation');
      return;
    }

    if (data === 'confirm_yes') {
      pending.resolve(true);
      query.answer('Confirmed');
    } else if (data === 'confirm_no') {
      pending.resolve(false);
      query.answer('Cancelled');
    } else {
      query.answer('Invalid option');
    }
  }
}
