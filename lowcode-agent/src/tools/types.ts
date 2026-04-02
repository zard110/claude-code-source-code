import { z } from 'zod'

/**
 * Tool execution result
 */
export interface ToolResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message: string
}

/**
 * Context passed to every tool handler
 */
export interface ToolContext {
  /** Absolute path to the project working directory */
  workDir: string
  /** Cache of files read during this session */
  fileCache: Map<string, unknown>
  /** Progress callback — batch tools call this to report per-item progress */
  onProgress?: (message: string) => void
}

/**
 * Core Tool interface — inspired by Claude Code's buildTool() pattern
 */
export interface Tool<I = unknown, O = unknown> {
  /** Unique tool name (used by LLM to invoke) */
  name: string
  /** Description for the LLM — determines when and how the LLM uses this tool */
  description: string
  /** Zod schema for input validation + LLM parameter definition */
  inputSchema: z.ZodType<I>
  /** Whether this tool only reads (safe to run in parallel) */
  isReadOnly: boolean
  /** Execute the tool */
  handler(input: I, ctx: ToolContext): Promise<ToolResult<O>>
}

/**
 * Tool builder — provides a clean API for defining tools.
 * Mirrors Claude Code's buildTool() pattern with safe defaults.
 */
export function buildTool<I, O>(def: {
  name: string
  description: string
  inputSchema: z.ZodType<I>
  isReadOnly?: boolean
  handler: (input: I, ctx: ToolContext) => Promise<ToolResult<O>>
}): Tool<I, O> {
  return {
    isReadOnly: false,
    ...def,
  }
}

// Re-export z for convenience
export { z }
