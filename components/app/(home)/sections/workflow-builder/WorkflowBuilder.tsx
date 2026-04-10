"use client";

import { useCallback, useRef, DragEvent, useState, useEffect } from "react";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type OnConnect,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "@/styles/workflow-execution.css";
import { motion } from "framer-motion";
import {
  Bot,
  GitBranch,
  Repeat,
  CheckCircle,
  Braces,
  Search,
  Plug,
  Play,
  StopCircle,
  Zap,
  FileText,
  MoreHorizontal,
  Server,
  MousePointer2,
  Share2,
  Terminal,
  Coins,
  Calendar,
} from "lucide-react";
import NodePanel from "./NodePanel";
import MCPPanel from "./MCPPanel";
import PreviewPanel from "./PreviewPanel";
import ExecutionPanel from "./ExecutionPanel";
import TestEndpointPanel from "./TestEndpointPanel";
import LogicNodePanel from "./LogicNodePanel";
import DataNodePanel from "./DataNodePanel";
import ToolsNodePanel from "./ToolsNodePanel";
import NoteNodePanel from "./NoteNodePanel";
import HTTPNodePanel from "./HTTPNodePanel";
import ExtractNodePanel from "./ExtractNodePanel";
import StartNodePanel from "./StartNodePanel";
import WorkflowNameEditor from "./WorkflowNameEditor";
import SettingsPanel from "./SettingsPanelSimple";
import ConfirmDialog from "./ConfirmDialog";
import EdgeLabelModal from "./EdgeLabelModal";
import ShareWorkflowModal from "./ShareWorkflowModal";
import SaveAsTemplateModal from "./SaveAsTemplateModal";
import { toast } from "sonner";
import { useWorkflow } from "@/hooks/useWorkflow";
import ElizaForgeIcon from "@/components/shared/icons/ElizaForgeIcon";
import { useWorkflowExecution } from "@/hooks/useWorkflowExecution";
// Remove static template import - now loading from Convex
// import { getTemplate } from "@/lib/workflow/templates";
import { getWorkflow } from "@/lib/workflow/storage";
import type { WorkflowNode, WorkflowEdge } from "@/lib/workflow/types";
import { nodeTypes } from "./CustomNodes";
import { detectDuplicateCredentials } from "@/lib/workflow/duplicate-detection";
import { cleanupInvalidEdges } from "@/lib/workflow/edge-cleanup";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

interface WorkflowBuilderProps {
  onBack: () => void;
  initialWorkflowId?: string | null;
  initialTemplateId?: string | null;
}

let nodeId = 2;
const getId = () => `node_${nodeId++}`;

// Helper function to reset node ID counter based on existing nodes
const resetNodeIdCounter = (nodes: Node[]) => {
  const maxId = nodes.reduce((max, node) => {
    const match = node.id.match(/^node_(\d+)$/);
    if (match) {
      const id = parseInt(match[1], 10);
      return Math.max(max, id);
    }
    return max;
  }, 1);
  nodeId = maxId + 1;
  console.log('🔢 Reset node ID counter to:', nodeId);
};

const initialNodes: Node[] = [
  {
    id: 'node_0',
    type: 'start',
    position: { x: 250, y: 250 },
    data: {
      label: (
        <div className="flex items-center gap-8">
          <div className="w-32 h-32 rounded-8 bg-gray-600 flex items-center justify-center flex-shrink-0">
            <Play className="w-18 h-18 text-white" strokeWidth={2} />
          </div>
          <span className="text-sm font-medium text-text-primary">Start</span>
        </div>
      ),
      nodeType: 'start',
      nodeName: 'Start',
    },
  },
];

const initialEdges: Edge[] = [];

const nodeCategories = [
  {
    category: "Personal Assistant",
    nodes: [
      { type: "research", label: "Research", color: "bg-primary-green", icon: Search },
      { type: "summarizer", label: "Summarizer", color: "bg-primary-green", icon: FileText },
      { type: "social-post", label: "Social Post", color: "bg-primary-green", icon: Share2 },
      { type: "custom-prompt", label: "Custom Prompt", color: "bg-primary-green", icon: Terminal },
    ],
  },
  {
    category: "Logic",
    nodes: [
      { type: "if-else", label: "Condition", color: "bg-accent-green", icon: GitBranch },
      { type: "while", label: "While", color: "bg-accent-green", icon: Repeat },
      { type: "user-approval", label: "User approval", color: "bg-muted", icon: CheckCircle },
    ],
  },
  {
    category: "Advanced",
    nodes: [
      { type: "agent", label: "Custom Agent", color: "bg-primary-green", icon: Bot },
      { type: "mcp", label: "MCP Tool", color: "bg-primary-green", icon: Plug },
      { type: "transform", label: "Data Map", color: "bg-primary-green", icon: Braces },
    ],
  },
  {
    category: "Finance (DeFi)",
    nodes: [
      { type: "defi-monitor", label: "DeFi Monitor", color: "bg-primary-green", icon: Coins },
    ],
  },
  {
    category: "Automation",
    nodes: [
      { type: "task-automator", label: "Task Automator", color: "bg-primary-green", icon: Calendar },
    ],
  },
];

// Auto-layout function to position nodes left to right
const autoLayoutNodes = (nodes: Node[], edges: Edge[]) => {
  if (nodes.length === 0) return nodes;

  const LAYER_SPACING = 350; // Horizontal spacing between layers (left to right)
  const NODE_SPACING = 150; // Vertical spacing between nodes in same layer
  const START_X = 100;
  const START_Y = 100;

  // Build adjacency list from edges
  const adjacency: { [key: string]: string[] } = {};
  nodes.forEach(n => (adjacency[n.id] = []));

  // Only add edges where both source and target nodes exist
  edges.forEach(e => {
    if (!adjacency[e.source]) adjacency[e.source] = [];
    // Verify target node exists before adding edge
    if (adjacency[e.target] !== undefined) {
      adjacency[e.source].push(e.target);
    }
  });

  // Calculate node layers using BFS
  const layers: { [key: string]: number } = {};
  const queue: string[] = [];

  // Find start node
  const startNode = nodes.find(n => (n.data as any)?.nodeType === 'start');
  if (startNode) {
    layers[startNode.id] = 0;
    queue.push(startNode.id);
  } else if (nodes.length > 0) {
    layers[nodes[0].id] = 0;
    queue.push(nodes[0].id);
  }

  // BFS to assign layers
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    const currentLayer = layers[nodeId];

    // Safety check: ensure adjacency entry exists and is iterable
    const children = adjacency[nodeId];
    if (children && Array.isArray(children)) {
      for (const childId of children) {
        if (!(childId in layers)) {
          layers[childId] = currentLayer + 1;
          queue.push(childId);
        }
      }
    }
  }

  // Assign unvisited nodes to appropriate layers
  for (const node of nodes) {
    if (!(node.id in layers)) {
      layers[node.id] = Math.max(...Object.values(layers), -1) + 1;
    }
  }

  // Group nodes by layer and calculate positions
  const nodesByLayer: { [key: number]: Node[] } = {};
  for (const node of nodes) {
    const layer = layers[node.id];
    if (!nodesByLayer[layer]) nodesByLayer[layer] = [];
    nodesByLayer[layer].push(node);
  }

  // Position nodes left to right
  const layoutNodes: Node[] = [];
  for (const layer in nodesByLayer) {
    const layerNodes = nodesByLayer[layer];
    const nodesInLayer = layerNodes.length;
    const totalHeight = (nodesInLayer - 1) * NODE_SPACING;
    const startYForLayer = START_Y + (300 - totalHeight / 2); // Center vertically

    layerNodes.forEach((node, index) => {
      layoutNodes.push({
        ...node,
        position: {
          x: START_X + parseInt(layer) * LAYER_SPACING,
          y: startYForLayer + index * NODE_SPACING,
        },
      });
    });
  }

  return layoutNodes;
};

function WorkflowBuilderInner({ onBack, initialWorkflowId, initialTemplateId }: WorkflowBuilderProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [initialized, setInitialized] = useState(false);
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(initialTemplateId ?? null);

  // Convex queries and mutations for templates
  const template = useQuery(api.workflows.getTemplateByCustomId,
    currentTemplateId ? { customId: currentTemplateId } : "skip"
  );
  const updateTemplateStructure = useMutation(api.workflows.updateTemplateStructure);

  // Function to seed templates via API
  const seedTemplates = async () => {
    const response = await fetch('/api/templates/seed', { method: 'POST' });
    const data = await response.json();
    return data;
  };
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showExecution, setShowExecution] = useState(false);
  const [showTestEndpoint, setShowTestEndpoint] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showComingSoonModal, setShowComingSoonModal] = useState(false);
  const [showSaveAsTemplateModal, setShowSaveAsTemplateModal] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    variant?: "danger" | "warning" | "default";
  }>({
    isOpen: false,
    title: "",
    description: "",
    onConfirm: () => {},
  });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [editingEdge, setEditingEdge] = useState<Edge | null>(null);
  const [showMCPSelector, setShowMCPSelector] = useState(false);
  const [targetAgentForMCP, setTargetAgentForMCP] = useState<Node | null>(null);
  const [duplicateWarnings, setDuplicateWarnings] = useState<any[]>([]);
  const [showWorkflowMenu, setShowWorkflowMenu] = useState(false);
  const workflowMenuRef = useRef<HTMLDivElement>(null);
  const [renameTrigger, setRenameTrigger] = useState(0);
  const [environment, setEnvironment] = useState<'draft' | 'production'>('draft');
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, getNode, setCenter } = useReactFlow();

  // Workflow management
  const { workflow, convexId, updateNodes, updateEdges, saveWorkflow, saveWorkflowImmediate, deleteWorkflow, createNewWorkflow } = useWorkflow(initialWorkflowId || undefined);

  // AUTO-SAVE DISABLED - Use manual Save button instead
  // Smart auto-save: only save when nodes/edges actually change, with debounce
  // const lastSavedNodesRef = useRef<string>('');
  // const lastSavedEdgesRef = useRef<string>('');
  // const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // useEffect(() => {
  //   if (!initialized || !workflow) return;

  //   const nodesJson = JSON.stringify(nodes);
  //   const edgesJson = JSON.stringify(edges);

  //   // Only save if something actually changed
  //   if (nodesJson === lastSavedNodesRef.current && edgesJson === lastSavedEdgesRef.current) {
  //     return;
  //   }

  //   // Clear previous timeout
  //   if (autoSaveTimeoutRef.current) {
  //     clearTimeout(autoSaveTimeoutRef.current);
  //   }

  //   // Debounced save
  //   autoSaveTimeoutRef.current = setTimeout(async () => {
  //     console.log('🔄 [AUTO-SYNC] Saving changes to Convex...', {
  //       nodeCount: nodes.length,
  //       edgeCount: edges.length,
  //       isTemplate: workflow.isTemplate,
  //       templateId: currentTemplateId,
  //     });

  //     // Update refs BEFORE saving to prevent loops
  //     lastSavedNodesRef.current = nodesJson;
  //     lastSavedEdgesRef.current = edgesJson;

  //     // If this is a template-based workflow, also save to the template
  //     if (workflow.isTemplate && currentTemplateId) {
  //       try {
  //         await updateTemplateStructure({
  //           customId: currentTemplateId,
  //           nodes: nodes.map(n => ({
  //             ...n,
  //             data: {
  //               ...n.data,
  //               nodeType: n.data?.nodeType || n.type,
  //             }
  //           })),
  //           edges,
  //         });
  //         console.log('✅ Template structure updated in Convex');
  //       } catch (error) {
  //         console.error('Failed to update template structure:', error);
  //       }
  //     }

  //     // Save to workflow (regular save)
  //     saveWorkflow({ nodes, edges });
  //   }, 1500); // 1.5 second debounce

  //   return () => {
  //     if (autoSaveTimeoutRef.current) {
  //       clearTimeout(autoSaveTimeoutRef.current);
  //     }
  //   };
  // }, [nodes, edges, initialized, currentTemplateId, updateTemplateStructure]); // Don't include workflow or saveWorkflow to prevent loops

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (workflowMenuRef.current && !workflowMenuRef.current.contains(event.target as any)) {
        setShowWorkflowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setEnvironment('draft');
    setShowTestEndpoint(false); // Close API panel when switching workflows
  }, [workflow?.id]);

  const handleDuplicateWorkflow = useCallback(() => {
    if (!workflow) return;
    const original = workflow;
    const newWorkflow = createNewWorkflow();
    setShowWorkflowMenu(false);
    // Allow state to update before saving copied structure
    setTimeout(() => {
      saveWorkflow({
        name: `${original.name || 'Workflow'} Copy`,
        description: original.description,
        nodes: original.nodes,
        edges: original.edges,
      });
      toast.success('Workflow duplicated');
    }, 0);
  }, [workflow, createNewWorkflow, saveWorkflow, setShowWorkflowMenu]);

  const handleRenameWorkflow = useCallback(() => {
    setRenameTrigger(prev => prev + 1);
    setShowWorkflowMenu(false);
  }, [setRenameTrigger, setShowWorkflowMenu]);

  const handleSaveWorkflowImmediate = useCallback(() => {
    if (!workflow) {
      console.error('❌ Cannot save: no workflow exists');
      return;
    }

    console.log('💾 [MANUAL SAVE] Saving workflow with', nodes.length, 'nodes and', edges.length, 'edges');

    const updatedWorkflow = {
      ...workflow,
      nodes: nodes.map(n => ({
        ...n,
        type: n.type || 'default',
        data: {
          ...n.data,
          label: typeof n.data.label === 'string' ? n.data.label : 'Node',
          nodeType: n.data.nodeType || n.type, // Ensure nodeType is preserved
        },
      })) as any,
      edges: edges as any,
    };

    saveWorkflow(updatedWorkflow);
    toast.success('Workflow saved', {
      description: `Saved ${nodes.length} nodes to Convex`,
    });
    setShowShareModal(true);
    setShowWorkflowMenu(false);
  }, [workflow, nodes, edges, saveWorkflow, setShowShareModal, setShowWorkflowMenu]);

  const handleClearCanvas = useCallback(() => {
    setConfirmDialog({
      isOpen: true,
      title: 'Clear Canvas',
      description: 'This will remove all nodes and reset to the default workflow. This action cannot be undone.',
      variant: 'warning',
      onConfirm: () => {
        setNodes(initialNodes);
        setEdges(initialEdges);
        setSelectedNode(null);
        // Reset node ID counter to initial state
        resetNodeIdCounter(initialNodes);
        toast.success('Canvas cleared', {
          description: 'Workflow reset to default',
        });
      },
    });
    setShowWorkflowMenu(false);
  }, [setConfirmDialog, setNodes, setEdges, setSelectedNode, setShowWorkflowMenu]);

  const confirmDeleteWorkflow = useCallback(() => {
    if (!workflow) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Workflow',
      description: 'This will permanently delete the current workflow. This action cannot be undone.',
      variant: 'danger',
      onConfirm: () => {
        deleteWorkflow(workflow.id);
        toast.success('Workflow deleted');
      },
    });
    setShowWorkflowMenu(false);
  }, [workflow, deleteWorkflow, setConfirmDialog, setShowWorkflowMenu]);
  const { runWorkflow, stopWorkflow, isRunning, nodeResults, execution, currentNodeId, pendingAuth, resumeWorkflow } = useWorkflowExecution();

  // Load template or workflow on mount
  useEffect(() => {
    if (initialized) return;

    if (initialTemplateId) {
      // Check if template is loading from Convex
      if (template === undefined) {
        // Still loading from Convex
        return;
      }

      // If template is null, it doesn't exist in Convex yet - seed templates
      if (template === null) {
        console.log('Template not found in Convex, seeding templates...');
        seedTemplates()
          .then(() => {
            console.log('Templates seeded successfully');
            // The component will re-render when the template query updates
          })
          .catch(err => {
            console.error('Failed to seed templates:', err);
            toast.error('Failed to load template');
          });
        return;
      }

      if (template) {
        console.log('Loading template from Convex:', template);

        // Clean up any invalid edges in the template
        const cleaned = cleanupInvalidEdges(template.nodes, template.edges);
        const cleanedNodes = cleaned.nodes;
        const cleanedEdges = cleaned.edges;

        if (cleaned.removedCount > 0) {
          console.warn(`🧹 Removed ${cleaned.removedCount} invalid edge(s) from template`);
          toast.warning(`Template had ${cleaned.removedCount} invalid connection(s)`, {
            description: 'These have been automatically removed',
          });
        }

        // Convert template nodes to React Flow format
        const templateNodes = cleanedNodes.map((n: any) => {
          const nodeData = n.data as any;
          return {
            ...n,
            data: {
              ...n.data,
              label: createNodeLabel(nodeData.nodeName || nodeData.label as string, getNodeColor(n.type), n.type),
            },
          };
        });

        console.log('Template nodes with icons:', templateNodes.map(n => ({ id: n.id, label: n.data.label })));

        // Apply auto-layout for even spacing
        const layoutedNodes = autoLayoutNodes(templateNodes as any, cleanedEdges as any);
        setNodes(layoutedNodes as any);
        setEdges(cleanedEdges as any);

        // Reset node ID counter based on loaded nodes to prevent duplicates
        resetNodeIdCounter(layoutedNodes as any);

        // Save template as a new workflow with all node data intact
        // Ensure nodes have proper nodeType for LangGraph compatibility
        const workflowNodes = template.nodes.map((n: any) => ({
          ...n,
          data: {
            ...n.data,
            nodeType: n.data.nodeType || n.type, // Ensure nodeType is set
          }
        }));

        // Generate a unique workflow ID for this template instance
        const workflowId = `workflow_${Date.now()}_${template.id}`;

        saveWorkflow({
          id: workflowId,
          name: template.name,
          description: template.description,
          nodes: workflowNodes,
          edges: template.edges,
        });

        setInitialized(true);
      }
    } else if (initialWorkflowId && workflow && !initialized) {
      // Use workflow data from useWorkflow hook (loaded via API)
      console.log('Loading workflow from hook:', {
        id: workflow.id,
        name: workflow.name,
        nodeCount: workflow.nodes?.length,
        nodes: workflow.nodes?.map((n: any) => ({ id: n.id, type: n.type }))
      });

      // Clean up any invalid edges before rendering
      const cleaned = cleanupInvalidEdges(workflow.nodes, workflow.edges);
      const cleanedNodes = cleaned.nodes;
      const cleanedEdges = cleaned.edges;

      if (cleaned.removedCount > 0) {
        console.warn(`🧹 Removed ${cleaned.removedCount} invalid edge(s) from workflow`);
        toast.warning(`Workflow had ${cleaned.removedCount} invalid connection(s)`, {
          description: 'These have been automatically removed',
        });
      }

      // Convert workflow nodes to React Flow format
      const workflowNodes = cleanedNodes.map(n => {
        const nodeData = n.data as any;
        // Get the label text (not React element)
        const labelText = nodeData.nodeName || nodeData.label || n.type;

        return {
          ...n,
          data: {
            ...n.data,
            // Create the label JSX element
            label: createNodeLabel(labelText, getNodeColor(n.type), n.type),
          },
        };
      });

      // Apply auto-layout for even spacing
      const layoutedNodes = autoLayoutNodes(workflowNodes as any, cleanedEdges as any);
      console.log('Setting nodes to:', layoutedNodes.length, 'nodes');
      setNodes(layoutedNodes as any);
      setEdges(cleanedEdges as any);

      // Reset node ID counter based on loaded nodes to prevent duplicates
      resetNodeIdCounter(layoutedNodes as any);

      setInitialized(true);
    } else if (!initialized && !initialTemplateId && !initialWorkflowId) {
      setInitialized(true);
      // For new workflows, don't select any node by default
      // User can click the start node or drag new nodes to build their workflow
    }
  }, [initialTemplateId, initialWorkflowId, initialized, setNodes, setEdges, saveWorkflow, template, seedTemplates, workflow]);

  const createNodeLabel = (label: string, color: string, nodeType?: string) => {
    // Get icon for this node type
    const nodeCategory = nodeCategories.find(cat =>
      cat.nodes.some(n => n.type === nodeType || n.label === label)
    );
    const nodeConfig = nodeCategory?.nodes.find(n => n.type === nodeType || n.label === label);
    const IconComponent = nodeConfig?.icon;

    // Determine text color based on node type
    const getTextColor = () => {
      if (nodeType === 'note') return 'text-white'; // White text for note nodes (yellow background)
      if (nodeType === 'if-else' || nodeType === 'while' || nodeType === 'user-approval') {
        return 'text-text-primary'; // Light text for dark system nodes
      }
      return 'text-text-primary'; // Default light text
    };

    return (
      <div className="flex items-center gap-8">
        <div className={`w-32 h-32 rounded-8 ${color} flex items-center justify-center flex-shrink-0`}>
          {IconComponent ? (
            <IconComponent className="w-18 h-18 text-white" strokeWidth={2} />
          ) : (
            <div className="w-16 h-16 bg-white rounded-2" />
          )}
        </div>
        <span className={`text-sm font-medium ${getTextColor()}`}>{label}</span>
      </div>
    );
  };

  const getNodeColor = (type: string): string => {
    const colorMap: Record<string, string> = {
      'agent': 'bg-primary-green',
      'mcp': 'bg-primary-green',
      'firecrawl': 'bg-primary-green',
      'if-else': 'bg-accent-green',
      'while': 'bg-accent-green',
      'user-approval': 'bg-muted',
      'transform': 'bg-primary-green',
      'set-state': 'bg-primary-green',
      'file-search': 'bg-primary-green',
      'extract': 'bg-primary-green',
      'note': 'bg-card-bg',
      'end': 'bg-primary-green',
      'start': 'bg-primary-green',
    };
    return colorMap[type] || 'bg-primary-green';
  };

  // Detect duplicate credentials
  useEffect(() => {
    if (workflow) {
      const warnings = detectDuplicateCredentials(workflow);
      setDuplicateWarnings(warnings);

      // Show toast for new warnings
      if (warnings.length > 0 && duplicateWarnings.length === 0) {
        toast.warning(`Found ${warnings.length} duplicate credential${warnings.length > 1 ? 's' : ''}`, {
          description: 'Click the warning icon to view details',
          duration: 5000,
        });
      }
    }
  }, [workflow?.nodes, workflow?.edges]);

  // Sync React Flow state with workflow state (debounced to avoid loops)
  // Skip auto-save for nodes - only save when user explicitly modifies the workflow
  // This prevents infinite loops when node visual states change during execution
  const nodesSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const edgesSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeouts on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (nodesSaveTimeoutRef.current) clearTimeout(nodesSaveTimeoutRef.current);
      if (edgesSaveTimeoutRef.current) clearTimeout(edgesSaveTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    // Clear any pending saves when execution starts
    if (isRunning) {
      if (nodesSaveTimeoutRef.current) clearTimeout(nodesSaveTimeoutRef.current);
      if (edgesSaveTimeoutRef.current) clearTimeout(edgesSaveTimeoutRef.current);
    }
  }, [isRunning]);

  // AUTO-SAVE DISABLED - Use manual Save button instead
  // Only auto-save nodes when NOT running and after a significant delay
  // This prevents saves triggered by execution state changes
  // useEffect(() => {
  //   // Skip auto-save during initialization or execution
  //   // Note: initialTemplateId is cleared after creating the workflow, so don't check it here
  //   if (!initialized || !workflow || nodes.length === 0 || isRunning || currentNodeId) {
  //     console.log('⏭️ Skipping node auto-save:', {
  //       initialized,
  //       hasWorkflow: !!workflow,
  //       nodeCount: nodes.length,
  //       isRunning,
  //       currentNodeId
  //     });
  //     return;
  //   }

  //   // Only auto-save if user has made manual changes (not from template loading)
  //   // Check if all required nodes are present before saving
  //   const hasStartNode = nodes.some(n => n.type === 'start' || n.id === 'start');
  //   if (!hasStartNode) {
  //     console.warn('⚠️ Skipping auto-save: missing start node');
  //     return;
  //   }

  //   console.log('✅ Node auto-save scheduled for', nodes.length, 'nodes');

  //   if (nodesSaveTimeoutRef.current) clearTimeout(nodesSaveTimeoutRef.current);
  //   nodesSaveTimeoutRef.current = setTimeout(() => {
  //     console.log('💾 Executing node auto-save NOW');
  //     updateNodes(nodes.map(n => ({
  //       ...n,
  //       type: n.type || 'default',
  //       data: {
  //         ...n.data,
  //         label: typeof n.data.label === 'string' ? n.data.label : 'Node',
  //         // Preserve nodeType for LangGraph compatibility
  //         nodeType: n.data.nodeType || n.type,
  //       },
  //     })) as any);
  //   }, 2000); // Increased delay to 2 seconds to reduce save frequency
  //   return () => {
  //     if (nodesSaveTimeoutRef.current) clearTimeout(nodesSaveTimeoutRef.current);
  //   };
  // }, [nodes, workflow, isRunning, currentNodeId, updateNodes, initialized, initialTemplateId]);

  // useEffect(() => {
  //   // Skip auto-save during initialization or execution
  //   if (!initialized || !workflow || edges.length === 0 || isRunning || currentNodeId) {
  //     return;
  //   }

  //   if (edgesSaveTimeoutRef.current) clearTimeout(edgesSaveTimeoutRef.current);
  //   edgesSaveTimeoutRef.current = setTimeout(() => {
  //     updateEdges(edges as any);
  //   }, 2000); // Increased delay to 2 seconds to reduce save frequency
  //   return () => {
  //     if (edgesSaveTimeoutRef.current) clearTimeout(edgesSaveTimeoutRef.current);
  //   };
  // }, [edges, workflow, isRunning, currentNodeId, updateEdges, initialized, initialTemplateId]);

  // Update node visual states during execution and add IO badges
  useEffect(() => {
    console.log('🎨 Visual update triggered - currentNodeId:', currentNodeId, 'nodeResults:', Object.keys(nodeResults));

    setNodes((nds) =>
      nds.map((node) => {
        const isCurrentlyRunning = currentNodeId === node.id;
        const result = nodeResults[node.id];

        // Explicitly clear executing class from nodes that are no longer running
        const wasExecuting = (node.data as any)?.isRunning === true;
        const stoppedExecuting = wasExecuting && !isCurrentlyRunning;

        const nextClassName = isCurrentlyRunning
          ? 'executing-node'
          : result?.status === 'completed'
          ? 'completed-node'
          : result?.status === 'failed'
          ? 'failed-node'
          : '';

        const currentClassName = node.className || '';
        const isRunningChanged = (node.data as any)?.isRunning !== isCurrentlyRunning;
        const statusChanged = (node.data as any)?.executionStatus !== result?.status;
        const classChanged = currentClassName !== nextClassName;

        if (isRunningChanged || statusChanged || classChanged) {
          console.log(`🎨 Updating node ${node.id}:`, {
            isCurrentlyRunning,
            resultStatus: result?.status,
            nextClassName,
            currentClassName,
            stoppedExecuting,
          });
        }

        if (!isRunningChanged && !statusChanged && !classChanged) {
          return node;
        }

        return {
          ...node,
          // Force clear className if stopped executing to immediately stop animation
          className: stoppedExecuting ? '' : nextClassName,
          data: {
            ...node.data,
            isRunning: isCurrentlyRunning,
            executionStatus: result?.status,
            label: node.data.label as any,
            // Add timestamp to force re-render when execution state changes
            _executionUpdate: stoppedExecuting ? Date.now() : (node.data as any)?._executionUpdate,
          },
        };
      })
    );

    // Highlight active and selected edges
    setEdges((eds) =>
      eds.map((edge) => {
        const sourceCompleted = nodeResults[edge.source]?.status === 'completed';
        const targetRunning = currentNodeId === edge.target;
        const isActive = sourceCompleted && targetRunning;
        const isSelected = edge.id === selectedEdgeId;

        const nextClassName = isActive ? 'active-edge' : isSelected ? 'selected-edge' : '';
        const currentClassName = edge.className || '';
        const nextStroke = isActive ? '#22C55E' : isSelected ? '#22C55E' : '#334155';
        const nextWidth = isActive ? 2 : isSelected ? 2 : 1;

        const classChanged = currentClassName !== nextClassName;
        const strokeChanged = edge.style?.stroke !== nextStroke;
        const widthChanged = edge.style?.strokeWidth !== nextWidth;
        const animatedChanged = !!edge.animated !== isActive;

        if (!classChanged && !strokeChanged && !widthChanged && !animatedChanged) {
          return edge;
        }

        return {
          ...edge,
          className: nextClassName,
          style: {
            ...edge.style,
            stroke: nextStroke,
            strokeWidth: nextWidth,
          },
          animated: isActive,
        };
      })
    );
  }, [currentNodeId, nodeResults, selectedEdgeId, setNodes, setEdges]);

  // Auto-track executing node
  useEffect(() => {
    if (currentNodeId && isRunning) {
      const node = getNode(currentNodeId);
      if (node) {
        setCenter(node.position.x + 100, node.position.y + 50, {
          zoom: 1,
          duration: 400
        });
      }
    }
  }, [currentNodeId, isRunning, getNode, setCenter]);

  const onConnect: OnConnect = useCallback(
    (connection) => {
      console.log('🔗 Creating edge connection:', {
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
      });

      // Directly connect nodes without showing mapping modal
      setEdges((eds) => addEdge(connection, eds));
    },
    [setEdges],
  );


  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      const label = event.dataTransfer.getData('application/reactflow-label');
      const color = event.dataTransfer.getData('application/reactflow-color');

      if (!type) {
        return;
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Get the icon component for this node type
      const nodeCategory = nodeCategories.find(cat =>
        cat.nodes.some(n => n.type === type)
      );
      const nodeConfig = nodeCategory?.nodes.find(n => n.type === type);
      const IconComponent = nodeConfig?.icon;

      const newNode: Node = {
        id: getId(),
        type: type === 'firecrawl' ? 'mcp' : type,
        position,
        data: {
          label: (
            <div className="flex items-center gap-8">
              <div className={`w-32 h-32 rounded-8 ${color} flex items-center justify-center flex-shrink-0`}>
                {IconComponent ? (
                  <IconComponent className="w-18 h-18 text-white" strokeWidth={2} />
                ) : (
                  <div className="w-16 h-16 bg-white rounded-2" />
                )}
              </div>
              <span className="text-sm font-medium text-text-primary">{label}</span>
            </div>
          ),
          nodeType: type === 'firecrawl' ? 'mcp' : type,
          nodeName: label,
          // Pre-configure Firecrawl MCP if this is a Firecrawl node
          ...(type === 'firecrawl' && {
            mcpServers: [
              {
                id: 'firecrawl',
                name: 'Firecrawl',
                label: 'firecrawl',
                url: 'https://mcp.firecrawl.dev/{FIRECRAWL_API_KEY}/v2/mcp',
                authType: 'Access token / API key',
              },
            ],
          }),
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition, setNodes],
  );

  const onDragStart = (event: DragEvent, nodeType: string, nodeLabel: string, nodeColor: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('application/reactflow-label', nodeLabel);
    event.dataTransfer.setData('application/reactflow-color', nodeColor);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleDeleteNode = useCallback((nodeId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "Delete Node",
      description: "Are you sure you want to delete this node? This will also remove all connected edges.",
      variant: "danger",
      onConfirm: () => {
        setNodes(nds => nds.filter(n => n.id !== nodeId));
        setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId));
        setSelectedNode(null);
        toast.success('Node deleted');
      },
    });
  }, [setNodes, setEdges]);

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    // Check if it's a file-search node - show coming soon modal
    if ((node.data as any)?.nodeType === 'file-search') {
      setShowComingSoonModal(true);
      return;
    }

    // Close all other panels when clicking a node
    setShowExecution(false);
    setShowTestEndpoint(false);
    setShowPreview(false);
    setSelectedEdgeId(null);
    // Set the selected node
    setSelectedNode(node);
  }, []);

  const onEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    setSelectedEdgeId(edge.id);
    setSelectedNode(null); // Deselect node when clicking edge
    toast.info('Connection selected - Click Delete or use the toolbar below', {
      duration: 2000,
    });
  }, []);

  const onEdgeDoubleClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    setEditingEdge(edge);
  }, []);

  const onPaneClick = useCallback(() => {
    // Deselect edge when clicking canvas background
    if (selectedEdgeId) {
      setSelectedEdgeId(null);
    }
  }, [selectedEdgeId]);

  const handleSaveEdgeLabel = useCallback((edgeId: string, label: string) => {
    setEdges((eds) =>
      eds.map((edge) =>
        edge.id === edgeId
          ? {
              ...edge,
              label,
              labelBgStyle: { fill: 'var(--card-bg)', fillOpacity: 1 },
              labelStyle: { fill: '#E2E8F0', fontWeight: 600, fontSize: 12 }
            }
          : edge
      )
    );
    toast.success('Connection label updated');
  }, [setEdges]);

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      nodeId: node.id,
    });
  }, []);

  const handleContextMenuDelete = useCallback(() => {
    if (contextMenu) {
      const nodeId = contextMenu.nodeId;
      setContextMenu(null);
      handleDeleteNode(nodeId);
    }
  }, [contextMenu, handleDeleteNode]);

  const handleContextMenuDuplicate = useCallback(() => {
    if (contextMenu) {
      const nodeToDuplicate = nodes.find(n => n.id === contextMenu.nodeId);
      if (nodeToDuplicate) {
        const newNode = {
          ...nodeToDuplicate,
          id: getId(),
          position: {
            x: nodeToDuplicate.position.x + 300,
            y: nodeToDuplicate.position.y,
          },
        };
        setNodes((nds) => nds.concat(newNode));
      }
      setContextMenu(null);
    }
  }, [contextMenu, nodes, setNodes]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  // Handler for opening execution panel
  const handlePreview = useCallback(() => {
    console.log('▶️ Run button clicked - opening ExecutionPanel');
    setShowPreview(false);
    setShowTestEndpoint(false);
    setSelectedNode(null); // Close node panel
    setShowExecution(true);
  }, []);

  // Handler for auto-arranging nodes
  const handleAutoArrange = useCallback(() => {
    console.log('📐 Auto-arranging nodes');
    const layoutedNodes = autoLayoutNodes(nodes, edges);
    setNodes(layoutedNodes as any);
    toast.success('Nodes arranged', {
      description: 'Nodes have been automatically spaced evenly',
    });
  }, [nodes, edges, setNodes]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // Delete selected nodes
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNode && selectedNode.data?.nodeType !== 'start' && !isTyping) {
        e.preventDefault();
        handleDeleteNode(selectedNode.id);
      }

      // Delete selected edges
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedEdgeId && !selectedNode && !isTyping) {
        e.preventDefault();
        setEdges(eds => eds.filter(e => e.id !== selectedEdgeId));
        setSelectedEdgeId(null);
        toast.success('Connection deleted');
      }

      // Copy node (Ctrl/Cmd + C)
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedNode && !isTyping) {
        e.preventDefault();
        // Store in clipboard-like state
        localStorage.setItem('copiedNode', JSON.stringify(
          nodes.find(n => n.id === selectedNode.id)
        ));
      }

      // Paste node (Ctrl/Cmd + V)
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !isTyping) {
        e.preventDefault();
        const copiedNodeStr = localStorage.getItem('copiedNode');
        if (copiedNodeStr) {
          try {
            const copiedNode = JSON.parse(copiedNodeStr);
            const newNode = {
              ...copiedNode,
              id: getId(),
              position: {
                x: copiedNode.position.x + 200,
                y: copiedNode.position.y,
              },
            };
            setNodes((nds) => nds.concat(newNode));
          } catch (e) {
            console.error('Failed to paste node:', e);
          }
        }
      }

      // Duplicate (Ctrl/Cmd + D)
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selectedNode && !isTyping) {
        e.preventDefault();
        const nodeToDuplicate = nodes.find(n => n.id === selectedNode.id);
        if (nodeToDuplicate) {
          const newNode = {
            ...nodeToDuplicate,
            id: getId(),
            position: {
              x: nodeToDuplicate.position.x + 200,
              y: nodeToDuplicate.position.y,
            },
          };
          setNodes((nds) => nds.concat(newNode));
        }
      }

      // Run workflow (Cmd + Enter)
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !isTyping) {
        e.preventDefault();
        if (!isRunning) {
          handlePreview();
        }
      }

      // Auto-arrange nodes (Cmd/Ctrl + Shift + A)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A' && !isTyping) {
        e.preventDefault();
        handleAutoArrange();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedNode, selectedEdgeId, nodes, edges, handleDeleteNode, setNodes, setEdges, isRunning, handleAutoArrange]);

  const handleRunWithInput = useCallback(async (input: string) => {
    console.log('📍 handleRunWithInput called with input:', input);

    if (!workflow) {
      console.error('❌ No workflow to run');
      return;
    }

    console.log('✅ Workflow exists:', workflow.name);

    // Save the workflow before running to ensure it exists in Convex
    console.log('💾 Saving workflow before execution...');
    toast.info('Saving workflow...', { duration: 1000 });

    const saveSuccess = await saveWorkflowImmediate({
      nodes: nodes.map(n => ({
        ...n,
        type: n.type || 'default',
        data: {
          ...n.data,
          label: typeof n.data.label === 'string' ? n.data.label : 'Node',
          nodeType: n.data.nodeType || n.type,
        },
      })) as any,
      edges: edges as any,
    });

    if (!saveSuccess) {
      toast.error('Failed to save workflow', {
        description: 'Cannot run workflow until it is saved',
      });
      return;
    }

    // Create a fresh workflow object with current nodes/edges
    const currentWorkflow = {
      ...workflow,
      nodes: nodes.map(n => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data,
      })) as any,
      edges: edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        label: e.label,
      })) as any,
    };

    console.log('🏃 Running workflow with', currentWorkflow.nodes.length, 'nodes');
    await runWorkflow(currentWorkflow, input);
  }, [workflow, nodes, edges, runWorkflow, saveWorkflowImmediate]);



  const handleShowTestAPI = useCallback(() => {
    // Save workflow before opening API panel
    if (workflow) {
      saveWorkflow({
        nodes: nodes.map(n => ({
          ...n,
          type: n.type || 'default',
          data: {
            ...n.data,
            label: typeof n.data.label === 'string' ? n.data.label : 'Node',
          },
        })) as any,
        edges: edges as any,
      });
    }
    setShowPreview(false);
    setShowExecution(false);
    setSelectedNode(null); // Close node panel
    setShowTestEndpoint(true);
  }, [workflow, nodes, edges, saveWorkflow]);

  const handleSaveWorkflow = useCallback(() => {
    if (!workflow) {
      toast.error('No workflow to save');
      return;
    }

    // Serialize nodes by removing React elements (labels) and keeping only data
    const serializedNodes = nodes.map(n => ({
      ...n,
      data: {
        ...n.data,
        // Don't save the React element label - save the text/name instead
        label: n.data.nodeName || n.type, // Save simple text, not JSX
        nodeType: n.data.nodeType || n.type, // Ensure nodeType is saved
      },
    }));

    console.log('💾 Saving', serializedNodes.length, 'serialized nodes');

    // Force immediate save with all current data
    saveWorkflow({
      nodes: serializedNodes as unknown as WorkflowNode[],
      edges: edges as unknown as WorkflowEdge[],
      name: workflow.name,
      description: workflow.description,
    });

    toast.success('Workflow saved', {
      description: `${nodes.length} nodes, ${edges.length} connections saved to Convex`,
    });
  }, [workflow, nodes, edges, saveWorkflow]);

  const handleUpdateNodeData = useCallback((nodeId: string, data: any) => {
    try {
      setNodes((nds) => {
        const updated = nds.map((node) => {
          if (node.id === nodeId) {
            const updatedData = {
              ...node.data,
              ...data,
            };

            // If name is being updated, also update the label
            if (data.name && data.name !== (node.data as any).nodeName) {
              const nodeType = (node.data as any).nodeType;

              // Find the node configuration to get the icon and color
              let IconComponent: any = null;
              let color = "bg-gray-500";

              for (const category of nodeCategories) {
                const nodeConfig = category.nodes.find(n => n.type === nodeType);
                if (nodeConfig) {
                  IconComponent = nodeConfig.icon;
                  color = nodeConfig.color;
                  break;
                }
              }

              // Create the new label with the updated name
              updatedData.label = (
                <div className="flex items-center gap-8">
                  <div className={`w-32 h-32 rounded-8 ${color} flex items-center justify-center flex-shrink-0`}>
                    {IconComponent ? (
                      <IconComponent className="w-18 h-18 text-white" strokeWidth={2} />
                    ) : (
                      <div className="w-16 h-16 bg-white rounded-2" />
                    )}
                  </div>
                  <span className="text-sm font-medium text-text-primary">{data.name}</span>
                </div>
              );
            }

            return {
              ...node,
              data: updatedData,
            };
          }
          return node;
        });

        // Immediately persist to Convex after updating React state
        if (workflow) {
          updateNodes(updated as any);
        }

        return updated;
      });
    } catch (error) {
      console.error('Error updating node data:', error);
      toast.error('Failed to update node', {
        description: error instanceof Error ? error.message : 'Unable to save node changes',
      });
    }
  }, [setNodes, workflow, updateNodes]);

  // Inject onUpdate callback into note nodes for inline editing
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        const nodeType = (node.data as any)?.nodeType;
        if (nodeType === 'note' && !(node.data as any).onUpdate) {
          return {
            ...node,
            data: {
              ...node.data,
              onUpdate: (updates: any) => handleUpdateNodeData(node.id, updates),
            },
          };
        }
        return node;
      })
    );
  }, [nodes.length]); // Only re-run when node count changes

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 bg-main-bg flex flex-col"
    >
      {/* Top Command Bar */}
      <div className="h-48 border-b border-border-system bg-card-bg flex items-center justify-between px-16 z-[110]">
        <div className="flex items-center gap-12">
          <div className="flex items-center gap-8 pr-12 border-r border-border-system">
            <ElizaForgeIcon style={{ width: 20, height: 20 }} fill="#22C55E" />
            <span className="text-label-large text-accent-green font-bold tracking-tight">ElizaForge</span>
          </div>
          
          <div className="flex items-center gap-4">
            <WorkflowNameEditor
              workflow={workflow}
              onUpdate={saveWorkflow}
              renameTrigger={renameTrigger}
              className="text-label-medium font-bold text-text-primary bg-transparent border-none outline-none focus:outline-none hover:bg-white/5 px-2 -ml-2 rounded-4 transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center gap-8">
          {/* Status Indicator */}
          <div className="flex items-center gap-8 px-12 py-4 bg-white/5 rounded-6 border border-border-system">
            <div className={`w-8 h-8 rounded-full ${isRunning ? 'bg-accent-green animate-pulse' : 'bg-text-muted'}`} />
            <span className="text-label-small text-text-secondary uppercase tracking-wider">
              {isRunning ? 'System Active' : 'Standby'}
            </span>
          </div>

          <div className="h-24 w-1 bg-border-system mx-4" />

          {/* Action Buttons */}
          <button
            onClick={() => isRunning ? stopWorkflow() : handlePreview()}
            className={`flex items-center gap-8 px-16 py-6 rounded-6 text-label-medium transition-all ${
              isRunning 
                ? 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20' 
                : 'bg-primary-green text-white hover:bg-hover-green active:scale-95 shadow-[0_0_12px_rgba(34,197,94,0.3)]'
            }`}
          >
            {isRunning ? <StopCircle className="w-14 h-14" /> : <Play className="w-14 h-14" />}
            {isRunning ? 'Stop Execution' : 'Run Workflow'}
          </button>

          <button
            onClick={handleSaveWorkflowImmediate}
            className="flex items-center gap-8 px-16 py-6 rounded-6 bg-white/5 text-text-primary border border-border-system hover:bg-white/10 active:scale-95 transition-all text-label-medium"
          >
            <Zap className="w-14 h-14" />
            Save Changes
          </button>

          <button
            onClick={() => setShowSaveAsTemplateModal(true)}
            className="flex items-center gap-8 px-16 py-6 rounded-6 bg-white/5 text-text-primary border border-border-system hover:bg-white/10 active:scale-95 transition-all text-label-medium"
          >
            <FileText className="w-14 h-14" />
            Templates
          </button>

          <div className="relative group" ref={workflowMenuRef}>
            <button
              onClick={() => setShowWorkflowMenu(prev => !prev)}
              className="w-32 h-32 flex items-center justify-center rounded-6 bg-white/5 border border-border-system text-text-secondary hover:text-text-primary hover:bg-white/10 transition-all"
            >
              <MoreHorizontal className="w-16 h-16" />
            </button>
            {showWorkflowMenu && (
              <div className="absolute right-0 mt-8 w-220 bg-card-bg border border-border-system rounded-12 shadow-2xl z-[120] overflow-hidden py-4 animate-in fade-in slide-in-from-top-2">
                <button
                  onClick={handleDuplicateWorkflow}
                  className="w-full px-12 py-8 text-left text-label-medium text-text-secondary hover:text-text-primary hover:bg-white/5 flex items-center gap-8"
                >
                  <Share2 className="w-14 h-14" /> Duplicate Workflow
                </button>
                <button
                  onClick={() => {
                    setShowSaveAsTemplateModal(true);
                    setShowWorkflowMenu(false);
                  }}
                  className="w-full px-12 py-8 text-left text-label-medium text-text-secondary hover:text-text-primary hover:bg-white/5 flex items-center gap-8"
                >
                  <FileText className="w-14 h-14" /> Create Template
                </button>
                <div className="h-1 bg-border-system my-4" />
                <button
                  onClick={handleClearCanvas}
                  className="w-full px-12 py-8 text-left text-label-medium text-text-secondary hover:text-text-primary hover:bg-white/5 flex items-center gap-8"
                >
                  <Repeat className="w-14 h-14" /> Clear Canvas
                </button>
                <button
                  onClick={confirmDeleteWorkflow}
                  className="w-full px-12 py-8 text-left text-label-medium text-red-500 hover:bg-red-500/10 flex items-center gap-8"
                >
                  <StopCircle className="w-14 h-14" /> Delete System
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <motion.aside
          initial={{ x: -200, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-200 m-12 rounded-12 border border-border-system bg-card-bg p-12 shadow-2xl flex-shrink-0 z-10 self-start max-h-[calc(100vh-80px)] overflow-y-auto"
        >
          <div className="mb-16">
            <button
              onClick={onBack}
              className="text-label-small text-text-secondary hover:text-primary-green transition-colors flex items-center gap-8"
            >
              <svg className="w-14 h-14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Hub
            </button>
          </div>

          <div className="space-y-12">
            {nodeCategories.map((category) => (
              <div key={category.category}>
                <h3 className="text-label-x-small font-bold text-text-muted uppercase tracking-[0.1em] mb-8">
                  {category.category}
                </h3>
                <div className="space-y-2">
                  {category.nodes.map((node) => {
                    const Icon = node.icon;
                    return (
                      <motion.div
                        key={node.type}
                        draggable
                        onDragStart={(e) => onDragStart(e as any, node.type, node.label, node.color)}
                        className="rounded-8 px-8 py-6 hover:bg-white/5 border border-transparent hover:border-border-system transition-all cursor-move flex items-center gap-8 group"
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className={`w-28 h-28 rounded-6 ${node.color} flex items-center justify-center flex-shrink-0 shadow-sm transition-transform group-hover:scale-110`}>
                          <Icon className="w-14 h-14 text-white" strokeWidth={2} />
                        </div>
                        <span className="text-label-small text-text-secondary group-hover:text-text-primary transition-colors">{node.label}</span>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </motion.aside>

        {/* Main Canvas Container */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex-1 relative overflow-hidden"
          ref={reactFlowWrapper}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            onNodeContextMenu={onNodeContextMenu}
            onEdgeClick={onEdgeClick}
            onEdgeDoubleClick={onEdgeDoubleClick}
            onPaneClick={onPaneClick}
            defaultEdgeOptions={{
              type: 'smoothstep',
              style: { strokeWidth: 2, cursor: 'pointer', stroke: '#1E293B' },
              interactionWidth: 20,
            }}
            colorMode="dark"
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background 
              variant="dots" 
              gap={24} 
              size={1} 
              color="rgba(34, 197, 94, 0.08)" 
              style={{ backgroundColor: '#020617' }} 
            />
            <Controls className="!bg-card-bg !border-border-system !text-text-primary !shadow-2xl" />
            <MiniMap 
              className="!bg-card-bg !border-border-system !shadow-2xl" 
              nodeColor={(node) => (node.data as any)?.color || '#166534'}
              maskColor="rgba(2, 6, 23, 0.7)"
            />
          </ReactFlow>
        </motion.div>

        {/* Right Side Panels */}
        {showTestEndpoint && workflow ? (
          <TestEndpointPanel
            key={workflow.id}
            workflowId={workflow.id}
            workflow={{
              ...workflow,
              nodes: nodes.map(n => ({
                id: n.id,
                type: n.type,
                position: n.position,
                data: n.data,
              })) as any,
            }}
            environment={environment}
            onClose={() => setShowTestEndpoint(false)}
          />
        ) : showExecution ? (
          <ExecutionPanel
            workflow={workflow ? {
              ...workflow,
              nodes: nodes.map(n => ({
                id: n.id,
                type: n.type,
                position: n.position,
                data: n.data,
              })) as any,
            } : null}
            execution={execution}
            nodeResults={nodeResults}
            isRunning={isRunning}
            currentNodeId={currentNodeId}
            onRun={handleRunWithInput}
            onResumePendingAuth={resumeWorkflow}
            onClose={() => setShowExecution(false)}
            environment={environment}
            pendingAuth={pendingAuth}
          />
        ) : showPreview ? (
          <PreviewPanel
            execution={execution}
            nodeResults={nodeResults}
            isRunning={isRunning}
            onClose={() => setShowPreview(false)}
          />
        ) : (selectedNode?.data as any)?.nodeType === 'mcp' ? (
          <MCPPanel
            node={selectedNode}
            mode="configure"
            onClose={() => setSelectedNode(null)}
            onUpdate={handleUpdateNodeData}
          />
        ) : (selectedNode?.data as any)?.nodeType?.includes('if') || (selectedNode?.data as any)?.nodeType?.includes('while') || (selectedNode?.data as any)?.nodeType?.includes('approval') ? (
          <LogicNodePanel
            node={selectedNode}
            nodes={nodes}
            onClose={() => setSelectedNode(null)}
            onDelete={handleDeleteNode}
            onUpdate={handleUpdateNodeData}
          />
        ) : (selectedNode?.data as any)?.nodeType?.includes('transform') ? (
          <DataNodePanel
            node={selectedNode}
            nodes={nodes}
            onClose={() => setSelectedNode(null)}
            onDelete={handleDeleteNode}
            onUpdate={handleUpdateNodeData}
          />
        ) : (selectedNode?.data as any)?.nodeType === 'extract' ? (
          <ExtractNodePanel
            node={selectedNode}
            nodes={nodes}
            onClose={() => setSelectedNode(null)}
            onDelete={handleDeleteNode}
            onUpdate={handleUpdateNodeData}
          />
        ) : (selectedNode?.data as any)?.nodeType === 'http' ? (
          <HTTPNodePanel
            node={selectedNode}
            nodes={nodes}
            onClose={() => setSelectedNode(null)}
            onDelete={handleDeleteNode}
            onUpdate={handleUpdateNodeData}
          />
        ) : (selectedNode?.data as any)?.nodeType?.includes('set-state') ? (
          <DataNodePanel
            node={selectedNode}
            nodes={nodes}
            onClose={() => setSelectedNode(null)}
            onDelete={handleDeleteNode}
            onUpdate={handleUpdateNodeData}
          />
        ) : (selectedNode?.data as any)?.nodeType === 'start' ? (
          <StartNodePanel
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
            onUpdate={handleUpdateNodeData}
          />
        ) : (selectedNode?.data as any)?.nodeType !== 'end' && (selectedNode?.data as any)?.nodeType !== 'note' && selectedNode ? (
          <NodePanel
            nodeData={{
              id: selectedNode.id,
              label: (selectedNode.data as any).nodeName || 'Agent',
              type: (selectedNode.data as any).nodeType || 'agent',
            }}
            nodes={nodes}
            onClose={() => setSelectedNode(null)}
            onAddMCP={() => {
              setTargetAgentForMCP(selectedNode);
              setShowMCPSelector(true);
            }}
            onDelete={handleDeleteNode}
            onUpdate={handleUpdateNodeData}
            onOpenSettings={() => setShowSettings(true)}
          />
        ) : null}

        {/* MCP Selector for adding to agents */}
        {showMCPSelector && (
          <MCPPanel
            node={null}
            mode="add-to-agent"
            onClose={() => {
              setShowMCPSelector(false);
              setTargetAgentForMCP(null);
            }}
            onUpdate={() => {}}
            onAddToAgent={(mcpConfig) => {
              if (targetAgentForMCP) {
                const currentTools = (targetAgentForMCP.data as any).mcpTools || [];
                handleUpdateNodeData(targetAgentForMCP.id, {
                  mcpTools: [...currentTools, mcpConfig],
                });
                toast.success('MCP added to agent', {
                  description: `${mcpConfig.availableTools.length} tools available`,
                });
              }
              setShowMCPSelector(false);
              setTargetAgentForMCP(null);
            }}
          />
        )}
      </div>

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {/* Share Workflow Modal */}
      <ShareWorkflowModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        workflowId={workflow?.id || ''}
        workflowName={workflow?.name || 'Workflow'}
      />

      {/* Save as Template Modal */}
      <SaveAsTemplateModal
        isOpen={showSaveAsTemplateModal}
        onClose={() => setShowSaveAsTemplateModal(false)}
        workflowId={convexId || ''}
        workflowName={workflow?.name || 'Workflow'}
      />


      {/* Coming Soon Modal */}
      {showComingSoonModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center"
          onClick={() => setShowComingSoonModal(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card-bg rounded-16 shadow-2xl w-[480px] overflow-hidden border border-border-system"
          >
            <div className="p-24 border-b border-border-system">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-text-primary">
                  Coming Soon
                </h3>
                <button
                  onClick={() => setShowComingSoonModal(false)}
                  className="w-32 h-32 rounded-6 hover:bg-white/5 transition-colors flex items-center justify-center"
                >
                  <svg className="w-18 h-18 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-24">
              <div className="flex items-center gap-16 mb-16">
                <div className="w-48 h-48 rounded-12 bg-primary-green/10 flex items-center justify-center flex-shrink-0">
                  <Search className="w-24 h-24 text-primary-green" />
                </div>
                <div>
                  <h4 className="text-lg font-medium text-text-primary mb-4">
                    File Search Node
                  </h4>
                  <p className="text-sm text-text-secondary">
                    This feature is currently in development
                  </p>
                </div>
              </div>

              <p className="text-body-medium text-text-secondary mb-20">
                The File Search node will allow you to search through files and code in your workflows. Stay tuned for updates!
              </p>

              <button
                onClick={() => setShowComingSoonModal(false)}
                className="w-full px-20 py-12 bg-primary-green hover:bg-hover-green text-white rounded-10 text-sm font-medium transition-colors"
              >
                Got it
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        description={confirmDialog.description}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
      />


      {/* Edge Label Modal */}
      <EdgeLabelModal
        edge={editingEdge}
        isOpen={!!editingEdge}
        onClose={() => setEditingEdge(null)}
        onSave={handleSaveEdgeLabel}
      />

      {/* Selected Edge Actions */}
      {selectedEdgeId && !selectedNode && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="fixed bottom-80 left-1/2 -translate-x-1/2 z-50 flex items-center gap-8 px-16 py-12 bg-card-bg border border-border-system rounded-12 shadow-2xl"
        >
          <div className="flex items-center gap-8 pr-12 border-r border-border-system">
            <svg className="w-16 h-16 text-primary-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="text-body-small text-text-primary font-medium">Connection Selected</span>
          </div>
          <button
            onClick={() => {
              const edge = edges.find(e => e.id === selectedEdgeId);
              if (edge) setEditingEdge(edge);
            }}
            className="px-12 py-6 bg-background-base hover:bg-card-bg border border-border-system rounded-10 text-label-medium text-text-primary focus:outline-none focus:border-primary-green transition-colors flex items-center gap-6"
          >
            <svg className="w-14 h-14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            Edit Label
          </button>
          <button
            onClick={() => {
              setEdges(eds => eds.filter(e => e.id !== selectedEdgeId));
              setSelectedEdgeId(null);
              toast.success('Connection deleted');
            }}
            className="px-12 py-6 bg-red-50 hover:bg-red-100 border border-red-200 rounded-6 text-body-small text-red-700 transition-colors flex items-center gap-6"
          >
            <svg className="w-14 h-14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
          <div className="pl-12 border-l border-border-faint">
            <button
              onClick={() => setSelectedEdgeId(null)}
              className="w-24 h-24 rounded-4 hover:bg-white/5 transition-colors flex items-center justify-center"
            >
              <svg className="w-12 h-12 text-primary-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </motion.div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 1000,
          }}
          className="bg-card-bg border border-border-system rounded-8 shadow-2xl overflow-hidden min-w-160 z-[1000]"
        >
          <button
            onClick={handleContextMenuDuplicate}
            className="w-full px-12 py-8 text-left text-label-small text-text-primary hover:bg-white/5 transition-colors flex items-center gap-8"
          >
            <svg className="w-14 h-14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Duplicate
          </button>
          <button
            onClick={handleContextMenuDelete}
            className="w-full px-16 py-10 text-left text-body-small text-red-600 hover:bg-red-50 transition-colors flex items-center gap-8"
          >
            <svg className="w-14 h-14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        </div>
      )}
    </motion.div>
  );
}

export default function WorkflowBuilder(props: WorkflowBuilderProps) {
  return (
    <ErrorBoundary>
      <ReactFlowProvider>
        <WorkflowBuilderInner {...props} />
      </ReactFlowProvider>
    </ErrorBoundary>
  );
}

