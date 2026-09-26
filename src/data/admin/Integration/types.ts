export interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  connected: boolean;
  lastSync: string;
  apiKey: string;
  webhookUrl: string;
  webhookActive: boolean;
  testMode: boolean;
}
