import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(() => {
  vi.resetModules();
});

describe('lib host abstraction', () => {
  it('gitStatus succeeds via hostRun', async () => {
    vi.doMock('../src/lib/host', () => ({ hostRun: vi.fn().mockResolvedValue({ status: 0, stdout: '', stderr: '' }) }));
    const { gitStatus } = await import('../src/lib/git');
    await expect(gitStatus()).resolves.toEqual([]);
  });

  it('gitStatus propagates hostRun errors', async () => {
    vi.doMock('../src/lib/host', () => ({ hostRun: vi.fn().mockRejectedValue(new Error('no host')) }));
    const { gitStatus } = await import('../src/lib/git');
    await expect(gitStatus()).rejects.toThrow('no host');
  });

  it('listOpenPRs uses hostRun', async () => {
    const mock = vi.fn().mockResolvedValue({ status: 0, stdout: '[]', stderr: '' });
    vi.doMock('../src/lib/host', () => ({ hostRun: mock }));
    const { listOpenPRs } = await import('../src/lib/gh');
    await expect(listOpenPRs()).resolves.toEqual([]);
    expect(mock).toHaveBeenCalled();
  });

  it('listChangedFiles uses hostRun', async () => {
    const mock = vi.fn().mockResolvedValue({ status: 0, stdout: 'a\n', stderr: '' });
    vi.doMock('../src/lib/host', () => ({ hostRun: mock }));
    const { listChangedFiles } = await import('../src/lib/conflict');
    await expect(listChangedFiles('base', 'ref')).resolves.toEqual(['a']);
    expect(mock).toHaveBeenCalled();
  });
});
