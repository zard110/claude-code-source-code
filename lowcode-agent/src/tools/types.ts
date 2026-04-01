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

/**
 * Convert a Tool to Anthropic API's tool definition format
 */
export function toApiTool(tool: Tool): {
  name: string
  description: string
  input_schema: object
} {
  const schema = tool.inputSchema as z.ZodObject<z.ZodRawShape>
  return {
    name: tool.name,
    description: tool.description,
    input_schema: zodToAnthropicSchema(schema),
  }
}

/**
 * Convert Zod schema to Anthropic's JSON Schema format
 */
function zodToAnthropicSchema(zodSchema: z.ZodType): object {
  // Use Zod's built-in JSON Schema conversion
  return zodToJsonSchema(zodSchema)
}

/**
 * Minimal Zod → JSON Schema converter
 * Handles the types we use in our tools
 */
function zodToJsonSchema(zodSchema: z.ZodType): object {
  if (zodSchema instanceof z.ZodObject) {
    const shape = zodSchema.shape
    const properties: Record<string, object> = {}
    const required: string[] = []

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value as z.ZodType)
      if (!(value instanceof z.ZodOptional)) {
        required.push(key)
      }
    }

    return {
      type: 'object' as const,
      properties,
      required: required.length > 0 ? required : undefined,
    }
  }

  if (zodSchema instanceof z.ZodString) {
    const result: Record<string, unknown> = { type: 'string' }
    if (zodSchema.description) result.description = zodSchema.description
    return result
  }

  if (zodSchema instanceof z.ZodNumber) {
    return { type: 'number' }
  }

  if (zodSchema instanceof z.ZodBoolean) {
    return { type: 'boolean' }
  }

  if (zodSchema instanceof z.ZodArray) {
    return {
      type: 'array',
      items: zodToJsonSchema(zodSchema.element),
    }
  }

  if (zodSchema instanceof z.ZodEnum) {
    return {
      type: 'string',
      enum: zodSchema.options,
    }
  }

  if (zodSchema instanceof z.ZodOptional) {
    return zodToJsonSchema(zodSchema.unwrap())
  }

  if (zodSchema instanceof z.ZodDefault) {
    return zodToJsonSchema(zodSchema.removeDefault())
  }

  if (zodSchema instanceof z.ZodRecord) {
    return {
      type: 'object',
      additionalProperties: zodToJsonSchema(zodSchema.valueSchema),
    }
  }

  if (zodSchema instanceof z.ZodAny) {
    return {}
  }

  // Fallback
  return { type: 'object' }
}

// Need to re-export z for convenience
export { z }
