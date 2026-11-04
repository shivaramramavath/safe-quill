import { RedactingLogger } from './redacting-logger.service';

describe('RedactingLogger', () => {
  let logger: RedactingLogger;
  let stdoutSpy: jest.SpyInstance;

  beforeEach(() => {
    logger = new RedactingLogger('TestScope');
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
  });

  it('redacts sensitive json fields: body, subject, and rawHeaders', () => {
    const rawPayload = JSON.stringify({
      subject: 'Secret Phishing test',
      body: 'Click this link immediately to avoid account suspension: http://evil.com',
      rawHeaders: 'From: evil@attacker.com',
      otherField: 'safe metadata',
    });

    logger.log(rawPayload);

    expect(stdoutSpy).toHaveBeenCalled();
    const loggedOutput = stdoutSpy.mock.calls.map((c) => c[0]).join('');
    expect(loggedOutput).not.toContain('Secret Phishing test');
    expect(loggedOutput).not.toContain('http://evil.com');
    expect(loggedOutput).not.toContain('evil@attacker.com');
    expect(loggedOutput).toContain('REDACTED_CONTENT');
  });

  it('redacts object arguments directly', () => {
    logger.log({
      subject: 'Confidential subject',
      body: 'Do not log me',
    });

    const loggedOutput = stdoutSpy.mock.calls.map((c) => c[0]).join('');
    expect(loggedOutput).not.toContain('Confidential subject');
    expect(loggedOutput).not.toContain('Do not log me');
    expect(loggedOutput).toContain('REDACTED');
  });
});
