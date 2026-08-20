// src/services/wallet.ts

import { ethers } from 'ethers';
import { Wallet as TWallet } from '../types';
import { WalletStore } from './walletStore';
import { RPCService } from './rpc';

export class WalletService {
  constructor(
    private store: WalletStore,
    private rpc: RPCService
  ) {}

  async createWallet(name?: string): Promise<TWallet> {
    const wallet = ethers.Wallet.createRandom();
    const newWallet = await this.store.create({
      address: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: wallet.mnemonic?.phrase,
      name,
    });
    // If no active wallet, set this as active
    if (!this.store.getActive()) {
      await this.store.setActive(newWallet.id);
    }
    return newWallet;
  }

  async importPrivateKey(privateKey: string, name?: string): Promise<TWallet> {
    const wallet = new ethers.Wallet(privateKey);
    // Check if already exists
    const existing = this.store.getAll().find(w => w.address.toLowerCase() === wallet.address.toLowerCase());
    if (existing) return existing;
    const newWallet = await this.store.create({
      address: wallet.address,
      privateKey,
      name,
    });
    if (!this.store.getActive()) {
      await this.store.setActive(newWallet.id);
    }
    return newWallet;
  }

  async importMnemonic(mnemonic: string, name?: string): Promise<TWallet> {
    const wallet = ethers.Wallet.fromPhrase(mnemonic);
    return this.importPrivateKey(wallet.privateKey, name);
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
