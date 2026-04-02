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
import { select, clack } from '../utils/select.js'

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
      // 交互式选择（上下箭头 + 回车）
      const models = getAllModels()
      const current = ctx.llmConfig.model || getDefaultModel()

      if (models.length === 0) {
        clack.log.warn('暂无可用模型')
        return
      }

      const selected = await select<string>(
        `选择模型 (当前: ${current})`,
        models.map(m => ({
          label: m.name === current ? `${m.name}  ← 当前` : m.name,
          value: m.name,
          hint: m.provider,
        })),
        { defaultValue: current },
      )

      if (!selected) {
        clack.log.info('已取消')
        return
      }

      const newConfig = resolveLlmConfig(selected)
      Object.assign(ctx.llmConfig, newConfig)
      clack.log.success(`已切换模型: ${chalk.bold(selected)}`)
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
