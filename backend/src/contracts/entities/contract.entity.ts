export interface ContractEntity {
  id: string;
  gigId?: string | null;
  proposalId?: string | null;
  clientId: string;
  freelancerId: string;
  amount: number;
  status: string;
  createdAt: Date;
}

