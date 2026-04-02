/**
 * Bundled Agents — 编译内置的子代理注册
 *
 * 仿 Claude Code 的 getBuiltInAgents() 模式:
 * - 每个代理在独立文件中定义
 * - 在此统一注册
 * - 新增代理只需：1) 创建文件 2) 在此添加一行
 */
import type { AgentRegistry } from '../registry.js'
import { PAGE_WRITER_AGENT } from './page-writer.js'
import { API_WRITER_AGENT } from './api-writer.js'
import { ARCHITECT_AGENT } from './architect.js'
import { REQUIREMENTS_ANALYZER_AGENT } from './requirements-analyzer.js'

/**
 * Initialize all bundled agents into the registry.
 * Called at startup.
 */
export function initBundledAgents(registry: AgentRegistry): void {
  registry.register(PAGE_WRITER_AGENT)
  registry.register(API_WRITER_AGENT)
  registry.register(ARCHITECT_AGENT)
  registry.register(REQUIREMENTS_ANALYZER_AGENT)
}
