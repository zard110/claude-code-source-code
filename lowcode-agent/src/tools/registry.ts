import type { Tool } from './types.js'
import { listFilesTool } from './list-files.js'
import { readJsonTool } from './read-json.js'
import { writeJsonTool } from './write-json.js'
import { modifyJsonTool } from './modify-json.js'
import { deleteFileTool } from './delete-json.js'
import { moveFileTool } from './move-json.js'
import { batchDeleteTool } from './batch-delete.js'
import { batchWriteTool } from './batch-write.js'

/**
 * Tool Registry — manages all available tools.
 * Mirrors Claude Code's tool discovery pattern.
 */
export class ToolRegistry {
  private tools: Map<string, Tool> = new Map()

  register(tool: Tool): void {
    this.tools.set(tool.name, tool)
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name)
  }

  getAll(): Tool[] {
    return Array.from(this.tools.values())
  }
}

/** Create the default registry with all built-in tools */
export function createDefaultRegistry(): ToolRegistry {
  const registry = new ToolRegistry()

  registry.register(listFilesTool)
  registry.register(readJsonTool)
  registry.register(writeJsonTool)
  registry.register(modifyJsonTool)
  registry.register(deleteFileTool)
  registry.register(moveFileTool)
  registry.register(batchDeleteTool)
  registry.register(batchWriteTool)

  return registry
}
