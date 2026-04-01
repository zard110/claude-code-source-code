import { describe, it, expect, beforeEach } from 'vitest'
import { PlanState, formatPlanSummary, planCreateSchema, buildBatchExecutionPrompt } from '../src/agent/plan.js'

const samplePlan = {
  title: '考勤管理系统',
  description: '包含考勤记录、请假管理等模块',
  items: [
    { type: 'page' as const, name: 'attendance-record', description: '考勤打卡记录', filePath: 'pages/attendance-record.json' },
    { type: 'page' as const, name: 'leave-request', description: '请假申请', filePath: 'pages/leave-request.json' },
    { type: 'api' as const, name: 'attendance-api', description: '考勤数据接口', filePath: 'apis/attendance-api.json' },
  ],
}

describe('PlanState', () => {
  let state: PlanState

  beforeEach(() => {
    state = new PlanState()
  })

  it('初始状态无计划', () => {
    expect(state.getPlan()).toBeNull()
    expect(state.isPlanApproved()).toBe(false)
    expect(state.isBatchMode()).toBe(false)
  })

  it('setPlan 设置计划但未批准', () => {
    state.setPlan(samplePlan)
    expect(state.getPlan()).toEqual(samplePlan)
    expect(state.isPlanApproved()).toBe(false)
    expect(state.isBatchMode()).toBe(false)
  })

  it('approve 批准计划进入批量模式', () => {
    state.setPlan(samplePlan)
    state.approve()
    expect(state.isPlanApproved()).toBe(true)
    expect(state.isBatchMode()).toBe(true)
  })

  it('reject 清除计划', () => {
    state.setPlan(samplePlan)
    state.approve()
    state.reject()
    expect(state.getPlan()).toBeNull()
    expect(state.isPlanApproved()).toBe(false)
    expect(state.isBatchMode()).toBe(false)
  })

  it('clear 重置所有状态', () => {
    state.setPlan(samplePlan)
    state.approve()
    state.clear()
    expect(state.getPlan()).toBeNull()
    expect(state.isPlanApproved()).toBe(false)
    expect(state.isBatchMode()).toBe(false)
  })

  it('setPlan 覆盖之前的计划并重置批准状态', () => {
    state.setPlan(samplePlan)
    state.approve()
    const newPlan = { ...samplePlan, title: '新系统' }
    state.setPlan(newPlan)
    expect(state.getPlan()?.title).toBe('新系统')
    expect(state.isPlanApproved()).toBe(false)
    expect(state.isBatchMode()).toBe(false)
  })
})

describe('planCreateSchema', () => {
  it('验证合法计划', () => {
    const result = planCreateSchema.safeParse(samplePlan)
    expect(result.success).toBe(true)
  })

  it('缺少 title 时失败', () => {
    const result = planCreateSchema.safeParse({
      description: '描述',
      items: samplePlan.items,
    })
    expect(result.success).toBe(false)
  })

  it('空 items 时失败', () => {
    const result = planCreateSchema.safeParse({
      title: '系统',
      description: '描述',
      items: [],
    })
    expect(result.success).toBe(false)
  })

  it('item type 不合法时失败', () => {
    const result = planCreateSchema.safeParse({
      title: '系统',
      description: '描述',
      items: [{ type: 'invalid', name: 'test', description: '测试', filePath: 'test.json' }],
    })
    expect(result.success).toBe(false)
  })

  it('item 缺少 filePath 时失败', () => {
    const result = planCreateSchema.safeParse({
      title: '系统',
      description: '描述',
      items: [{ type: 'page', name: 'test', description: '测试' }],
    })
    expect(result.success).toBe(false)
  })
})

describe('formatPlanSummary', () => {
  it('格式化计划摘要', () => {
    const result = formatPlanSummary(samplePlan)
    expect(result).toContain('考勤管理系统')
    expect(result).toContain('考勤打卡记录')
    expect(result).toContain('请假申请')
    expect(result).toContain('考勤数据接口')
    expect(result).toContain('共 3 项')
  })

  it('包含类型标识', () => {
    const result = formatPlanSummary(samplePlan)
    expect(result).toContain('页面')
    expect(result).toContain('接口')
  })
})

describe('buildBatchExecutionPrompt', () => {
  it('生成批量执行提示词', () => {
    const result = buildBatchExecutionPrompt(samplePlan)
    expect(result).toContain('考勤管理系统')
    expect(result).toContain('已批准')
    expect(result).toContain('pages/attendance-record.json')
    expect(result).toContain('pages/leave-request.json')
    expect(result).toContain('apis/attendance-api.json')
    expect(result).toContain('write_json')
  })

  it('列出所有计划项', () => {
    const result = buildBatchExecutionPrompt(samplePlan)
    expect(result).toContain('1.')
    expect(result).toContain('2.')
    expect(result).toContain('3.')
  })
})
