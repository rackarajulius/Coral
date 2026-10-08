import { ArgumentsHost, BadGatewayException, Logger } from '@nestjs/common';
import { AllExceptionsFilter } from '../../../src/common/filters/all-exceptions.filter';

describe('account closure error transport', () => {
  afterEach(() => jest.restoreAllMocks());

  it('retains the exact partial-closure code and flag so the browser signs out', () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = { switchToHttp: () => ({
      getResponse: () => ({ status }), getRequest: () => ({ method: 'DELETE', url: '/api/v1/auth/account' }),
    }) } as unknown as ArgumentsHost;
    const message = 'Your sign-in account is closed, but data cleanup could not finish. Please contact support.';
    new AllExceptionsFilter().catch(new BadGatewayException({
      code: 'ACCOUNT_CLOSED_CLEANUP_PENDING', accountClosed: true, message,
      privateDebug: 'must never be returned',
    }), host);
    expect(status).toHaveBeenCalledWith(502);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      success: false, message, code: 'ACCOUNT_CLOSED_CLEANUP_PENDING', accountClosed: true,
    }));
    expect(json.mock.calls[0][0]).not.toHaveProperty('privateDebug');
  });
});
