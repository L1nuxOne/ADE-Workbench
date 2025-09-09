import { describe, it, expect, vi } from 'vitest';
import { HostClient } from '../src/lib/hostClient';

describe('lib host abstraction', () => {
  it('gitStatus succeeds via client.run', async () => {
    const client = new HostClient();
    client.run = vi.fn().mockResolvedValue({ status: 0, stdout: '', stderr: '' }) as any;
    const { gitStatus } = await import('../src/lib/git');
    await expect(gitStatus(client)).resolves.toEqual([]);
  });

  it('gitStatus propagates client.run errors', async () => {
    const client = new HostClient();
    client.run = vi.fn().mockRejectedValue(new Error('no host')) as any;
    const { gitStatus } = await import('../src/lib/git');
    await expect(gitStatus(client)).rejects.toThrow('no host');
  });

  it('listOpenPRs uses client.run', async () => {
    const client = new HostClient();
    const mock = vi.fn().mockResolvedValue({ status: 0, stdout: '[]', stderr: '' });
    client.run = mock as any;
    const { listOpenPRs } = await import('../src/lib/gh');
    await expect(listOpenPRs(client)).resolves.toEqual([]);
    expect(mock).toHaveBeenCalled();
  });

  it('listChangedFiles uses client.run', async () => {
    const client = new HostClient();
    const mock = vi.fn().mockResolvedValue({ status: 0, stdout: 'a\n', stderr: '' });
    client.run = mock as any;
    const { listChangedFiles } = await import('../src/lib/conflict');
    await expect(listChangedFiles(client, 'base', 'ref')).resolves.toEqual(['a']);
    expect(mock).toHaveBeenCalled();
  });
});
