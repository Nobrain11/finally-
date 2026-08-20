// src/services/alerts.ts

import { Alert, AlertType } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class AlertsService {
  private alerts: Alert[] = [];

  createAlert(
    userId: string,
    type: AlertType,
    tokenAddress?: string,
    threshold?: number
  ): Alert {
    const alert: Alert = {
      id: uuidv4(),
      userId,
      type,
      tokenAddress,
      threshold,
      enabled: true,
      createdAt: new Date(),
    };
    this.alerts.push(alert);
    return alert;
  }

  toggleAlert(id: string, enabled: boolean): Alert {
    const alert = this.alerts.find(a => a.id === id);
    if (!alert) throw new Error('Alert not found');
    alert.enabled = enabled;
    return alert;
  }

  deleteAlert(id: string): void {
    this.alerts = this.alerts.filter(a => a.id !== id);
  }

  getAlertsForUser(userId: string): Alert[] {
    return this.alerts.filter(a => a.userId === userId);
  }

  // Check if any alert triggers based on token data
  checkAlerts(token: Token, userId?: string): Alert[] {
    const triggered: Alert[] = [];
    const targetAlerts = userId 
      ? this.alerts.filter(a => a.userId === userId && a.enabled)
      : this.alerts.filter(a => a.enabled);

    for (const alert of targetAlerts) {
      if (alert.tokenAddress && alert.tokenAddress.toLowerCase() !== token.address.toLowerCase()) continue;
      switch (alert.type) {
        case AlertType.MOMENTUM:
          if (alert.threshold !== undefined && token.momentumScore >= alert.threshold) {
            triggered.push(alert);
          }
          break;
        case AlertType.SMART_MONEY:
          if (alert.threshold !== undefined && token.smartMoneyScore >= alert.threshold) {
            triggered.push(alert);
          }
          break;
        case AlertType.LIQUIDITY:
          if (alert.threshold !== undefined && token.liquidityScore >= alert.threshold) {
            triggered.push(alert);
          }
          break;
        case AlertType.RISK:
          if (alert.threshold !== undefined && token.riskScore <= alert.threshold) {
            triggered.push(alert);
          }
          break;
        case AlertType.OPPORTUNITY:
          if (alert.threshold !== undefined && token.overallScore >= alert.threshold) {
            triggered.push(alert);
          }
          break;
      }
    }
    return triggered;
  }
}
