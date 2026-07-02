// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo, useState } from 'react';
import { ReactFlow, Background, Controls, Handle, Position, type NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './workflows.css';
import type { WorkflowNode } from '@tessio/shared';
import { IconButton, absTime } from '../ui';
import { Icon } from '../icons';
import type { Route } from '../shell';
import type { WorkflowNodeRunRow } from '../../api/workflows';
import { useWorkflowRun } from './queries';
import { NODE_META, summarize, toFlowNodes, toFlowEdges, type NodeStatusMap } from './graph-utils';
import { RunStatusPill, runDuration } from './WorkflowRuns';

type Go = (screen: string, extra?: Partial<Route>) => void;

function ReadonlyNodeCard({ data, selected }: NodeProps) {
  const node = (data as { node: WorkflowNode; status?: string }).node;
  const status = (data as { status?: string }).status;
  const meta = NODE_META[node.type];
  const statusIcon = { completed: 'check', failed: 'x', running: 'clock' }[status ?? ''];
  return (
    <div className={`wf-node${selected ? ' selected' : ''}`} data-status={status ?? (node.type === 'trigger' ? undefined : 'not-run')}>
      {node.type !== 'trigger' && <Handle type="target" position={Position.Left} isConnectable={false} />}
      <div className="wf-node-icon" style={{ background: meta.hue }}>
        <Icon name={meta.icon} size={15} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="wf-node-title">{node.name ?? meta.label}</div>
        <div className="wf-node-sub">{summarize(node)}</div>
      </div>
      {statusIcon && (
        <span className="wf-node-status">
          <Icon name={statusIcon} size={13} style={{ color: status === 'failed' ? 'var(--danger)' : status === 'completed' ? 'var(--success)' : 'var(--info)' }} />
        </span>
      )}
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  );
}

const NODE_TYPES = { wf: ReadonlyNodeCard };

function Json({ value }: { value: unknown }) {
  if (value === undefined || value === null) return <p className="muted" style={{ fontSize: 12, margin: 0 }}>—</p>;
  return <pre>{JSON.stringify(value, null, 2)}</pre>;
}

function NodeInspector({ node, nodeRun }: { node: WorkflowNode | undefined; nodeRun: WorkflowNodeRunRow | undefined }) {
  if (!node) {
    return <p className="wf-panel-hint">Select a node to inspect its input, output, and errors.</p>;
  }
  const meta = NODE_META[node.type];
  return (
    <div className="wf-inspector" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h3 style={{ margin: 0, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon name={meta.icon} size={15} /> {node.name ?? meta.label}
        {nodeRun && <span style={{ marginLeft: 'auto' }}><RunStatusPill status={nodeRun.status} /></span>}
      </h3>
      {!nodeRun && <p className="wf-panel-hint">This step did not run.</p>}
      {nodeRun && (
        <>
          {nodeRun.error && (
            <div className="wf-field">
              <label>Error</label>
              <pre style={{ color: 'var(--danger)' }}>{nodeRun.error}</pre>
            </div>
          )}
          <div className="wf-field">
            <label>Input</label>
            <Json value={nodeRun.input} />
          </div>
          <div className="wf-field">
            <label>Output</label>
            <Json value={nodeRun.output} />
          </div>
          {nodeRun.logs && nodeRun.logs.length > 0 && (
            <div className="wf-field">
              <label>Logs</label>
              <Json value={nodeRun.logs} />
            </div>
          )}
          <p className="muted" style={{ fontSize: 11.5, margin: 0 }}>
            {absTime(new Date(nodeRun.startedAt).getTime())} · {runDuration({ startedAt: nodeRun.startedAt, finishedAt: nodeRun.finishedAt })}
          </p>
        </>
      )}
    </div>
  );
}

export function RunDetail({ workflowId, runId, go }: { workflowId: string; runId: string; go: Go }) {
  const { data: run, isLoading, isError } = useWorkflowRun(workflowId, runId);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const statusByNode = useMemo<NodeStatusMap>(() => {
    const map: NodeStatusMap = {};
    for (const nr of run?.nodeRuns ?? []) map[nr.nodeId] = nr.status;
    return map;
  }, [run?.nodeRuns]);

  const flowNodes = useMemo(
    () => (run ? toFlowNodes(run.graph, statusByNode).map((n) => ({ ...n, draggable: false, selected: n.id === selectedNode })) : []),
    [run, statusByNode, selectedNode],
  );
  const flowEdges = useMemo(() => (run ? toFlowEdges(run.graph, statusByNode) : []), [run, statusByNode]);

  if (isLoading || !run) {
    return <div className="page"><div className="page-pad"><p className="muted">{isError ? 'Failed to load this run.' : 'Loading…'}</p></div></div>;
  }

  const ticket = run.triggerContext?.ticket as { number?: number; data?: { title?: string } } | undefined;
  const node = run.graph.nodes.find((n) => n.id === selectedNode);
  const nodeRun = [...run.nodeRuns].reverse().find((nr) => nr.nodeId === selectedNode);

  return (
    <div className="wf-editor">
      <div className="wf-toolbar">
        <IconButton name="arrowLeft" title="Back to runs" onClick={() => go('workflows', { workflowId, view: 'runs' })} />
        <span style={{ fontSize: 15, fontWeight: 600 }}>Run</span>
        <RunStatusPill status={run.status} />
        <span className="muted" style={{ fontSize: 12.5 }}>
          {run.triggerKind}{run.workflowVersion > 0 ? ` · v${run.workflowVersion}` : ' · draft'}
          {ticket?.number ? ` · ticket #${ticket.number}` : ''}
          {` · ${absTime(new Date(run.createdAt).getTime())} · ${runDuration(run)}`}
        </span>
        {run.error && <span className="wf-runrow-error" style={{ marginLeft: 8 }} title={run.error}>{run.error}</span>}
      </div>
      <div className="wf-body">
        <div className="wf-canvas">
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={NODE_TYPES}
            onNodeClick={(_e, n) => setSelectedNode(n.id)}
            onPaneClick={() => setSelectedNode(null)}
            nodesConnectable={false}
            elementsSelectable
            fitView
            fitViewOptions={{ maxZoom: 1, padding: 0.25 }}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={18} size={1.2} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
        <aside className="wf-panel">
          <NodeInspector node={node} nodeRun={nodeRun} />
        </aside>
      </div>
    </div>
  );
}
