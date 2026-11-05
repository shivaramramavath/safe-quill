import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(() => {
    controller = new HealthController();
  });

  it('should return health status with services and security metadata', async () => {
    const res = await controller.getHealth();
    expect(res).toBeDefined();
    expect(res.status).toBe('ok');
    expect(res.version).toBe('1.0.0');
    expect(res.environment).toBeDefined();
    expect(res.services).toBeDefined();
    expect(res.security.rawEmailLogging).toContain('disabled');
  });
});
