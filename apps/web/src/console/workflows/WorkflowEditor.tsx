// SPDX-License-Identifier: AGPL-3.0-only

import { type CSSProperties, type PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type Connection,
  type Edge as FlowEdge,
  type Node as FlowNode,
  type NodeChange,
  type EdgeChange,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './workflows.css';
import type { WorkflowEdge, WorkflowGraph, WorkflowNode, WorkflowNodeType } from '@tessio/shared';
import { validateWorkflowGraph, collectSecretRefs, type WorkflowGraphError } from '@tessio/shared';
import { Button, IconButton } from '../ui';
import { Icon } from '../icons';
import type { Route } from '../shell';
import { ApiError } from '../../api/types';
import type { GraphErrorItem } from '../../api/workflows';
import { useWorkflow, useSaveWorkflow, usePublishWorkflow, useRunWorkflow } from './queries';
import { useTickets } from '../tickets/queries';
import { useSecrets } from '../settings/queries';
import { NODE_META, PALETTE, summarize, createNode, newEdgeId, toFlowNodes, toFlowEdges } from './graph-utils';
import { NodeConfigPanel } from './NodeConfigPanel';
import { WorkflowStatusPill } from './WorkflowsList';

type Go = (screen: string, extra?: Partial<Route>) => void;

/** Custom canvas card for every workflow node type. */
function WfNodeCard({ data, selected }: NodeProps) {
  const node = (data as { node: WorkflowNode; status?: string }).node;
  const status = (data as { status?: string }).status;
  const meta = NODE_META[node.type];
  return (
    <div className={`wf-node${selected ? ' selected' : ''}`} data-status={status}>
      {node.type !== 'trigger' && <Handle type="target" position={Position.Left} />}
      <div className="wf-node-icon" style={{ background: meta.hue }}>
        <Icon name={meta.icon} size={15} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="wf-node-title">{node.name ?? meta.label}</div>
        <div className="wf-node-sub">{summarize(node)}</div>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const NODE_TYPES = { wf: WfNodeCard };

function TicketPicker({ onPick, onClose }: { onPick: (ticketId: string) => void; onClose: () => void }) {
  const ticketsQ = useTickets({ limit: 12, sort: { field: 'createdAt', dir: 'desc', type: 'date' } });
  return (
    <div className="modal-overlay" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" onClick={(e) => e.stopPropagation()} style={{ width: 440, maxHeight: '70vh', overflow: 'auto', padding: 16 }}>
        <h3 style={{ margin: '0 0 4px' }}>Test this workflow</h3>
        <p className="muted" style={{ margin: '0 0 12px', fontSize: 13 }}>Pick a ticket to run the current draft against. Actions are real — use a test ticket.</p>
        {ticketsQ.isLoading && <p className="muted">Loading tickets…</p>}
        {(ticketsQ.data?.rows ?? []).map((t) => (
          <button
            key={t.id}
            className="wf-ticketpick"
            style={{ display: 'flex', gap: 8, width: '100%', textAlign: 'left', font: 'inherit', fontSize: 13, padding: '8px 10px', border: 0, borderRadius: 8, background: 'transparent', cursor: 'pointer' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--neutral-tint, rgba(0,0,0,.05))')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            onClick={() => onPick(t.id)}
          >
            <span className="muted" style={{ flex: 'none' }}>#{t.number}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(t.data?.title ?? '(untitled)')}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function WorkflowEditor({ workflowId, go, addToast }: { workflowId: string; go: Go; addToast: (msg: string, link?: string) => void }) {
  const { data: workflow, isLoading, isError } = useWorkflow(workflowId);
  const save = useSaveWorkflow(workflowId);
  const publish = usePublishWorkflow(workflowId);
  const runNow = useRunWorkflow(workflowId);
  const { data: secrets = [], isSuccess: secretsLoaded } = useSecrets();

  const [graph, setGraph] = useState<WorkflowGraph | null>(null);
  const [name, setName] = useState('');
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState<{ kind: 'node' | 'edge'; id: string } | null>(null);
  const [errors, setErrors] = useState<GraphErrorItem[] | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Drag-resizable config panel width (persisted) — gives the script editor more room.
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    const v = Number(localStorage.getItem('wf-panel-w'));
    return v >= 300 && v <= 760 ? v : 360;
  });
  useEffect(() => {
    localStorage.setItem('wf-panel-w', String(panelWidth));
  }, [panelWidth]);
  const startResize = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = panelWidth;
    e.currentTarget.classList.add('dragging');
    const handle = e.currentTarget;
    const onMove = (ev: PointerEvent) => setPanelWidth(Math.min(760, Math.max(300, startW + (startX - ev.clientX))));
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      handle.classList.remove('dragging');
      document.body.style.userSelect = '';
    };
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [panelWidth]);
  // React Flow measures node DOM and reports it via `dimensions` changes. We rebuild
  // the `nodes` prop from `graph` every render (new objects), so we must carry these
  // measurements back onto them — otherwise RF treats each node as uninitialized,
  // logs error #015, and the node flickers while dragging.
  const [measured, setMeasured] = useState<Record<string, { width: number; height: number }>>({});

  // Adopt server state once per load (and after external invalidation when not dirty).
  // Intentionally NOT keyed on graph/dirty: re-running on those would clobber edits.
  useEffect(() => {
    if (workflow && (!graph || !dirty)) {
      setGraph(workflow.graph);
      setName(workflow.name);
    }
  }, [workflow?.id, workflow?.updatedAt]);

  const mutateGraph = useCallback((fn: (g: WorkflowGraph) => WorkflowGraph) => {
    setGraph((g) => (g ? fn(g) : g));
    setDirty(true);
  }, []);

  const onChangeNode = useCallback(
    (id: string, patch: Partial<WorkflowNode>) =>
      mutateGraph((g) => ({ ...g, nodes: g.nodes.map((n) => (n.id === id ? ({ ...n, ...patch } as WorkflowNode) : n)) })),
    [mutateGraph],
  );
  const onChangeEdge = useCallback(
    (id: string, patch: Partial<WorkflowEdge>) =>
      mutateGraph((g) => ({ ...g, edges: g.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),
    [mutateGraph],
  );
  const onDeleteNode = useCallback(
    (id: string) => {
      mutateGraph((g) => ({
        nodes: g.nodes.filter((n) => n.id !== id),
        edges: g.edges.filter((e) => e.from !== id && e.to !== id),
      }));
      setSelected(null);
    },
    [mutateGraph],
  );
  const onDeleteEdge = useCallback(
    (id: string) => {
      mutateGraph((g) => ({ ...g, edges: g.edges.filter((e) => e.id !== id) }));
      setSelected(null);
    },
    [mutateGraph],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const change of changes) {
        if (change.type === 'dimensions' && change.dimensions) {
          const { id, dimensions } = change;
          setMeasured((m) => (m[id]?.width === dimensions.width && m[id]?.height === dimensions.height ? m : { ...m, [id]: dimensions }));
        } else if (change.type === 'position' && change.position) {
          const { id, position } = change;
          mutateGraph((g) => ({ ...g, nodes: g.nodes.map((n) => (n.id === id ? { ...n, position } : n)) }));
        } else if (change.type === 'remove') {
          onDeleteNode(change.id);
        } else if (change.type === 'select') {
          setSelected(change.selected ? { kind: 'node', id: change.id } : null);
        }
      }
    },
    [mutateGraph, onDeleteNode],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      for (const change of changes) {
        if (change.type === 'remove') onDeleteEdge(change.id);
        else if (change.type === 'select') setSelected(change.selected ? { kind: 'edge', id: change.id } : null);
      }
    },
    [onDeleteEdge],
  );

  const onConnect = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target || conn.source === conn.target) return;
      mutateGraph((g) => {
        if (g.edges.some((e) => e.from === conn.source && e.to === conn.target)) return g;
        return { ...g, edges: [...g.edges, { id: newEdgeId(g), from: conn.source, to: conn.target }] };
      });
    },
    [mutateGraph],
  );

  const addNode = useCallback(
    (type: Exclude<WorkflowNodeType, 'trigger'>) => {
      mutateGraph((g) => {
        const maxX = Math.max(...g.nodes.map((n) => n.position.x), 0);
        const node = createNode(type, g, { x: maxX + 280, y: 160 + (g.nodes.length % 3) * 90 });
        return { ...g, nodes: [...g.nodes, node] };
      });
    },
    [mutateGraph],
  );

  async function onSave(currentGraph: WorkflowGraph): Promise<boolean> {
    try {
      await save.mutateAsync({ name, graph: currentGraph });
      setDirty(false);
      return true;
    } catch (err) {
      addToast((err as ApiError).detail ?? 'Could not save the workflow.');
      return false;
    }
  }

  async function onPublish() {
    if (!graph) return;
    setErrors(null);
    const local = validateWorkflowGraph(graph);
    if (local.length > 0) {
      setErrors(local as WorkflowGraphError[]);
      return;
    }
    // Client-side check: warn if the graph references secrets that don't exist in
    // the org's secret store. Only run when the secrets list has successfully loaded
    // to avoid false positives while the query is still in flight.
    if (secretsLoaded) {
      const knownNames = new Set(secrets.map((s) => s.name));
      const missing = collectSecretRefs(graph).filter((name) => !knownNames.has(name));
      if (missing.length > 0) {
        setErrors(
          missing.map((name) => ({
            message: `Secret "${name}" is not defined. Add it under Settings → Secrets.`,
          })),
        );
        return;
      }
    }
    if (!(await onSave(graph))) return;
    try {
      await publish.mutateAsync();
      addToast('Workflow published.');
    } catch (err) {
      if (err instanceof ApiError && Array.isArray((err as ApiError & { errors?: GraphErrorItem[] }).errors)) {
        setErrors((err as ApiError & { errors?: GraphErrorItem[] }).errors ?? null);
      } else {
        addToast((err as ApiError).detail ?? 'Publish failed.');
      }
    }
  }

  async function onRunTest(ticketId: string) {
    setPickerOpen(false);
    if (!graph) return;
    const local = validateWorkflowGraph(graph);
    if (local.length > 0) {
      setErrors(local as WorkflowGraphError[]);
      return;
    }
    if (dirty && !(await onSave(graph))) return;
    try {
      const run = await runNow.mutateAsync({ ticketId, draft: true });
      addToast('Test run started.', `#/workflows/${workflowId}/runs/${run.id}`);
      go('workflows', { workflowId, view: 'runs', runId: run.id });
    } catch (err) {
      addToast((err as ApiError).detail ?? 'Could not start the test run.');
    }
  }

  const flowNodes = useMemo<FlowNode[]>(
    () => (graph ? toFlowNodes(graph).map((n) => ({ ...n, measured: measured[n.id], selected: selected?.kind === 'node' && selected.id === n.id })) : []),
    [graph, selected, measured],
  );
  const flowEdges = useMemo<FlowEdge[]>(
    () => (graph ? toFlowEdges(graph).map((e) => ({ ...e, selected: selected?.kind === 'edge' && selected.id === e.id })) : []),
    [graph, selected],
  );

  if (isLoading || !graph) return <div className="page"><div className="page-pad"><p className="muted">{isError ? 'Failed to load this workflow.' : 'Loading…'}</p></div></div>;

  return (
    <div className="wf-editor">
      <div className="wf-toolbar">
        <IconButton name="arrowLeft" title="Back to workflows" onClick={() => go('workflows')} />
        <input
          className="wf-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setDirty(true);
          }}
          aria-label="Workflow name"
        />
        {workflow && <WorkflowStatusPill status={workflow.status} />}
        {workflow && workflow.version > 0 && <span className="muted" style={{ fontSize: 12 }}>v{workflow.version}</span>}
        {(dirty || (workflow?.publishedGraph && JSON.stringify(workflow.graph) !== JSON.stringify(workflow.publishedGraph))) && (
          <span className="muted" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span className="wf-dot" /> unpublished changes
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Button variant="outline" icon="history" onClick={() => go('workflows', { workflowId, view: 'runs' })}>Runs</Button>
          <Button variant="outline" icon="play" onClick={() => setPickerOpen(true)} disabled={runNow.isPending}>Test</Button>
          <Button variant="outline" onClick={() => graph && onSave(graph)} disabled={!dirty || save.isPending}>
            {save.isPending ? 'Saving…' : dirty ? 'Save' : 'Saved'}
          </Button>
          <Button variant="primary" icon="check" onClick={onPublish} disabled={publish.isPending}>
            {publish.isPending ? 'Publishing…' : 'Publish'}
          </Button>
        </div>
      </div>

      <div className="wf-body" style={{ '--wf-panel-w': `${panelWidth}px` } as CSSProperties}>
        <div className="wf-canvas">
          <div className="wf-palette">
            <div className="wf-palette-title">Add step</div>
            {PALETTE.map((type) => (
              <button key={type} onClick={() => addNode(type)}>
                <Icon name={NODE_META[type].icon} size={14} style={{ color: NODE_META[type].hue }} />
                {NODE_META[type].label}
              </button>
            ))}
          </div>

          {errors && errors.length > 0 && (
            <div className="wf-errors" role="alert">
              <h4>Fix these before publishing</h4>
              <ul>
                {errors.map((e, i) => (
                  <li key={i}>{e.message}</li>
                ))}
              </ul>
              <button className="wf-addrow" onClick={() => setErrors(null)}>Dismiss</button>
            </div>
          )}

          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onPaneClick={() => setSelected(null)}
            fitView
            fitViewOptions={{ maxZoom: 1, padding: 0.25 }}
            proOptions={{ hideAttribution: true }}
            deleteKeyCode={['Backspace', 'Delete']}
          >
            <Background gap={18} size={1.2} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>

        <div className="wf-resize" onPointerDown={startResize} title="Drag to resize" />

        <NodeConfigPanel
          graph={graph}
          selected={selected}
          onChangeNode={onChangeNode}
          onChangeEdge={onChangeEdge}
          onDeleteNode={onDeleteNode}
          onDeleteEdge={onDeleteEdge}
        />
      </div>

      {pickerOpen && <TicketPicker onPick={onRunTest} onClose={() => setPickerOpen(false)} />}
    </div>
  );
}
