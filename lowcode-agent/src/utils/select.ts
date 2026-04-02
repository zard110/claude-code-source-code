/**
 * Interactive Prompts — 基于 @clack/prompts 的终端交互
 *
 * 提供通用的 select / text / confirm，可在命令、技能等场景复用。
 * @clack/prompts 被 create-vite、create-astro 等主流项目使用。
 */
import * as clack from '@clack/prompts'
import type { Option } from '@clack/prompts'

export { clack }

// ─── 交互式选择 ─────────────────────────────────────────

export interface SelectOption<T = string> {
  label: string
  /** 右侧提示文字（灰色） */
  hint?: string
  value: T
}

/**
 * 交互式上下选择
 *
 * @returns 选中的 value，取消返回 undefined
 */
export async function select<T>(
  message: string,
  options: SelectOption<T>[],
  opts?: { defaultValue?: T },
): Promise<T | undefined> {
  const result = await clack.select({
    message,
    options: options.map(o => ({
      label: o.label,
      value: o.value,
      ...(o.hint ? { hint: o.hint } : {}),
    })) as Option<T>[],
    initialValue: opts?.defaultValue,
  })

  if (clack.isCancel(result)) return undefined
  return result as T
}

// ─── 文本输入 ───────────────────────────────────────────

export interface TextConfig {
  placeholder?: string
  defaultValue?: string
  validate?: (value: string) => string | undefined
}

/**
 * 文本输入
 *
 * @returns 输入内容，取消返回 undefined
 */
export async function text(
  message: string,
  config?: TextConfig,
): Promise<string | undefined> {
  const result = await clack.text({
    message,
    placeholder: config?.placeholder,
    defaultValue: config?.defaultValue,
    validate: config?.validate
      ? (v: string | undefined) => config.validate!(v ?? '') || undefined
      : undefined,
  })

  if (clack.isCancel(result)) return undefined
  return result as string
}

// ─── 确认 ───────────────────────────────────────────────

/**
 * 是/否确认
 *
 * @returns true/false，取消返回 undefined
 */
export async function confirm(
  message: string,
  opts?: { defaultValue?: boolean },
): Promise<boolean | undefined> {
  const result = await clack.confirm({
    message,
    initialValue: opts?.defaultValue ?? true,
  })

  if (clack.isCancel(result)) return undefined
  return result as boolean
}

// ─── 日志输出 ───────────────────────────────────────────

export const log = {
  info: (message: string) => clack.log.info(message),
  success: (message: string) => clack.log.success(message),
  warn: (message: string) => clack.log.warn(message),
  error: (message: string) => clack.log.error(message),
  step: (message: string) => clack.log.step(message),
}
