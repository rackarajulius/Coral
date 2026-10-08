import { BadRequestException, ConflictException } from '@nestjs/common';
import { InterviewCoachService } from '../../../src/interview-coach/interview-coach.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { AiService } from '../../../src/services/ai/ai.service';
import { SeekerEntitlementsService } from '../../../src/seeker-entitlements/seeker-entitlements.service';
import { User } from '../../../src/common/types/user.types';

describe('InterviewCoachService', () => {
  const user = { id: 'user-1' } as User;
  const question = { id: 'q1', text: 'What did you build?', competency: 'technicalDepth', keywords: ['build'], expectedSec: 90 };
  const session = {
    id: 'session-1', userId: user.id, status: 'active', screenId: null, meteredAt: new Date(),
    config: { role: 'Engineer', type: 'technical' }, questions: [question], answers: [], transcript: [],
    liveScores: null, questionIndex: 0, durationSec: 0, updatedAt: new Date('2026-10-04T00:00:00Z'),
  };
  const findSession = jest.fn();
  const updateSession = jest.fn();
  const updateManySessions = jest.fn();
  const findProfile = jest.fn();
  const findReport = jest.fn();
  const upsertReport = jest.fn();
  const evaluateAI = jest.fn();
  const reportAI = jest.fn();
  const generateQuestions = jest.fn();
  const assertAllowed = jest.fn();
  const recordUsage = jest.fn();
  const service = new InterviewCoachService(
    { interviewCoachSession: { findUnique: findSession, update: updateSession, updateMany: updateManySessions }, interviewCoachReport: { findUnique: findReport, upsert: upsertReport }, jobSeekerProfile: { findUnique: findProfile } } as unknown as PrismaService,
    { evaluateCoachAnswer: evaluateAI, buildCoachReport: reportAI, generateCoachQuestions: generateQuestions } as unknown as AiService,
    { assertAllowed, record: recordUsage } as unknown as SeekerEntitlementsService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    findSession.mockResolvedValue(session);
    findReport.mockResolvedValue(null);
    updateSession.mockResolvedValue(session);
    updateManySessions.mockResolvedValue({ count: 1 });
    findProfile.mockResolvedValue(null);
    evaluateAI.mockResolvedValue({
      scores: { communication: 80, confidence: 70, technicalDepth: 90, problemSolving: 60, structure: 75 },
      followUp: null, note: 'Good detail.',
    });
  });

  it('scores only the next server-planned question and persists its answer and running scores', async () => {
    const evaluation = await service.evaluate(user, session.id, { questionId: question.id, answer: 'I built the service.', durationSec: 42 });
    expect(evaluateAI).toHaveBeenCalledWith(expect.objectContaining({ question: question.text, competency: question.competency }));
    expect(evaluation.scores).toEqual({ communication: 62, confidence: 58, technicalDepth: 66, problemSolving: 54, structure: 60 });
    expect(updateManySessions.mock.calls[0][0].data).toMatchObject({ questionIndex: 1, liveScores: evaluation.scores });
    expect(updateManySessions.mock.calls[0][0].data.answers[0]).toMatchObject({ questionId: question.id, transcript: 'I built the service.', evaluation });
  });

  it('rejects an arbitrary question before spending an AI call', async () => {
    await expect(service.evaluate(user, session.id, { questionId: 'forged', answer: 'A', durationSec: 1 })).rejects.toBeInstanceOf(BadRequestException);
    expect(evaluateAI).not.toHaveBeenCalled();
  });

  it('does not add follow-up questions to a fixed employer screening', async () => {
    findSession.mockResolvedValue({ ...session, screenId: 'screen-1', meteredAt: null });
    evaluateAI.mockResolvedValue({
      scores: { communication: 60, confidence: 60, technicalDepth: 60, problemSolving: 60, structure: 60 },
      followUp: 'Tell me more?', note: '',
    });
    const evaluation = await service.evaluate(user, session.id, { questionId: question.id, answer: 'My answer', durationSec: 20 });
    expect(evaluation.followUp).toBeUndefined();
    expect(updateManySessions.mock.calls[0][0].data.answers).toHaveLength(1);
  });

  it('returns a saved evaluation for an identical retry and rejects changed content', async () => {
    const evaluation = { scores: { communication: 60 }, delta: {}, fillerCount: 0, wordCount: 2 };
    findSession.mockResolvedValue({ ...session, answers: [{ questionId: question.id, transcript: 'Same answer', evaluation }] });
    await expect(service.evaluate(user, session.id, { questionId: question.id, answer: 'Same answer', durationSec: 2 })).resolves.toEqual(evaluation);
    await expect(service.evaluate(user, session.id, { questionId: question.id, answer: 'Different answer', durationSec: 2 })).rejects.toBeInstanceOf(ConflictException);
    expect(evaluateAI).not.toHaveBeenCalled();
  });

  it('will not complete a session without a server-generated report', async () => {
    await expect(service.complete(user, session.id)).rejects.toBeInstanceOf(BadRequestException);
    expect(updateSession).not.toHaveBeenCalled();
  });

  it('returns the winning stored plan when two planning requests race', async () => {
    findSession.mockResolvedValueOnce({ ...session, meteredAt: null, questions: [] })
      .mockResolvedValueOnce({ ...session, meteredAt: new Date(), questions: [question] });
    generateQuestions.mockResolvedValue({ greeting: 'Welcome', questions: [{ text: 'Different question', competency: 'technicalDepth', keywords: [], expectedSec: 90 }] });
    updateManySessions.mockResolvedValue({ count: 0 });

    const plan = await service.plan(user, session.id);
    expect(plan.questions).toEqual([question]);
    expect(recordUsage).not.toHaveBeenCalled();
    expect(updateSession).not.toHaveBeenCalled();
  });

  it('builds the report from saved answers and scores, then completes with that report', async () => {
    const scores = { communication: 60, confidence: 70, technicalDepth: 80, problemSolving: 65, structure: 75 };
    const savedAnswer = {
      questionId: question.id, transcript: 'I built the service.', durationSec: 42, typed: false,
      question, askedAt: '2026-10-04T00:00:00Z',
      evaluation: { scores, delta: {}, fillerCount: 0, wordCount: 4 },
    };
    findSession.mockResolvedValue({ ...session, answers: [savedAnswer], liveScores: scores });
    reportAI.mockResolvedValue({
      recommendation: 'Practise explaining the trade-off.', strengths: ['Clear technical detail'],
      weaknesses: [], repeatedMistakes: [], focusAreas: [], competencyInsights: [], sampleAnswers: [],
    });
    upsertReport.mockImplementation(async ({ create }) => ({ report: create.report }));

    const report = await service.report(user, session.id) as { overallScore: number; recommendation: string };
    expect(report.overallScore).toBe(70);
    expect(reportAI).toHaveBeenCalledWith(expect.objectContaining({
      finalScores: scores,
      qa: [{ question: question.text, competency: question.competency, answer: savedAnswer.transcript }],
    }));
    expect(report.recommendation).toBe('Practise explaining the trade-off.');

    findReport.mockResolvedValue({ report });
    updateSession.mockResolvedValue({ ...session, status: 'completed' });
    await expect(service.complete(user, session.id)).resolves.toMatchObject({ report });
  });
});
