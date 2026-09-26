import { Injectable, NotImplementedException } from '@nestjs/common';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreateContractDto } from './dto/create-contract.dto';

@Injectable()
export class ContractsService {
  listMyContracts(userId: string, pagination: PaginationDto) {
    const page = pagination.page ?? 1;
    const limit = Math.min(pagination.limit ?? 20, 100);

    return {
      data: [],
      meta: {
        page,
        limit,
        total: 0,
        totalPages: 0,
      },
      userId,
      message: 'Contracts module scaffolded. Persistence pending contracts and escrow models.',
    };
  }

  getContractById(contractId: string, userId: string) {
    return {
      id: contractId,
      userId,
      message: 'Contracts module scaffolded. Persistence pending.',
    };
  }

  createContract(clientId: string, dto: CreateContractDto) {
    throw new NotImplementedException(
      `Create contract for freelancer ${dto.freelancerId} by client ${clientId} is pending schema integration.`,
    );
  }

  updateStatus(contractId: string, userId: string, status: string) {
    return {
      success: true,
      contractId,
      actor: userId,
      status,
      message: 'Contract status update scaffolded. Persistence pending.',
    };
  }
}

