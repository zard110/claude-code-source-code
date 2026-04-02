/**
 * Builtin Commands — 7 个内置命令的实现
 *
 * 每个命令是一个 CommandDefinition 对象，
 * 通过 registerBuiltinCommands() 统一注册。
 */
import chalk from 'chalk'
import type { CommandDefinition, CommandContext } from './types.js'
import { renderHelp, renderSkillsList, renderAgentsList } from './render.js'
import { getAllModels } from './render.js'
import { resolveLlmConfig, getDefaultModel } from '../agent/core.js'
import { saveSession } from '../agent/persistence.js'

// ─── /help ────────────────────────────────────────────

const helpCommand: CommandDefinition = {
  name: 'help',
  description: '显示可用命令和帮助信息',
  category: 'info',
  async handler(ctx) {
    renderHelp(
      ctx.commands,
      ctx.skillRegistry.getActiveSkills(),
      ctx.agentRegistry.getAll(),
    )
  },
}

// ─── /model ───────────────────────────────────────────

const modelCommand: CommandDefinition = {
  name: 'model',
  description: '查看或切换模型',
  usage: '/model [name]',
  category: 'model',
  async handler(ctx) {
    const newModel = ctx.args.trim()
    if (!newModel) {
      // 交互式选择
      const models = getAllModels()
      const current = ctx.llmConfig.model || getDefaultModel()

      // 显示列表（带编号）
      process.stdout.write(`\n  ${chalk.cyan('当前模型:')} ${chalk.white.bold(current)}\n\n`)
      for (let i = 0; i < models.length; i++) {
        const m = models[i]!
        const isCurrent = m.name === current
        const num = chalk.dim(`${i + 1}.`)
        const name = isCurrent ? chalk.green.bold(m.name) : chalk.white(m.name)
        const provider = chalk.gray(`(${m.provider})`)
        const marker = isCurrent ? chalk.green(' ←') : ''
        process.stdout.write(`    ${num} ${name.padEnd(18)}${provider}${marker}\n`)
      }
      process.stdout.write(chalk.gray('\n    回车取消，或输入编号/模型名: '))

      const answer = await new Promise<string>((resolve) => {
        process.stdin.once('data', (data) => {
          resolve(data.toString().trim())
        })
      })

      if (!answer) {
        process.stdout.write('\n')
        return
      }

      // 数字选择
      const num = parseInt(answer, 10)
      let selected: string
      if (!isNaN(num) && num >= 1 && num <= models.length) {
        selected = models[num - 1]!.name
      } else {
        selected = answer
      }

      const newConfig = resolveLlmConfig(selected)
      Object.assign(ctx.llmConfig, newConfig)
      process.stdout.write(chalk.green(`\n  ✓ 已切换模型: ${chalk.white.bold(selected)}\n\n`))
    } else {
      // 直接指定模型名
      const newConfig = resolveLlmConfig(newModel)
      Object.assign(ctx.llmConfig, newConfig)
      process.stdout.write(chalk.green(`\n  ✓ 已切换模型: ${chalk.white.bold(newModel)}\n\n`))
    }
  },
}

// ─── /new ─────────────────────────────────────────────

const newCommand: CommandDefinition = {
  name: 'new',
  description: '清空聊天记录，开始新会话',
  category: 'session',
  async handler(ctx) {
    ctx.history.length = 0
    await saveSession(ctx.workDir, ctx.history)
    process.stdout.write(chalk.green('\n  ✓ 已清空聊天记录，开始新会话\n\n'))
  },
}

// ─── /compact ─────────────────────────────────────────

const compactCommand: CommandDefinition = {
  name: 'compact',
  description: '压缩上下文，释放 token 空间',
  category: 'session',
  async handler(ctx) {
    const conv = ctx.conversation
    const before = conv.getEstimatedTokens()

    // 先尝试 micro-compact（不需要 API）
    const cleared = conv.applyMicroCompact()

    // 如果消息仍然很多，尝试完整 compact
    let compacted = 0
    if (conv.length > 20) {
      // 需要创建 LLM client 来做完整压缩
      const { createLlmClient, getDefaultModel } = await import('../agent/core.js')
      const client = createLlmClient(ctx.llmConfig)
      const model = ctx.llmConfig.model ?? getDefaultModel()
      compacted = await conv.compact(client, model)
    }

    const after = conv.getEstimatedTokens()
    const saved = before - after

    process.stdout.write(chalk.green(`\n  ✓ 上下文已压缩`))
    if (cleared > 0) process.stdout.write(chalk.gray(` (清理 ${cleared} 条工具结果)`))
    if (compacted > 0) process.stdout.write(chalk.gray(` (压缩 ${compacted} 条历史消息)`))
    if (saved > 0) process.stdout.write(chalk.gray(`，省约 ${saved} tokens`))
    process.stdout.write('\n\n')
  },
}

// ─── /clear ───────────────────────────────────────────

const clearCommand: CommandDefinition = {
  name: 'clear',
  description: '清屏',
  category: 'session',
  async handler() {
    console.clear()
  },
}

// ─── /skills ──────────────────────────────────────────

const skillsCommand: CommandDefinition = {
  name: 'skills',
  description: '查看已加载技能',
  category: 'info',
  async handler(ctx) {
    renderSkillsList(ctx.skillRegistry.getAll())
  },
}

// ─── /agents ──────────────────────────────────────────

const agentsCommand: CommandDefinition = {
  name: 'agents',
  description: '查看已加载子代理',
  category: 'info',
  async handler(ctx) {
    renderAgentsList(ctx.agentRegistry.getAll())
  },
}

// ─── 注册所有内置命令 ─────────────────────────────────

export function registerBuiltinCommands(
  register: (cmd: CommandDefinition) => void,
): void {
  register(helpCommand)
  register(modelCommand)
  register(newCommand)
  register(compactCommand)
  register(clearCommand)
  register(skillsCommand)
  register(agentsCommand)
}
