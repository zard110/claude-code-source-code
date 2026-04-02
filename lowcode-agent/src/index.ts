#!/usr/bin/env node
/**
 * 入口 — 薄壳层，组合 Terminal UI + Agent Core
 *
 * 职责：
 * - 初始化默认配置（内置 key，用户无需配置）
 * - 加载可选的项目级 .env.local 覆盖
 * - 创建依赖
 * - 主循环
 */
import { config } from 'dotenv'
import { resolve, join } from 'node:path'
import { existsSync } from 'node:fs'
import chalk from 'chalk'

// 1. 注入内置默认配置（用户零配置即可使用）
import { initDefaults } from './config.js'
initDefaults()

// 2. 项目级 .env.local 可覆盖默认配置（可选）
const projectEnvPath = resolve(process.cwd(), '.env.local')
if (existsSync(projectEnvPath)) {
  config({ path: projectEnvPath, override: true })
}

import { createDefaultRegistry } from './tools/registry.js'
import { buildProjectContext, createToolContext } from './agent/context.js'
import { AgentLoop, Conversation, resolveLlmConfig } from './agent/core.js'
import type { Message, AgentEvent } from './agent/core.js'
import { SkillRegistry } from './skills/registry.js'
import { initBundledSkills } from './skills/bundled/index.js'
import { loadFileSkills } from './skills/loader.js'
import { AgentRegistry } from './agents/registry.js'
import { initBundledAgents } from './agents/bundled/index.js'
import { loadFileAgents } from './agents/registry.js'
import { CommandRegistry } from './commands/registry.js'
import { registerBuiltinCommands } from './commands/builtins.js'
import type { CommandContext } from './commands/types.js'
import { TerminalUI } from './ui/terminal.js'
import type { CompletionItem } from './ui/terminal.js'
import { loadProjectMemory } from './agent/memory.js'
import { saveSession, loadSession } from './agent/persistence.js'
import { initLogger, getLogFilePath, logUserInput } from './utils/logger.js'

// ─── Main ─────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const result: { workDir: string; model?: string; provider?: string; fresh: boolean } = {
    workDir: '.',
    fresh: false,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--fresh') {
      result.fresh = true
    } else if (arg === '-m' || arg === '--model') {
      result.model = args[++i]
    } else if (arg === '-p' || arg === '--provider') {
      result.provider = args[++i]
    } else if (!arg.startsWith('-')) {
      result.workDir = arg
    }
  }

  return result
}

async function main() {
  const { workDir, model, provider, fresh } = parseArgs()
  const ui = new TerminalUI()

  // 启动时清空日志
  await initLogger()

  ui.showWelcome(workDir)
  console.log(chalk.gray(`  调试日志: ${getLogFilePath()}`))
  console.log(chalk.gray(`  输入 /help 查看可用命令`))
  if (model) {
    console.log(chalk.cyan(`  模型: ${model}`))
  }
  console.log('')

  // 创建依赖
  const toolRegistry = createDefaultRegistry()

  // ─── Skills 加载 ────────────────────────────────────────
  const skillRegistry = new SkillRegistry()

  // 1. 注册 bundled skills（编译内置）
  initBundledSkills(skillRegistry)

  // 2. 加载文件 skills（.skills/ 目录）
  const skillsDir = resolve(workDir, '.skills')
  const fileSkillCount = await loadFileSkills(skillsDir, skillRegistry)

  // 3. 将 passive skills 的 tools 注入 tool registry
  skillRegistry.applyTools(toolRegistry)

  const activeSkills = skillRegistry.getActiveSkills()
  if (activeSkills.length > 0) {
    console.log(chalk.cyan(`  已加载 ${activeSkills.length} 个技能: ${activeSkills.map(s => s.name).join(', ')}`))
  }
  if (fileSkillCount > 0) {
    console.log(chalk.gray(`  包含 ${fileSkillCount} 个文件技能（来自 .skills/ 目录）`))
  }

  // ─── Agents 加载 ────────────────────────────────────────
  const agentRegistry = new AgentRegistry()

  // 1. 注册 bundled agents
  initBundledAgents(agentRegistry)

  // 2. 加载文件 agents（.agents/ 目录）
  const agentsDir = resolve(workDir, '.agents')
  const fileAgentCount = await loadFileAgents(agentsDir, agentRegistry)

  const allAgents = agentRegistry.getAll()
  if (allAgents.length > 0) {
    console.log(chalk.cyan(`  已加载 ${allAgents.length} 个子代理: ${allAgents.map(a => a.name).join(', ')}`))
  }
  if (fileAgentCount > 0) {
    console.log(chalk.gray(`  包含 ${fileAgentCount} 个文件子代理（来自 .agents/ 目录）`))
  }

  // ─── Commands 注册 ──────────────────────────────────────
  const commandRegistry = new CommandRegistry()
  registerBuiltinCommands(cmd => commandRegistry.register(cmd))

  // 设置 / 命令补全候选（带描述）
  ui.setCompletions([
    ...commandRegistry.getAll().map(c => ({ name: `/${c.name}`, description: c.description })),
    ...activeSkills.map(s => ({ name: `/${s.name}`, description: s.description })),
    ...allAgents.map(a => ({ name: `/${a.name}`, description: a.description })),
  ])

  const toolCtx = createToolContext(workDir)
  const projectMemory = await loadProjectMemory(workDir)

  // 根据 -m 参数解析 LLM 配置（自动匹配 provider 的 baseURL/apiKey）
  let llmConfig = resolveLlmConfig(model)

  // 初始化历史记录（持久化到 .agent/history）
  const { getDefaultModel } = await import('./agent/core.js')
  const currentModel = llmConfig.model || getDefaultModel()
  ui.setModelName(currentModel)
  await ui.initHistory(resolve(workDir, '.agent', 'history'))

  // 持久化对话历史（跨轮次保持上下文）
  const history: Message[] = fresh ? [] : await loadSession(workDir)
  if (history.length > 0) {
    console.log(chalk.gray(`  已恢复上次会话 (${history.length} 条消息)，--fresh 开始新会话\n`))
  }

  // 主循环
  while (true) {
    const input = await ui.promptUser()

    if (!input || input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
      await ui.saveHistory()
      ui.showGoodbye()
      break
    }

    logUserInput(input)

    // ─── Slash 命令分发 ──────────────────────────────────
    if (input.startsWith('/')) {
      // 只输入 `/` → 显示快捷命令列表
      if (input === '/') {
        const cmds = commandRegistry.getAll()
        console.log('')
        for (const cmd of cmds) {
          console.log(`  ${chalk.white.bold('/' + cmd.name.padEnd(16))}${chalk.gray(cmd.description)}`)
        }
        for (const s of activeSkills) {
          console.log(`  ${chalk.cyan('/' + s.name.padEnd(16))}${chalk.gray(s.description)}`)
        }
        for (const a of allAgents) {
          console.log(`  ${chalk.yellow('/' + a.name.padEnd(16))}${chalk.gray(a.description)}`)
        }
        console.log('')
        continue
      }

      const cmdName = input.slice(1).split(' ')[0]
      const cmdArgs = input.slice(1).split(' ').slice(1).join(' ')

      // 1. 尝试内置命令（/help, /model, /new, /compact, /clear, /skills, /agents）
      const projectCtx = await buildProjectContext(workDir)
      const conversation = new Conversation(history, projectCtx)
      const cmdCtx: CommandContext = {
        args: cmdArgs,
        ui,
        history,
        llmConfig,
        workDir,
        skillRegistry,
        agentRegistry,
        conversation,
        commands: [],
      }
      const dispatched = await commandRegistry.dispatch(cmdName, cmdCtx)
      if (dispatched) {
        // 命令可能修改了 llmConfig.model，同步到 UI 提示符
        if (llmConfig.model) ui.setModelName(llmConfig.model)
        continue
      }

      // 2. 尝试 skill
      const skillDef = skillRegistry.get(cmdName)
      if (skillDef?.getPrompt) {
        const prompt = await skillDef.getPrompt(cmdArgs)
        const actualInput = `请执行技能 "${cmdName}": ${skillDef.description}\n\n${prompt}`
        console.log(chalk.cyan(`  → 调用技能: ${cmdName}`))

        const agentLoop = new AgentLoop({
          conversation,
          toolRegistry,
          toolCtx,
          skills: [],
          skillRegistry,
          agentRegistry,
          options: {
            llmConfig,
            confirmFn: ui.getConfirmFn(),
            askUserFn: ui.getAskUserFn(),
            onProgress: ui.getProgressFn(),
            projectMemory: projectMemory ?? undefined,
          },
        })

        try {
          const ctx = ui.createRenderContext()
          for await (const event of agentLoop.sendMessage(actualInput)) {
            ui.renderEvent(event, ctx)
          }
          ui.renderTail(ctx)
          history.length = 0
          history.push(...conversation.getMessages())
          await saveSession(workDir, history)
        } catch (err: unknown) {
          ui.stopSpinner()
          const msg = err instanceof Error ? err.message : String(err)
          ui.writeLine(chalk.red(`\n  执行出错: ${msg}\n`))
        }
        continue
      }

      // 3. 未知命令
      console.log(chalk.yellow(`\n  未知命令: /${cmdName}，输入 /help 查看帮助\n`))
      continue
    }

    // ─── 普通对话 ───────────────────────────────────────
    const projectCtx = await buildProjectContext(workDir)
    const conversation = new Conversation(history, projectCtx)

    const agentLoop = new AgentLoop({
      conversation,
      toolRegistry,
      toolCtx,
      skills: [],
      skillRegistry,
      agentRegistry,
      options: {
        llmConfig,
        confirmFn: ui.getConfirmFn(),
        askUserFn: ui.getAskUserFn(),
        onProgress: ui.getProgressFn(),
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

      // 持久化到磁盘
      await saveSession(workDir, history)
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
