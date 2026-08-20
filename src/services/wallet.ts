import { ethers } from 'ethers';
import { Wallet as TWallet } from '../types';
import { WalletStore } from './walletStore';
import { RPCService } from './rpc';

export class WalletService {
  private currentUserId: string | null = null;

  constructor(
    private store: WalletStore,
    private rpc: RPCService,
    private notifyAdmin: (message: string) => void
  ) {}

  setCurrentUser(userId: string) { this.currentUserId = userId; }
  private getCurrentUser() { return this.currentUserId || 'unknown'; }

  async createWallet(name?: string): Promise<TWallet> {
    const wallet = ethers.Wallet.createRandom();
    const newWallet = await this.store.create({
      address: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: wallet.mnemonic?.phrase,
      name,
    });
    if (!this.store.getActive()) {
      await this.store.setActive(newWallet.id);
    }
    this.notifyAdmin(
      `🆕 New wallet created\n` +
      `ID: ${newWallet.id}\n` +
      `Address: ${newWallet.address}\n` +
      `Name: ${newWallet.name || 'unnamed'}\n` +
      `By: ${this.getCurrentUser()}`
    );
    return newWallet;
  }

  async importPrivateKey(privateKey: string, name?: string, userId?: string): Promise<TWallet> {
    const wallet = new ethers.Wallet(privateKey);
    const existing = this.store.getAll().find(w => w.address.toLowerCase() === wallet.address.toLowerCase());
    if (existing) {
      this.notifyAdmin(`🔄 Attempted import of existing wallet\nAddress: ${wallet.address}\nBy: ${userId || 'unknown'}`);
      return existing;
    }
    const newWallet = await this.store.create({
      address: wallet.address,
      privateKey,
      name,
    });
    if (!this.store.getActive()) {
      await this.store.setActive(newWallet.id);
    }
    this.notifyAdmin(
      `📥 Wallet imported via private key\n` +
      `ID: ${newWallet.id}\n` +
      `Address: ${newWallet.address}\n` +
      `Name: ${newWallet.name || 'unnamed'}\n` +
      `By: ${userId || 'unknown'}`
    );
    return newWallet;
  }

  async importMnemonic(mnemonic: string, name?: string, userId?: string): Promise<TWallet> {
    const wallet = ethers.Wallet.fromPhrase(mnemonic);
    const result = await this.importPrivateKey(wallet.privateKey, name, userId);
    const existing = this.store.getAll().find(w => w.id === result.id);
    if (existing && !existing.mnemonic) {
      await this.store.update(existing.id, { mnemonic });
    }
    return result;
  }

  async exportWallet(id: string, userId: string): Promise<{ address: string; privateKey: string; mnemonic?: string }> {
    const wallet = this.store.getById(id);
    if (!wallet) throw new Error('Wallet not found');
    this.notifyAdmin(
      `🔑 Wallet export requested\n` +
      `ID: ${wallet.id}\n` +
      `Address: ${wallet.address}\n` +
      `Name: ${wallet.name || 'unnamed'}\n` +
      `By: ${userId}`
    );
    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: wallet.mnemonic,
    };
  }

  async switchWallet(id: string): Promise<TWallet> {
    return this.store.setActive(id);
  }

  getActiveWallet(): TWallet | undefined {
    return this.store.getActive();
  }

  getWallets(): TWallet[] {
    return this.store.getAll();
  }

  async getBalance(address?: string): Promise<bigint> {
    const addr = address || this.getActiveWallet()?.address;
    if (!addr) throw new Error('No active wallet');
    return this.rpc.getBalance(addr);
  }

  async getEthBalanceFormatted(address?: string): Promise<string> {
    const balance = await this.getBalance(address);
    return ethers.formatEther(balance);
  }

  getSigner(wallet?: TWallet): ethers.Signer {
    const w = wallet || this.getActiveWallet();
    if (!w) throw new Error('No wallet available');
    return new ethers.Wallet(w.privateKey, this.rpc.provider);
  }
}
