"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import { Workflow, WorkflowExecution, NodeExecutionResult, WorkflowPendingAuth } from "@/lib/workflow/types";
import { toast } from "sonner";
import {
  Bot,
  GitBranch,
  Repeat,
  CheckCircle,
  Braces,
  Search,
  Shield,
  Plug,
  Play,
  StopCircle,
  Zap,
  FileText,
} from "lucide-react";
import Button from "@/components/shared/button/Button";

interface ExecutionPanelProps {
  workflow: Workflow | null;
  execution: WorkflowExecution | null;
  nodeResults: Record<string, NodeExecutionResult>;
  isRunning: boolean;
  currentNodeId: string | null;
  onRun: (input: string) => void;
  onResumePendingAuth: () => Promise<void>;
  onClose: () => void;
  environment: 'draft' | 'production';
  pendingAuth: WorkflowPendingAuth | null;
}

const getNodeIcon = (nodeType: string) => {
  const iconMap: Record<string, any> = {
    'research': Search,
    'summarizer': FileText,
    'social-post': Play, // Or Share2 if imported
    'custom-prompt': Bot,
    'agent': Bot,
    'mcp': Plug,
    'firecrawl': Zap,
    'if-else': GitBranch,
    'while': Repeat,
    'user-approval': CheckCircle,
    'transform': Braces,
    'file-search': Search,
    'extract': FileText,
    'end': StopCircle,
    'start': Play,
  };
  return iconMap[nodeType] || Bot;
};

const getNodeColor = (nodeType: string) => {
  const colorMap: Record<string, string> = {
    'research': 'bg-primary-green',
    'summarizer': 'bg-primary-green',
    'social-post': 'bg-primary-green',
    'custom-prompt': 'bg-primary-green',
    'agent': 'bg-primary-green',
    'mcp': 'bg-primary-green',
    'firecrawl': 'bg-primary-green',
    'if-else': 'bg-accent-green',
    'while': 'bg-accent-green',
    'user-approval': 'bg-muted',
    'transform': 'bg-primary-green',
    'file-search': 'bg-primary-green',
    'extract': 'bg-primary-green',
    'end': 'bg-primary-green',
    'start': 'bg-primary-green',
  };
  return colorMap[nodeType] || 'bg-primary-green';
};

export default function ExecutionPanel({
  workflow,
  execution,
  nodeResults,
  isRunning,
  currentNodeId,
  onRun,
  onResumePendingAuth,
  onClose,
  environment,
  pendingAuth,
}: ExecutionPanelProps) {
  
  // Track Google Doc creation for toast notifications
  const [notifiedDocs, setNotifiedDocs] = useState<Set<string>>(new Set());
  const [isResumingAuth, setIsResumingAuth] = useState(false);
  const [copiedAuthLink, setCopiedAuthLink] = useState(false);

  const handleCopyAuthLink = useCallback(() => {
    if (!pendingAuth?.authUrl) return;
    navigator.clipboard.writeText(pendingAuth.authUrl);
    setCopiedAuthLink(true);
    setTimeout(() => setCopiedAuthLink(false), 2000);
    toast.success('Authorization link copied');
  }, [pendingAuth?.authUrl]);

  const handleResumeAuthorization = useCallback(async () => {
    if (isResumingAuth) return;
    setIsResumingAuth(true);
    try {
      await onResumePendingAuth();
      toast.success('Resuming workflow...');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to resume workflow';
      toast.error(message);
    } finally {
      setIsResumingAuth(false);
    }
  }, [isResumingAuth, onResumePendingAuth]);
  
  // Check for Google Doc creation and show toast
  useEffect(() => {
    Object.entries(nodeResults).forEach(([nodeId, result]) => {
      if (result.status === 'completed' && result.output && !notifiedDocs.has(nodeId)) {
        const output = result.output;
        const outputStr = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
        const outputObj = typeof output === 'object' ? output : null;
        
        // Check if this is a Google Docs creation result
        const isGoogleDocResult = outputObj?.result?.output?.value?.documentUrl || 
                                 outputStr.includes('documentUrl') ||
                                 outputStr.includes('Executive Summary');
        
        if (isGoogleDocResult) {
          let docUrl: string | null = null;
          let docTitle: string | null = null;
          
          // Extract document URL and title from the result
          if (outputObj?.result?.output?.value?.documentUrl) {
            docUrl = outputObj.result.output.value.documentUrl;
            docTitle = outputObj.result.output.value.title || 'Executive Summary';
          } else if (outputStr.includes('documentUrl')) {
            try {
              const parsed = JSON.parse(outputStr);
              docUrl = parsed.result?.output?.value?.documentUrl || parsed.documentUrl;
              docTitle = parsed.result?.output?.value?.title || parsed.documentTitle || 'Executive Summary';
            } catch (e) {
              // Fallback: try to extract URL from string
              const urlMatch = outputStr.match(/https:\/\/docs\.google\.com\/document\/d\/[^\/\s]+/);
              if (urlMatch) {
                docUrl = urlMatch[0];
                docTitle = 'Executive Summary';
              }
            }
          }
          
          if (docUrl) {
            // Show success toast
            toast.success('Document Updated', {
              description: `Your executive summary "${docTitle}" has been created in Google Docs.`,
              action: {
                label: 'Open Document',
                onClick: () => window.open(docUrl, '_blank'),
              },
              duration: 8000, // Show for 8 seconds
            });
            
            // Mark this node as notified
            setNotifiedDocs(prev => new Set(prev).add(nodeId));
          }
        }
      }
    });
  }, [nodeResults, notifiedDocs]);

  useEffect(() => {
    setCopiedAuthLink(false);
  }, [pendingAuth?.authId]);
  // Get input variables from Start node
  const startNode = workflow?.nodes.find(n => (n.data as any)?.nodeType === 'start');
  const inputVariables = (startNode?.data as any)?.inputVariables || [];

  console.log('ExecutionPanel - Start node:', startNode);
  console.log('ExecutionPanel - Input variables:', inputVariables);

  // Initialize input state from variables
  const [inputValues, setInputValues] = useState<Record<string, any>>({});

  // Update inputValues when inputVariables change
  useEffect(() => {
    if (inputVariables.length > 0) {
      const defaults = inputVariables.reduce((acc: any, v: any) => {
        acc[v.name] = v.defaultValue || (v.type === 'url' ? 'https://firecrawl.dev' : '');
        return acc;
      }, {});
      setInputValues(defaults);
      console.log('Set input values from variables:', defaults);
    } else {
      setInputValues({ input: 'https://firecrawl.dev' });
      console.log('Set default input value');
    }
  }, [workflow?.id, inputVariables.length]); // Re-initialize when workflow or variables change

  const [showInput, setShowInput] = useState(true);
  const [copiedError, setCopiedError] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set());
  const handleCopyAllResults = () => {
    // Collect all results from the workflow with data flow information
    const results = {
      environment,
      workflowId: workflow?.id,
      executionId: execution?.id,
      status: execution?.status,
      inputs: inputValues,
      dataFlow: {
        nodes: Object.entries(nodeResults).map(([nodeId, result]) => {
          const node = workflow?.nodes.find(n => n.id === nodeId);
          const nodeName = (node?.data as any)?.nodeName ||
                          (typeof node?.data?.label === 'string' ? node.data.label : nodeId);

          // Find incoming connections (edges where this node is the target)
          const incomingEdges = workflow?.edges.filter(e => e.target === nodeId) || [];
          const incomingConnections = incomingEdges.map(edge => {
            const sourceNode = workflow?.nodes.find(n => n.id === edge.source);
            const sourceNodeName = (sourceNode?.data as any)?.nodeName || edge.source;
            return {
              fromNodeId: edge.source,
              fromNodeName: sourceNodeName,
              edgeLabel: edge.label || null,
              sourceOutput: nodeResults[edge.source]?.output || null,
            };
          });

          // Find outgoing connections (edges where this node is the source)
          const outgoingEdges = workflow?.edges.filter(e => e.source === nodeId) || [];
          const outgoingConnections = outgoingEdges.map(edge => {
            const targetNode = workflow?.nodes.find(n => n.id === edge.target);
            const targetNodeName = (targetNode?.data as any)?.nodeName || edge.target;
            return {
              toNodeId: edge.target,
              toNodeName: targetNodeName,
              edgeLabel: edge.label || null,
              receivedInput: result.output || null,
            };
          });

          return {
            nodeId,
            nodeName,
            nodeType: (node?.data as any)?.nodeType || node?.type,
            status: result.status,
            incomingConnections,
            output: result.output,
            toolCalls: result.toolCalls || [],
            outgoingConnections,
            error: result.error,
            arguments: (node?.data as any)?.arguments || null,
            duration: result.completedAt && result.startedAt
              ? Math.round((new Date(result.completedAt).getTime() - new Date(result.startedAt).getTime()) / 1000)
              : null,
          };
        }),
        connections: workflow?.edges.map(edge => ({
          from: edge.source,
          to: edge.target,
          label: edge.label || null,
          fromNodeName: (workflow.nodes.find(n => n.id === edge.source)?.data as any)?.nodeName || edge.source,
          toNodeName: (workflow.nodes.find(n => n.id === edge.target)?.data as any)?.nodeName || edge.target,
        })) || [],
      },
      totalDuration: execution?.completedAt && execution?.startedAt
        ? Math.round((new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime()) / 1000)
        : null,
    };

    navigator.clipboard.writeText(JSON.stringify(results, null, 2));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleRun = useCallback(() => {
    const input = inputVariables.length > 0
      ? JSON.stringify(inputValues)
      : inputValues.input || '';

    console.log('🚀 Running workflow with input:', input);
    setShowInput(false);
    onRun(input);
  }, [inputVariables, inputValues, onRun]);

  const hasMissingRequiredInputs = inputVariables.length > 0
    ? inputVariables.some((variable: any) =>
        variable.required &&
        (inputValues[variable.name] === undefined || inputValues[variable.name] === '' || inputValues[variable.name] === null))
    : false;

  const canTriggerShortcut = showInput && !isRunning && !hasMissingRequiredInputs;

  useEffect(() => {
    if (!canTriggerShortcut) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        handleRun();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [canTriggerShortcut, handleRun]);

  const handleReset = () => {
    setShowInput(true);
    setInputValues(
      inputVariables.length > 0
        ? inputVariables.reduce((acc: any, v: any) => {
            acc[v.name] = v.defaultValue || '';
            return acc;
          }, {})
        : { input: '' }
    );
  };

  const handleCopyError = (error: string, nodeId: string) => {
    navigator.clipboard.writeText(error);
    setCopiedError(nodeId);
    setTimeout(() => setCopiedError(null), 2000);
  };

  return (
    <AnimatePresence>
      <motion.aside
        initial={{ x: 400, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 400, opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed right-20 top-64 h-[calc(100vh-84px)] w-[calc(100vw-240px)] max-w-480 bg-card-bg border border-border-system shadow-2xl overflow-hidden z-50 rounded-12 flex flex-col"
      >
        {/* Header */}
        <div className="p-16 border-b border-border-system flex-shrink-0 bg-white/5">
          <div className="flex items-center justify-between mb-8">
            <div className="flex flex-col gap-2">
              <h2 className="text-label-large text-text-primary font-bold">Execution Monitor</h2>
              <span className="text-label-x-small text-text-muted uppercase tracking-wider">
                System Mode: {environment === 'production' ? 'Production' : 'Development'}
              </span>
            </div>
            <div className="flex items-center gap-8">
              {/* Copy All Results Button - Show when results exist */}
              {!showInput && Object.keys(nodeResults).length > 0 && (
                <>
                  <Button
                    onClick={handleCopyAllResults}
                    variant="secondary"
                    className="gap-6 px-10 py-6"
                    title="Copy all workflow results"
                  >
                    {copiedAll ? (
                      <>
                        <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Copied
                      </>
                    ) : (
                      <>
                        <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy All
                      </>
                    )}
                  </Button>
                  <button
                    onClick={() => {
                      const results = {
                        environment,
                        workflowId: workflow?.id,
                        executionId: execution?.id,
                        status: execution?.status,
                        inputs: inputValues,
                        dataFlow: {
                          nodes: Object.entries(nodeResults).map(([nodeId, result]) => {
                            const node = workflow?.nodes.find(n => n.id === nodeId);
                            const nodeName = (node?.data as any)?.nodeName ||
                                            (typeof node?.data?.label === 'string' ? node.data.label : nodeId);
                            const incomingEdges = workflow?.edges.filter(e => e.target === nodeId) || [];
                            const outgoingEdges = workflow?.edges.filter(e => e.source === nodeId) || [];
                            return {
                              nodeId,
                              nodeName,
                              nodeType: (node?.data as any)?.nodeType || node?.type,
                              status: result.status,
                              incomingConnections: incomingEdges.map(edge => ({
                                fromNodeId: edge.source,
                                fromNodeName: (workflow?.nodes.find(n => n.id === edge.source)?.data as any)?.nodeName || edge.source,
                                edgeLabel: edge.label || null,
                              })),
                              output: result.output,
                              toolCalls: result.toolCalls || [],
                              outgoingConnections: outgoingEdges.map(edge => ({
                                toNodeId: edge.target,
                                toNodeName: (workflow?.nodes.find(n => n.id === edge.target)?.data as any)?.nodeName || edge.target,
                                edgeLabel: edge.label || null,
                              })),
                              error: result.error,
                              duration: result.completedAt && result.startedAt
                                ? Math.round((new Date(result.completedAt).getTime() - new Date(result.startedAt).getTime()) / 1000)
                                : null,
                            };
                          }),
                        },
                        totalDuration: execution?.completedAt && execution?.startedAt
                          ? Math.round((new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime()) / 1000)
                          : null,
                      };

                      const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `workflow-results-${workflow?.id || 'unknown'}-${Date.now()}.json`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    }}
                    className="px-12 py-6 bg-accent-black hover:bg-white/100 text-white rounded-6 text-body-small font-medium transition-colors flex items-center gap-6"
                    title="Download workflow results as JSON"
                  >
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download
                  </button>
                </>
              )}
              <button
                onClick={onClose}
                className="w-32 h-32 rounded-6 hover:bg-white/5 transition-colors flex items-center justify-center"
              >
                <svg className="w-16 h-16 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        {execution?.status === 'waiting-auth' && pendingAuth && pendingAuth.toolName === 'user-approval' && (
          <div className="mb-16 p-16 bg-card-bg border border-border-faint rounded-8">
            <div className="flex items-start gap-12 mb-12">
              <div className="w-32 h-32 rounded-full bg-heat-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-label-medium font-medium text-text-primary mb-4">
                  Workflow Paused
                </p>
                <p className="text-body-small text-text-secondary mb-8">
                  Approval Required
                </p>
                <div className="p-12 bg-background-base border border-border-faint rounded-6">
                  <p className="text-body-small text-text-primary whitespace-pre-wrap">
                    {pendingAuth.message || 'This workflow requires your approval to continue.'}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-8">
              <button
                type="button"
                onClick={async () => {
                  setIsResumingAuth(true);
                  try {
                    await onResumePendingAuth();
                    toast.success('Approved');
                  } catch (error) {
                    toast.error('Failed to resume workflow');
                  } finally {
                    setIsResumingAuth(false);
                  }
                }}
                disabled={isResumingAuth}
                className="flex-1 px-14 py-8 bg-primary-green hover:bg-hover-green text-white rounded-6 text-label-small font-medium transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isResumingAuth ? 'Approving...' : 'Approve'}
              </button>
              <button
                type="button"
                onClick={() => {
                  toast.error('Rejected');
                  onClose();
                }}
                className="flex-1 px-14 py-8 bg-background-base hover:bg-white/5 text-text-primary border border-border-faint rounded-6 text-body-small font-medium transition-all active:scale-[0.98]"
              >
                Reject
              </button>
            </div>
          </div>
        )}

        {execution?.status === 'waiting-auth' && pendingAuth && pendingAuth.toolName !== 'user-approval' && (
          <div className="m-20 mt-0 mb-16 p-16 bg-heat-4 border border-heat-100 rounded-12">
            <div className="flex flex-col gap-12">
              <div>
                <p className="text-label-medium font-medium text-text-primary">
                  Authorization required for {pendingAuth.toolName}
                </p>
                <p className="text-body-small text-text-primary mt-4">
                  {pendingAuth.message || 'Open the authorization link in a new tab, approve access, then resume the workflow.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-10 items-center">
                {pendingAuth.authUrl ? (
                  <a
                    href={pendingAuth.authUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-6 px-14 py-8 bg-accent-black hover:bg-white/108 text-white rounded-8 text-body-small font-medium transition-colors"
                  >
                    <svg className="w-14 h-14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Open authorization
                  </a>
                ) : (
                  <span className="px-14 py-8 bg-card-bg border border-border-faint rounded-8 text-body-small text-text-primary">
                    Waiting for authorization link...
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleCopyAuthLink}
                  disabled={!pendingAuth.authUrl}
                  className="inline-flex items-center gap-6 px-14 py-8 bg-card-bg border border-border-faint rounded-8 text-body-small text-text-primary hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-14 h-14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  {copiedAuthLink ? 'Copied link' : 'Copy link'}
                </button>
                <button
                  type="button"
                  onClick={handleResumeAuthorization}
                  disabled={isResumingAuth}
                  className="inline-flex items-center gap-6 px-14 py-8 bg-heat-100 hover:bg-heat-200 text-white rounded-8 text-body-small font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResumingAuth ? (
                    <svg className="w-14 h-14 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="w-14 h-14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  )}
                  <span>{isResumingAuth ? 'Resuming…' : 'Resume workflow'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

          {/* Current Node Indicator - Only show when running */}
          {isRunning && currentNodeId && (() => {
            const node = workflow?.nodes.find(n => n.id === currentNodeId);
            const nodeData = node?.data as any;
            const nodeName = nodeData?.nodeName || nodeData?.label || 'Node';
            const nodeType = nodeData?.nodeType || node?.type || 'agent';
            const NodeIcon = getNodeIcon(nodeType);

            return (
              <div className="inline-flex items-center gap-8 px-12 py-6 rounded-8 text-body-small bg-white/5 border border-border-faint">
                <svg className="w-14 h-14 text-text-secondary animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <div className="flex items-center gap-6">
                  <NodeIcon className="w-12 h-12 text-text-primary" strokeWidth={2.5} />
                  <span className="text-text-primary font-medium">{typeof nodeName === 'string' ? nodeName : 'Running...'}</span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {showInput ? (
            <div className="p-20">
              {/* Input Variables */}
              {inputVariables.length > 0 ? (
                <div className="mb-24 space-y-16">
                  <h3 className="text-label-medium text-text-primary">Workflow Inputs</h3>
                  {inputVariables.map((variable: any, index: number) => (
                    <div key={index}>
                      <label className="block text-label-small text-text-secondary mb-8">
                        {variable.name}
                        {variable.required && <span className="text-red-500 ml-4">*</span>}
                      </label>
                      {variable.description && (
                        <p className="text-body-small text-text-secondary mb-8">
                          {variable.description}
                        </p>
                      )}

                      {variable.type === 'boolean' ? (
                        <select
                          value={inputValues[variable.name] || 'false'}
                          onChange={(e) => setInputValues({ ...inputValues, [variable.name]: e.target.value === 'true' })}
                          className="w-full px-12 py-10 bg-card-bg border border-border-system rounded-10 text-label-medium text-text-primary focus:outline-none focus:border-primary-green transition-colors"
                        >
                          <option value="true">True</option>
                          <option value="false">False</option>
                        </select>
                      ) : variable.type === 'number' ? (
                        <input
                          type="number"
                          value={inputValues[variable.name] || ''}
                          onChange={(e) => setInputValues({ ...inputValues, [variable.name]: parseFloat(e.target.value) })}
                          placeholder={variable.defaultValue || '0'}
                          className="w-full px-12 py-10 bg-card-bg border border-border-system rounded-10 text-label-medium text-text-primary focus:outline-none focus:border-primary-green transition-colors"
                        />
                      ) : (
                        <input
                          type="text"
                          value={inputValues[variable.name] || ''}
                          onChange={(e) => setInputValues({ ...inputValues, [variable.name]: e.target.value })}
                          placeholder={variable.defaultValue || `Enter ${variable.name}...`}
                          className="w-full px-12 py-10 bg-card-bg border border-border-system rounded-10 text-label-medium text-text-primary focus:outline-none focus:border-primary-green transition-colors"
                        />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mb-24">
                  <label className="block text-label-small text-text-secondary mb-8">
                    Input Message
                  </label>
                  <textarea
                    value={inputValues.input || ''}
                    onChange={(e) => setInputValues({ input: e.target.value })}
                    placeholder="Enter your message or prompt..."
                    rows={6}
                    className="w-full px-12 py-10 bg-card-bg border border-border-system rounded-10 text-label-medium text-text-primary focus:outline-none focus:border-primary-green transition-colors resize-none"
                  />
                </div>
              )}

              <button
                onClick={handleRun}
                disabled={hasMissingRequiredInputs}
                className="w-full px-20 py-12 bg-accent-black hover:bg-white/100 text-white rounded-8 text-body-medium font-medium transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-8"
              >
                <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Preview Workflow
              </button>

              {/* Workflow Info */}
              {workflow && (
                <div className="mt-24 p-16 bg-card-bg rounded-12 border border-border-system">
                  <h3 className="text-label-medium text-text-primary mb-12">Workflow Summary</h3>
                  <div className="space-y-8 text-body-small text-text-secondary">
                    <div className="flex justify-between">
                      <span>Nodes:</span>
                      <span className="text-text-primary font-medium">{workflow.nodes.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Connections:</span>
                      <span className="text-text-primary font-medium">{workflow.edges.length}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-20">
              {/* Input Echo */}
              <div className="mb-24 p-16 bg-card-bg rounded-12 border border-border-system">
                <p className="text-label-small text-text-secondary mb-4 font-medium">Inputs:</p>
                {inputVariables.length > 0 ? (
                  <div className="space-y-6 text-body-small">
                    {Object.entries(inputValues).map(([key, value]) => (
                      <div key={key} className="font-mono">
                        <span className="text-text-secondary">{key}:</span>{' '}
                        <span className="text-text-primary">{JSON.stringify(value)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-body-medium text-text-primary">{inputValues.input}</p>
                )}
              </div>

              {/* Node Execution Results */}
              {isRunning && Object.keys(nodeResults).length === 0 ? (
                <div className="text-center py-32">
                  <div className="w-48 h-48 mx-auto mb-16 bg-white/5 border border-border-faint rounded-full flex items-center justify-center">
                    <svg className="w-24 h-24 text-text-secondary animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                  <p className="text-body-medium text-text-secondary">Starting workflow...</p>
                </div>
              ) : (
                <div className="space-y-16">
                  {Object.entries(nodeResults).map(([nodeId, result]) => {
                    const node = workflow?.nodes.find(n => n.id === nodeId);
                    const nodeData = node?.data as any;
                    const nodeName = nodeData?.nodeName || nodeData?.label || 'Node';
                    const nodeType = nodeData?.nodeType || node?.type || 'agent';
                    const NodeIcon = getNodeIcon(nodeType);
                    const nodeColor = getNodeColor(nodeType);
                    const isActive = currentNodeId === nodeId && result.status === 'running';
                    const statusLabel = result.status === 'pending-authorization' ? 'Awaiting authorization' : result.status;

                    return (
                      <motion.div
                        key={nodeId}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`rounded-10 p-12 border transition-all ${
                          isActive
                            ? 'border-primary-green bg-primary-green/5 shadow-[0_0_15px_rgba(34,197,94,0.1)]'
                            : result.status === 'completed'
                            ? 'border-border-system bg-white/5'
                            : result.status === 'failed'
                            ? 'border-red-500/30 bg-red-500/5'
                            : 'border-border-system bg-white/2'
                        }`}
                      >
                        {/* Node Header */}
                        <div className="flex items-center justify-between mb-12">
                          <div className="flex items-center gap-8">
                            {/* Node Type Icon */}
                            <div className={`w-20 h-20 rounded-3 ${nodeColor} flex items-center justify-center flex-shrink-0`}>
                              <NodeIcon className="w-12 h-12 text-white" strokeWidth={2.5} />
                            </div>

                            {/* Status Icon */}
                            {isActive && (
                              <div className="w-16 h-16 bg-white/5 border border-border-faint rounded-full flex items-center justify-center">
                                <svg className="w-10 h-10 text-text-secondary animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                              </div>
                            )}
                            {result.status === 'completed' && !isActive && (
                              <div className="w-16 h-16 bg-black-alpha-12 rounded-full flex items-center justify-center">
                                <svg className="w-10 h-10 text-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}
                            {result.status === 'failed' && (
                              <div className="w-16 h-16 bg-white/50 rounded-full flex items-center justify-center">
                                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </div>
                            )}
                            <h3 className="text-label-medium font-medium text-text-primary">
                              {typeof nodeName === 'string' ? nodeName : 'Node'}
                            </h3>
                          </div>
                          <div className="flex items-center gap-8">
                            {/* View Schema Button */}
                            <button
                              onClick={() => {
                                const newExpanded = new Set(expandedSchemas);
                                if (newExpanded.has(nodeId)) {
                                  newExpanded.delete(nodeId);
                                } else {
                                  newExpanded.add(nodeId);
                                }
                                setExpandedSchemas(newExpanded);
                              }}
                              className="px-10 py-5 bg-accent-black hover:bg-white/10 border border-border-system rounded-6 text-body-small text-white font-medium transition-colors flex items-center gap-4"
                              title="View data flow schema"
                            >
                              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                              </svg>
                              Schema
                            </button>
                            {result.status !== 'completed' && (
                              <span className={`text-body-small px-8 py-4 rounded-6 border ${
                                result.status === 'running' ? 'bg-card-bg text-text-primary border-border-faint' :
                                result.status === 'failed' ? 'bg-card-bg text-text-primary border-border-faint' :
                                'bg-card-bg text-gray-600 border-gray-200'
                              }`}>
                                {statusLabel}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Expanded Schema View */}
                        {expandedSchemas.has(nodeId) && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-12 p-12 bg-card-bg rounded-8 border border-border-faint"
                          >
                            <div className="flex items-center justify-between mb-8">
                              <h4 className="text-label-small text-text-primary font-medium">Data Flow Schema</h4>
                              <button
                                onClick={() => {
                                  const schema = {
                                    nodeId,
                                    nodeName,
                                    nodeType,
                                    incomingConnections: (workflow?.edges.filter(e => e.target === nodeId) || []).map(edge => {
                                      const sourceNode = workflow?.nodes.find(n => n.id === edge.source);
                                      return {
                                        from: (sourceNode?.data as any)?.nodeName || edge.source,
                                        label: edge.label,
                                        data: nodeResults[edge.source]?.output,
                                      };
                                    }),
                                    output: result.output,
                                    toolCalls: result.toolCalls || [],
                                    outgoingConnections: (workflow?.edges.filter(e => e.source === nodeId) || []).map(edge => {
                                      const targetNode = workflow?.nodes.find(n => n.id === edge.target);
                                      return {
                                        to: (targetNode?.data as any)?.nodeName || edge.target,
                                        label: edge.label,
                                      };
                                    }),
                                    arguments: (node?.data as any)?.arguments,
                                  };
                                  navigator.clipboard.writeText(JSON.stringify(schema, null, 2));
                                }}
                                className="text-body-small text-text-primary hover:text-text-primary transition-colors flex items-center gap-4"
                              >
                                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                Copy Schema
                              </button>
                            </div>
                            <div className="space-y-12">
                              {/* Incoming Data */}
                              {(() => {
                                const incomingEdges = workflow?.edges.filter(e => e.target === nodeId) || [];
                                if (incomingEdges.length > 0) {
                                  return (
                                    <div>
                                      <p className="text-body-small text-text-secondary mb-6 font-medium">Incoming Data:</p>
                                      {incomingEdges.map((edge) => {
                                        const sourceNode = workflow?.nodes.find(n => n.id === edge.source);
                                        const sourceName = (sourceNode?.data as any)?.nodeName || edge.source;
                                        const sourceOutput = nodeResults[edge.source]?.output;
                                        return (
                                          <div key={edge.id} className="mb-8 last:mb-0">
                                            <div className="flex items-center gap-4 mb-4">
                                              <span className="text-body-small text-text-primary">← {sourceName}</span>
                                              {edge.label && (
                                                <span className="text-body-small text-text-secondary bg-background-base px-6 py-2 rounded-4">
                                                  {edge.label}
                                                </span>
                                              )}
                                            </div>
                                            {sourceOutput && (
                                              <div className="bg-background-base rounded-6 p-8 border border-border-faint ml-16">
                                                <pre className="text-[10px] text-text-primary font-mono whitespace-pre-wrap overflow-auto max-h-100">
                                                  {typeof sourceOutput === 'string' ? sourceOutput : JSON.stringify(sourceOutput, null, 2)}
                                                </pre>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                }
                              })()}

                              {/* Node Arguments */}
                              {(node?.data as any)?.arguments && (
                                <div>
                                  <p className="text-body-small text-text-secondary mb-6 font-medium">Node Arguments:</p>
                                  <div className="bg-background-base rounded-6 p-8 border border-border-faint">
                                    <pre className="text-[10px] text-text-primary font-mono whitespace-pre-wrap">
                                      {JSON.stringify((node?.data as any)?.arguments, null, 2)}
                                    </pre>
                                  </div>
                                </div>
                              )}

                              {/* Output Data */}
                              {result.output && (
                                <div>
                                  <p className="text-body-small text-text-secondary mb-6 font-medium">Output Data:</p>
                                  <div className="bg-background-base rounded-6 p-8 border border-border-faint">
                                    <pre className="text-[10px] text-text-primary font-mono whitespace-pre-wrap overflow-auto max-h-150">
                                      {typeof result.output === 'string' ? result.output : JSON.stringify(result.output, null, 2)}
                                    </pre>
                                  </div>
                                </div>
                              )}

                              {/* Tool Call Details */}
                              {result.toolCalls && result.toolCalls.length > 0 && (
                                <div>
                                  <div className="flex items-center gap-8 mb-8">
                                    <div className="w-20 h-20 rounded-4 bg-[#FFEFA4] dark:bg-[#FFDD40] flex items-center justify-center flex-shrink-0">
                                      <Plug className="w-12 h-12 text-white" strokeWidth={2.5} />
                                    </div>
                                    <p className="text-label-medium font-medium text-text-primary">MCP Tool Calls:</p>
                                  </div>
                                  <div className="space-y-8">
                                    {result.toolCalls.map((call, index) => (
                                      <div key={index} className="bg-background-base rounded-6 p-8 border border-border-faint">
                                        <div className="flex items-center justify-between mb-6">
                                          <span className="text-body-small font-medium text-text-primary">
                                            {call.name || `Tool ${index + 1}`}
                                          </span>
                                          <span className="text-xs text-text-muted">#{index + 1}</span>
                                        </div>
                                        {call.arguments && (
                                          <div className="mb-6">
                                            <p className="text-[10px] text-text-secondary mb-2 uppercase tracking-wide">Arguments</p>
                                            <pre className="text-[10px] text-text-primary font-mono whitespace-pre-wrap bg-card-bg border border-border-faint rounded-4 p-6 overflow-auto max-h-120">
                                              {typeof call.arguments === 'string'
                                                ? call.arguments
                                                : JSON.stringify(call.arguments, null, 2)}
                                            </pre>
                                          </div>
                                        )}
                                        {call.output && (
                                          <div>
                                            <p className="text-[10px] text-text-secondary mb-2 uppercase tracking-wide">Output</p>
                                            <pre className="text-[10px] text-text-primary font-mono whitespace-pre-wrap bg-card-bg border border-border-faint rounded-4 p-6 overflow-auto max-h-150">
                                              {typeof call.output === 'string'
                                                ? call.output
                                                : JSON.stringify(call.output, null, 2)}
                                            </pre>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Outgoing Data */}
                              {(() => {
                                const outgoingEdges = workflow?.edges.filter(e => e.source === nodeId) || [];
                                if (outgoingEdges.length > 0) {
                                  return (
                                    <div>
                                      <p className="text-body-small text-text-secondary mb-6 font-medium">Sent To:</p>
                                      <div className="space-y-4">
                                        {outgoingEdges.map((edge) => {
                                          const targetNode = workflow?.nodes.find(n => n.id === edge.target);
                                          const targetName = (targetNode?.data as any)?.nodeName || edge.target;
                                          return (
                                            <div key={edge.id} className="flex items-center gap-4">
                                              <span className="text-body-small text-text-primary">→ {targetName}</span>
                                              {edge.label && (
                                                <span className="text-body-small text-text-secondary bg-background-base px-6 py-2 rounded-4">
                                                  {edge.label}
                                                </span>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                }
                              })()}
                            </div>
                          </motion.div>
                        )}

                        {/* Node Error */}
                        {result.error && (
                          <div className="mt-12">
                            <div className="flex items-center justify-between mb-6">
                              <p className="text-body-small text-text-primary font-medium">Error:</p>
                              <button
                                onClick={() => handleCopyError(result.error!, nodeId)}
                                className="text-body-small text-text-primary hover:text-text-primary transition-colors flex items-center gap-4 px-8 py-4 rounded-6 hover:bg-white/5"
                              >
                                {copiedError === nodeId ? (
                                  <>
                                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Copied
                                  </>
                                ) : (
                                  <>
                                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                    Copy
                                  </>
                                )}
                              </button>
                            </div>
                            <div className="bg-white/5 rounded-8 p-12 border border-border-faint">
                              <pre className="text-body-small text-text-primary whitespace-pre-wrap overflow-auto max-h-200 font-mono">
                                {result.error}
                              </pre>
                            </div>
                          </div>
                        )}


                        {result.pendingAuth && (
                          <div className="mt-12 p-12 bg-heat-4 border border-heat-100 rounded-8">
                            <p className="text-body-small font-medium text-text-primary">
                              Authorization required for {result.pendingAuth.toolName}
                            </p>
                            <p className="text-body-small text-text-primary mt-4">
                              {result.pendingAuth.message || 'Complete authorization to allow the workflow to continue from this node.'}
                            </p>
                            {result.pendingAuth.authUrl && (
                              <a
                                href={result.pendingAuth.authUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-6 mt-10 px-12 py-6 bg-accent-black hover:bg-white/108 text-white rounded-6 text-body-small font-medium transition-colors"
                              >
                                <svg className="w-14 h-14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                                Open authorization
                              </a>
                            )}
                          </div>
                        )}

                        {/* Node Output */}
                        {result.output && !result.error && (
                          <div className="mt-12">
                            <p className="text-body-small text-text-secondary mb-6">Output:</p>
                            
                            {/* Special handling for Google Docs results */}
                            {(() => {
                              const output = result.output;
                              const outputStr = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
                              const outputObj = typeof output === 'object' ? output : null;
                              
                              // Check if this is a Google Docs creation result
                              const isGoogleDocResult = outputObj?.result?.output?.value?.documentUrl || 
                                                       outputStr.includes('documentUrl') ||
                                                       outputStr.includes('Executive Summary');
                              
                              if (isGoogleDocResult) {
                                let docUrl: string | null = null;
                                let docTitle: string | null = null;
                                
                                // Extract document URL and title from the result
                                if (outputObj?.result?.output?.value?.documentUrl) {
                                  docUrl = outputObj.result.output.value.documentUrl;
                                  docTitle = outputObj.result.output.value.title || 'Executive Summary';
                                } else if (outputStr.includes('documentUrl')) {
                                  try {
                                    const parsed = JSON.parse(outputStr);
                                    docUrl = parsed.result?.output?.value?.documentUrl || parsed.documentUrl;
                                    docTitle = parsed.result?.output?.value?.title || parsed.documentTitle || 'Executive Summary';
                                  } catch (e) {
                                    // Fallback: try to extract URL from string
                                    const urlMatch = outputStr.match(/https:\/\/docs\.google\.com\/document\/d\/[^\/\s]+/);
                                    if (urlMatch) {
                                      docUrl = urlMatch[0];
                                      docTitle = 'Executive Summary';
                                    }
                                  }
                                }
                                
                                if (docUrl) {
                                  return (
                                    <div className="space-y-12">
                                      {/* Success notification */}
                                      <div className="bg-background-base border border-border-faint rounded-8 p-12">
                                        <div className="flex items-center gap-8 mb-8">
                                          <div className="w-16 h-16 bg-accent-black rounded-full flex items-center justify-center">
                                            <svg className="w-10 h-10 text-accent-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                          </div>
                                          <span className="text-body-small font-medium text-text-primary">
                                            Document Updated
                                          </span>
                                        </div>
                                        <p className="text-body-small text-text-secondary mb-12">
                                          Your executive summary has been created in Google Docs.
                                        </p>
                                        
                                        {/* Clickable document link */}
                                        <a
                                          href={docUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-8 px-16 py-10 bg-accent-black hover:bg-white/108 text-accent-white rounded-8 text-body-small font-medium transition-colors"
                                        >
                                          <svg className="w-14 h-14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                          </svg>
                                          Open {docTitle}
                                        </a>
                                      </div>
                                      
                                      {/* Raw output for debugging */}
                                      <details className="group">
                                        <summary className="cursor-pointer text-body-small text-text-secondary hover:text-text-primary transition-colors flex items-center gap-4">
                                          <span>View Raw Output</span>
                                          <svg className="w-12 h-12 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                          </svg>
                                        </summary>
                                        <div className="mt-8 bg-[#0a0a0a] rounded-8 p-14 border border-white/10 shadow-inner">
                                          <pre className="text-[11px] leading-relaxed text-[#00FF41] whitespace-pre-wrap overflow-auto max-h-250 font-mono">
                                            {outputStr}
                                          </pre>
                                        </div>
                                      </details>
                                    </div>
                                  );
                                }
                              }
                              
                              // Default output display
                              return (
                                <div className="bg-[#0a0a0a] rounded-8 p-14 border border-white/10 shadow-inner">
                                  <pre className="text-[12px] leading-relaxed text-[#00FF41] font-medium whitespace-pre-wrap overflow-auto max-h-300 font-mono scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                                    {outputStr}
                                  </pre>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                        {/* MCP Tool Calls */}
                        {result.toolCalls && result.toolCalls.length > 0 && (
                          <div className="mt-12">
                            <div className="flex items-center gap-8 mb-8">
                              <div className="w-20 h-20 rounded-4 bg-[#FFEFA4] dark:bg-[#FFDD40] flex items-center justify-center flex-shrink-0">
                                <Plug className="w-12 h-12 text-white" strokeWidth={2.5} />
                              </div>
                              <p className="text-label-medium font-medium text-text-primary">MCP Tool Calls:</p>
                            </div>
                            <div className="space-y-8">
                              {result.toolCalls.map((call, index) => (
                                <div key={index} className="bg-background-base rounded-8 p-12 border border-border-faint">
                                  <div className="flex items-center justify-between mb-8">
                                    <span className="text-body-small font-medium text-text-primary">
                                      {call.name || `Tool ${index + 1}`}
                                    </span>
                                    <span className="text-body-small text-text-muted">#{index + 1}</span>
                                  </div>
                                  {call.arguments && (
                                    <div className="mb-8">
                                      <p className="text-[11px] text-text-secondary mb-2 uppercase tracking-wide">Arguments</p>
                                      <pre className="text-[11px] text-[#00FF41] font-mono whitespace-pre-wrap bg-[#0a0a0a] border border-white/5 rounded-6 p-10 overflow-auto max-h-120">
                                        {typeof call.arguments === 'string'
                                          ? call.arguments
                                          : JSON.stringify(call.arguments, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                  {call.output && (
                                    <div>
                                      <p className="text-[11px] text-text-secondary mb-2 uppercase tracking-wide">Output</p>
                                      <pre className="text-[11px] text-[#00FF41] font-mono whitespace-pre-wrap bg-[#0a0a0a] border border-white/5 rounded-6 p-10 overflow-auto max-h-150">
                                        {typeof call.output === 'string'
                                          ? call.output
                                          : JSON.stringify(call.output, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}


                        {/* Timing */}
                        {result.startedAt && (
                          <div className="flex items-center gap-8 mt-12 text-body-small text-text-secondary">
                            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {result.completedAt ? (
                              <span>
                                {Math.round((new Date(result.completedAt).getTime() - new Date(result.startedAt).getTime()) / 1000)}s
                              </span>
                            ) : (
                              <span className="animate-pulse">Running...</span>
                            )}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}

                  {/* Workflow Error */}
                  {execution?.status === 'failed' && execution?.error && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="mt-24 p-20 bg-white/5 rounded-12 border border-border-faint"
                    >
                      <div className="flex items-center gap-12 mb-12">
                        <div className="w-32 h-32 bg-white/50 rounded-full flex items-center justify-center">
                          <svg className="w-18 h-18 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                        <h3 className="text-label-medium text-text-primary font-medium">Workflow Failed</h3>
                      </div>
                      <div className="mb-12">
                        <div className="flex items-center justify-between mb-6">
                          <p className="text-body-small text-text-primary font-medium">Error Details:</p>
                          <button
                            onClick={() => handleCopyError(execution.error!, 'workflow')}
                            className="text-body-small text-text-primary hover:text-text-primary transition-colors flex items-center gap-4 px-8 py-4 rounded-6 hover:bg-white/10"
                          >
                            {copiedError === 'workflow' ? (
                              <>
                                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Copied
                              </>
                            ) : (
                              <>
                                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                Copy Error
                              </>
                            )}
                          </button>
                        </div>
                        <div className="bg-white/10 rounded-8 p-12 border border-border-faint">
                          <pre className="text-body-small text-text-primary whitespace-pre-wrap overflow-auto max-h-200 font-mono">
                            {execution.error}
                          </pre>
                        </div>
                      </div>
                      <button
                        onClick={handleReset}
                        className="mt-8 w-full px-16 py-10 bg-accent-black hover:bg-white/100 text-white rounded-8 text-body-small font-medium transition-colors"
                      >
                        Try Again
                      </button>
                    </motion.div>
                  )}

                  {/* Final Result */}
                  {execution?.status === 'completed' && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="mt-24 p-20 bg-card-bg rounded-12 border border-border-system"
                    >
                      <div className="flex items-center gap-12 mb-12">
                        <div className="w-32 h-32 bg-black-alpha-12 rounded-full flex items-center justify-center">
                          <svg className="w-18 h-18 text-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <h3 className="text-label-medium text-text-primary font-medium">Workflow Completed</h3>
                      </div>
                      <p className="text-body-small text-text-primary">
                        All nodes executed successfully
                      </p>
                      <button
                        onClick={handleReset}
                        className="mt-16 w-full px-16 py-10 bg-accent-black hover:bg-white/100 text-white rounded-8 text-body-small font-medium transition-colors"
                      >
                        Run Again
                      </button>
                    </motion.div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}

