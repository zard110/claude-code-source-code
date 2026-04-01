/**
 * 入口 — 薄壳层，组合 Terminal UI + Agent Core
 *
 * 职责：
 * - 加载 .env.local
 * - 创建依赖
 * - 主循环
 */
import { config } from 'dotenv'
import { resolve } from 'node:path'
import chalk from 'chalk'

config({ path: resolve(import.meta.dirname, '..', '.env.local') })

import { createDefaultRegistry } from './tools/registry.js'
import { buildProjectContext, createToolContext } from './agent/context.js'
import { AgentLoop, Conversation } from './agent/core.js'
import type { Message, AgentEvent } from './agent/core.js'
import { SkillRegistry } from './skills/registry.js'
import { TerminalUI } from './ui/terminal.js'
import { loadProjectMemory } from './agent/memory.js'
import { initLogger, getLogFilePath, logUserInput } from './utils/logger.js'

// ─── Main ─────────────────────────────────────────────

async function main() {
  const workDir = resolve(process.argv[2] || '.')
  const ui = new TerminalUI()

  // 启动时清空日志
  await initLogger()

  ui.showWelcome(workDir)
  console.log(chalk.gray(`  调试日志: ${getLogFilePath()}\n`))

  // 创建依赖
  const toolRegistry = createDefaultRegistry()
  const skillRegistry = new SkillRegistry()
  skillRegistry.applyTools(toolRegistry)
  const toolCtx = createToolContext(workDir)
  const projectMemory = await loadProjectMemory(workDir)

  // 持久化对话历史（跨轮次保持上下文）
  const history: Message[] = []

  // 主循环
  while (true) {
    const input = await ui.promptUser()

    if (!input || input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
      ui.showGoodbye()
      break
    }

    logUserInput(input)

    // 每轮重建 projectContext（可能有文件变化）
    const projectCtx = await buildProjectContext(workDir)
    const conversation = new Conversation(history, projectCtx)

    const agentLoop = new AgentLoop({
      conversation,
      toolRegistry,
      toolCtx,
      skills: skillRegistry.getAll(),
      options: {
        confirmFn: ui.getConfirmFn(),
        askUserFn: ui.getAskUserFn(),
        projectMemory: projectMemory ?? undefined,
      },
    })

    try {
      const ctx = ui.createRenderContext()

      for await (const event of agentLoop.sendMessage(input)) {
        ui.renderEvent(event, ctx)
      }

      ui.renderTail(ctx)

      // 同步 conversation 回外部 history
      history.length = 0
      history.push(...conversation.getMessages())
    } catch (err: unknown) {
      ui.stopSpinner()
      const msg = err instanceof Error ? err.message : String(err)
      ui.writeLine(chalk.red(`\n  执行出错: ${msg}\n`))
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
