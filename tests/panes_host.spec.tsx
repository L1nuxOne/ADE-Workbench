/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';

afterEach(() => {
  cleanup();
  vi.resetModules();
});

function mockHostCtx(sequence: Array<'down' | 'http'>) {
  const client = {
    status: sequence[0],
    ensure: vi.fn().mockImplementation(() => {
      const next = sequence.shift()!;
      client.status = next;
      return Promise.resolve(next);
    }),
    run: vi.fn(),
    read: vi.fn(),
  } as any;
  const useHost = () => ({ client, status: client.status as any, retry: vi.fn() });
  vi.doMock('../src/lib/hostCtx', () => ({ useHost }));
  return { client };
}

describe('PRPane probes host on action', () => {
  it('shows error then loads when host becomes available', async () => {
    mockHostCtx(['down', 'http']);
    vi.doMock('../src/lib/gh', () => ({ listOpenPRs: vi.fn().mockResolvedValue([{ number: 1, title: 't', headRefName: 'b' }]) }));
    vi.doMock('../src/lib/flowLaunch', () => ({ seedMergeTrainRefs: vi.fn() }));
    const { PRPane } = await import('../src/components/PRPane');
    render(<PRPane />);
    await screen.findByText(/Host unavailable/);
    fireEvent.click(screen.getByText('Reload'));
    await screen.findByText('#1');
  });
});

describe('WorkspacePane probes host on action', () => {
  it('shows error then loads when host is ready', async () => {
    mockHostCtx(['down', 'http']);
    vi.doMock('../src/lib/git', () => ({
      gitStatus: vi.fn().mockResolvedValue([{ path: 'f.txt', staged: false, status: 'M' }]),
      gitDiffFile: vi.fn().mockResolvedValue('diff')
    }));
    const { WorkspacePane } = await import('../src/components/WorkspacePane');
    render(<WorkspacePane />);
    await screen.findByText(/Host unavailable/);
    fireEvent.click(screen.getByText('Reload'));
    await screen.findByText('f.txt');
  });
});

describe('ConflictPane probes host on action', () => {
  it('handles host availability per analyze', async () => {
    mockHostCtx(['down', 'http']);
    const listChangedFiles = vi.fn().mockResolvedValue(['a']);
    vi.doMock('../src/lib/conflict', () => ({
      listChangedFiles,
      buildOverlapMatrix: vi.fn().mockReturnValue({ matrix: [], totals: [], order: [] }),
      listHunks: vi.fn(),
      buildHunkOverlap: vi.fn().mockReturnValue({ matrix: [], totals: [], hotPairs: [] }),
      matrixToCSV: vi.fn()
    }));
    const { ConflictPane } = await import('../src/components/ConflictPane');
    render(<ConflictPane />);
    fireEvent.change(screen.getByLabelText(/Refs/), { target: { value: 'r1' } });
    const btn = screen.getByText('Analyze');
    fireEvent.click(btn);
    await screen.findByText(/Host unavailable/);
    fireEvent.click(btn);
    await waitFor(() => expect(listChangedFiles).toHaveBeenCalled());
  });
});

describe('FlowsPane probes host on reload', () => {
  it('shows error then lists flows when host starts', async () => {
    const { client } = mockHostCtx(['down', 'http']);
    vi.doMock('../src/lib/flows', () => ({ discoverFlows: vi.fn().mockResolvedValue([{ id: 'f', name: 'Flow', version: '1', source: 's' }]), template: vi.fn((s) => s) }));
    vi.doMock('../src/lib/flowInputs', () => ({ loadFlowVars: () => ({}), saveFlowVars: vi.fn() }));
    vi.doMock('../src/lib/cmd', () => ({ parseCommand: vi.fn(() => ['echo']) }));
    const { FlowsPane } = await import('../src/components/FlowsPane');
    render(<FlowsPane />);
    await screen.findByText(/Host unavailable/);
    fireEvent.click(screen.getByText('Reload'));
    await screen.findByText('Flow');
    expect(client.ensure).toHaveBeenCalledTimes(2);
  });
});
