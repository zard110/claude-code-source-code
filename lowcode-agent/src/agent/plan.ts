/**
 * Plan Mode — 计划模式管理
 *
 * 参考 Claude Code 的 EnterPlanModeTool / ExitPlanModeV2Tool 模式，
 * 简化为一个 plan_create 虚拟工具：
 * 1. LLM 调用 plan_create 提交计划
 * 2. 用户一次性审批
 * 3. 批量执行（跳过逐个确认）
 */
import { z } from 'zod'

// ─── Plan 类型 ──────────────────────────────────────────────

export interface PlanItem {
  /** 页面或接口 */
  type: 'page' | 'api'
  /** 英文标识，如 attendance-record */
  name: string
  /** 中文描述，如 考勤打卡记录 */
  description: string
  /** 文件路径，如 pages/attendance-record.json */
  filePath: string
}

export interface Plan {
  /** 系统名称 */
  title: string
  /** 系统描述 */
  description: string
  /** 计划项列表 */
  items: PlanItem[]
}

// ─── Plan Create 工具的输入 Schema ──────────────────────────

export const planCreateSchema = z.object({
  title: z.string().describe('系统名称'),
  description: z.string().describe('系统描述'),
  items: z.array(z.object({
    type: z.enum(['page', 'api']).describe('页面或接口'),
    name: z.string().describe('英文标识'),
    description: z.string().describe('中文描述'),
    filePath: z.string().describe('文件路径'),
  })).min(1).describe('计划项列表'),
})

export type PlanCreateInput = z.infer<typeof planCreateSchema>

// ─── PlanState — 管理计划和批量执行状态 ────────────────────────

export class PlanState {
  private currentPlan: Plan | null = null
  private approved = false

  setPlan(plan: Plan): void {
    this.currentPlan = plan
    this.approved = false
  }

  getPlan(): Plan | null {
    return this.currentPlan
  }

  approve(): void {
    this.approved = true
  }

  reject(): void {
    this.currentPlan = null
    this.approved = false
  }

  isPlanApproved(): boolean {
    return this.approved
  }

  /** 计划批准后返回 true — 批量模式下跳过单个确认 */
  isBatchMode(): boolean {
    return this.approved && this.currentPlan !== null
  }

  clear(): void {
    this.currentPlan = null
    this.approved = false
  }
}

// ─── 格式化计划摘要 ─────────────────────────────────────────

export function formatPlanSummary(plan: Plan): string {
  const lines: string[] = []
  lines.push(`  📋 计划: ${plan.title}`)
  lines.push(`  ${plan.description}`)
  lines.push('')
  lines.push('  ┌────┬──────┬──────────────────────┬──────────────────────────┐')
  lines.push('  │ #  │ 类型 │ 名称                 │ 描述                     │')
  lines.push('  ├────┼──────┼──────────────────────┼──────────────────────────┤')

  for (let i = 0; i < plan.items.length; i++) {
    const item = plan.items[i]
    const idx = String(i + 1).padEnd(2)
    const type = (item.type === 'page' ? '页面' : '接口').padEnd(4)
    const name = item.name.length > 18 ? item.name.slice(0, 17) + '…' : item.name.padEnd(18)
    const desc = item.description.length > 22 ? item.description.slice(0, 21) + '…' : item.description.padEnd(22)
    lines.push(`  │ ${idx} │ ${type} │ ${name} │ ${desc} │`)
  }

  lines.push('  └────┴──────┴──────────────────────┴──────────────────────────┘')
  lines.push(`  共 ${plan.items.length} 项`)
  return lines.join('\n')
}

// ─── 生成批量执行提示词 ─────────────────────────────────────────

export function buildBatchExecutionPrompt(plan: Plan): string {
  const items = plan.items
    .map((item, i) => `${i + 1}. ${item.description} (${item.type}) → ${item.filePath}`)
    .join('\n')

  return [
    '计划「' + plan.title + '」已批准。请使用 write_files 工具一次性创建所有文件：',
    '',
    items,
    '',
    '注意：',
    '- **使用 write_files 工具一次性创建所有文件，不要逐个调用 write_json**',
    '- 不需要再询问确认，直接创建即可',
    '- 每个文件的 content 必须包含完整的 JSON 对象',
    '- 创建完成后向用户总结操作结果',
  ].join('\n')
}
