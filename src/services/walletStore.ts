import fs from 'fs/promises';
import path from 'path';
import { Wallet } from '../types';
import { v4 as uuidv4 } from 'uuid';

const STORE_PATH = path.join(__dirname, '../../data/wallets.json');

export class WalletStore {
  private wallets: Wallet[] = [];
  private initialized = false;

  async init() {
    if (this.initialized) return;
    try {
      const data = await fs.readFile(STORE_PATH, 'utf-8');
      this.wallets = JSON.parse(data).map((w: any) => ({
        ...w,
        createdAt: new Date(w.createdAt),
      }));
    } catch {
      this.wallets = [];
    }
    this.initialized = true;
  }

  async save() {
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(this.wallets, null, 2));
  }

  getAll(): Wallet[] {
    return this.wallets;
  }

  getActive(): Wallet | undefined {
    return this.wallets.find(w => w.isActive);
  }

  getById(id: string): Wallet | undefined {
    return this.wallets.find(w => w.id === id);
  }

  async create(wallet: Omit<Wallet, 'id' | 'createdAt' | 'isActive'>): Promise<Wallet> {
    const newWallet: Wallet = {
      ...wallet,
      id: uuidv4(),
      createdAt: new Date(),
      isActive: false,
    };
    this.wallets.push(newWallet);
    await this.save();
    return newWallet;
  }

  async update(id: string, updates: Partial<Wallet>) {
    const index = this.wallets.findIndex(w => w.id === id);
    if (index === -1) throw new Error('Wallet not found');
    this.wallets[index] = { ...this.wallets[index], ...updates };
    await this.save();
    return this.wallets[index];
  }

  async setActive(id: string) {
    this.wallets.forEach(w => w.isActive = false);
    const wallet = this.getById(id);
    if (!wallet) throw new Error('Wallet not found');
    wallet.isActive = true;
    await this.save();
    return wallet;
  }

  async delete(id: string) {
    this.wallets = this.wallets.filter(w => w.id !== id);
    await this.save();
  }
}
