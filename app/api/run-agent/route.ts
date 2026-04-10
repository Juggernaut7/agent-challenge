import { NextRequest, NextResponse } from 'next/server';
import { ElizaExecutor } from '@/lib/workflow/eliza-executor';
import { getServerAPIKeys } from '@/lib/api/config';

export const dynamic = 'force-dynamic';

/**
 * ElizaForge Workflow Execution Endpoint
 * POST /api/run-agent
 * 
 * Executes a sequential ElizaOS-powered workflow.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nodes, initialState } = body;

    if (!nodes || !Array.isArray(nodes)) {
      return NextResponse.json(
        { error: 'Invalid workflow: nodes array is required' },
        { status: 400 }
      );
    }

    // Initialize ElizaExecutor with optional initial state
    const executor = new ElizaExecutor(initialState);

    // Run the workflow steps sequentially
    console.log(`Starting ElizaForge execution with ${nodes.length} nodes`);
    const results = await executor.runWorkflow(nodes);

    // Check if any node failed
    const hasFailed = Object.values(results).some(r => r.status === 'failed');

    return NextResponse.json({
      success: !hasFailed,
      results,
      status: hasFailed ? 'failed' : 'completed',
      completedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('ElizaForge execution error:', error);
    return NextResponse.json(
      {
        error: 'Execution failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
