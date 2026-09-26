export interface EscrowTransactionEntity {
  id: string;
  contractId: string;
  payerId: string;
  payeeId: string;
  amount: number;
  status: string;
  createdAt: Date;
}

