import { Injectable } from '@nestjs/common';
import { AiService } from '../services/ai/ai.service';
import { CopilotDto } from './dto/copilot.dto';

export type CopilotAction =
  | { kind: 'source'; query: string }
  | { kind: 'screen'; candidateId: string; candidateName: string; mode: 'text' | 'video' }
  | { kind: 'outreach'; candidateId: string; candidateName: string }
  | { kind: 'none' };

export interface CopilotResult {
  reply: string;
  action: CopilotAction;
}

@Injectable()
export class CopilotService {
  constructor(private readonly ai: AiService) {}

  /** Turns a recruiter chat message into a grounded reply + a resolved next action. */
  async respond(dto: CopilotDto): Promise<CopilotResult> {
    const roster = dto.candidates ?? [];
    const plan = await this.ai.planHiringAction({
      message: dto.message,
      role: dto.role ?? '',
      candidates: roster.map((c) => ({ name: c.name, skills: c.skills ?? [], match: c.match ?? null })),
    });

    // Actions that target a candidate must resolve to a real roster entry with an id.
    if (plan.actionKind === 'screen' || plan.actionKind === 'outreach') {
      const target = plan.candidateName
        ? roster.find((c) => c.id && c.name.toLowerCase() === plan.candidateName!.toLowerCase())
        : undefined;
      if (!target?.id) {
        const name = plan.candidateName ? `"${plan.candidateName}"` : 'that candidate';
        return {
          reply: `${plan.reply}\n\n(I couldn't match ${name} to a candidate in your current list — open their card to act on them directly.)`,
          action: { kind: 'none' },
        };
      }
      return {
        reply: plan.reply,
        action:
          plan.actionKind === 'screen'
            ? { kind: 'screen', candidateId: target.id, candidateName: target.name, mode: plan.screenMode }
            : { kind: 'outreach', candidateId: target.id, candidateName: target.name },
      };
    }

    if (plan.actionKind === 'source') {
      return { reply: plan.reply, action: { kind: 'source', query: plan.query || dto.message } };
    }

    return { reply: plan.reply, action: { kind: 'none' } };
  }
}
