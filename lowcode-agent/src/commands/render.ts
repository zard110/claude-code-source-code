/**
 * Command UI Render — 命令输出的终端渲染
 *
 * 所有命令的视觉输出集中在这里，方便统一风格。
 */
import chalk from 'chalk'
import type { CommandDefinition } from './types.js'
import type { SkillDefinition } from '../skills/types.js'
import type { AgentDefinition } from '../agents/types.js'
import type { LlmConfig } from '../agent/core.js'
import { getDefaultModel } from '../agent/core.js'

// ─── 辅助 ─────────────────────────────────────────────

const SEPARATOR = (title: string) => chalk.cyan.dim(`\n  ── ${title} ${'─'.repeat(Math.max(0, 42 - title.length))}\n`)

const sourceTag = (source?: string) =>
  source === 'file' ? chalk.blue(' [file]') : chalk.yellow(' [bundled]')

/** 获取所有可用模型 */
interface ModelEntry {
  name: string
  provider: string
}

export function getAllModels(): ModelEntry[] {
  const models: ModelEntry[] = []
  const prefixes = ['CENTIT', 'QWEN', 'DEEPSEEK', 'OPENAI']
  for (const prefix of prefixes) {
    const list = process.env[`${prefix}_MODELS`]
    if (list) {
      for (const m of list.split(',').map(s => s.trim())) {
        models.push({ name: m, provider: prefix.toLowerCase() })
      }
    }
  }
  return models
}

// ─── /help ────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  session: '会话管理',
  model: '模型',
  info: '信息',
}

export function renderHelp(
  commands: CommandDefinition[],
  skills: SkillDefinition[],
  agents: AgentDefinition[],
): void {
  // 按 category 分组
  const grouped = new Map<string, CommandDefinition[]>()
  for (const cmd of commands) {
    const list = grouped.get(cmd.category) ?? []
    list.push(cmd)
    grouped.set(cmd.category, list)
  }

  process.stdout.write(SEPARATOR('可用命令'))

  // 按固定顺序输出分类
  const order = ['session', 'model', 'info']
  for (const cat of order) {
    const list = grouped.get(cat)
    if (!list?.length) continue
    process.stdout.write(chalk.cyan(`  ${CATEGORY_LABELS[cat] ?? cat}\n`))
    for (const cmd of list) {
      const name = chalk.white.bold(`/${cmd.name.padEnd(16)}`)
      process.stdout.write(`    ${name}${chalk.gray(cmd.description)}\n`)
    }
    process.stdout.write('\n')
  }

  // 技能
  if (skills.length > 0) {
    process.stdout.write(SEPARATOR('技能'))
    for (const s of skills) {
      const name = chalk.white.bold(`/${s.name.padEnd(16)}`)
      process.stdout.write(`    ${name}${chalk.gray(s.description)}${sourceTag(s.source)}\n`)
    }
    process.stdout.write('\n')
  }

  // 子代理
  if (agents.length > 0) {
    process.stdout.write(SEPARATOR('子代理'))
    for (const a of agents) {
      const name = chalk.white.bold(`/${a.name.padEnd(16)}`)
      process.stdout.write(`    ${name}${chalk.gray(a.description)}${sourceTag(a.source)}\n`)
    }
    process.stdout.write('\n')
  }

  // 底部提示
  process.stdout.write(SEPARATOR('提示'))
  process.stdout.write(chalk.gray('    exit              退出程序\n'))
  process.stdout.write(chalk.gray('    直接输入消息       与 Agent 对话\n\n'))
}

// ─── /model ───────────────────────────────────────────

export function renderModelList(llmConfig: Partial<LlmConfig>): void {
  const current = llmConfig.model || getDefaultModel()
  const models = getAllModels()

  process.stdout.write(`\n  ${chalk.cyan('当前模型:')} ${chalk.white.bold(current)}\n\n`)
  process.stdout.write(chalk.cyan('  可用模型:\n'))

  for (const m of models) {
    const isCurrent = m.name === current
    const name = isCurrent ? chalk.green(m.name) : chalk.white(m.name)
    const provider = chalk.gray(`(${m.provider})`)
    const marker = isCurrent ? chalk.green.bold(' *') : ''
    process.stdout.write(`    ${marker ? marker + ' ' : '  '}${name.padEnd(18)}${provider}\n`)
  }

  process.stdout.write(chalk.gray('\n  切换: /model <名称>\n\n'))
}

// ─── /skills ──────────────────────────────────────────

export function renderSkillsList(skills: SkillDefinition[]): void {
  if (skills.length === 0) {
    process.stdout.write(chalk.gray('\n  暂无已加载的技能\n\n'))
    return
  }

  process.stdout.write(chalk.cyan(`\n  已加载 ${skills.length} 个技能:\n\n`))

  for (const s of skills) {
    const name = chalk.white.bold(s.name.padEnd(18))
    const desc = chalk.gray(s.description)
    process.stdout.write(`    ${name}${desc}${sourceTag(s.source)}\n`)
  }
  process.stdout.write('\n')
}

// ─── /agents ──────────────────────────────────────────

export function renderAgentsList(agents: AgentDefinition[]): void {
  if (agents.length === 0) {
    process.stdout.write(chalk.gray('\n  暂无已加载的子代理\n\n'))
    return
  }

  process.stdout.write(chalk.cyan(`\n  已加载 ${agents.length} 个子代理:\n\n`))

  for (const a of agents) {
    const name = chalk.white.bold(a.name.padEnd(18))
    const desc = chalk.gray(a.description)
    const tools = a.allowedTools
      ? chalk.dim(` [${a.allowedTools.join(', ')}]`)
      : ''
    process.stdout.write(`    ${name}${desc}${sourceTag(a.source)}${tools}\n`)
  }
  process.stdout.write('\n')
}
