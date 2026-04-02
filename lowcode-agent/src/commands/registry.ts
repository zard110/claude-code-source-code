/**
 * Command Registry — Slash 命令注册表
 *
 * 管理 /xxx 命令的注册、查找、分发。
 * 与 SkillRegistry / AgentRegistry 同一模式。
 */
import type { CommandDefinition, CommandContext } from './types.js'

export class CommandRegistry {
  private commands: Map<string, CommandDefinition> = new Map()

  /** 注册命令 */
  register(cmd: CommandDefinition): void {
    this.commands.set(cmd.name, cmd)
  }

  /** 查找命令 */
  get(name: string): CommandDefinition | undefined {
    return this.commands.get(name)
  }

  /** 获取所有命令 */
  getAll(): CommandDefinition[] {
    return Array.from(this.commands.values())
  }

  /** 按分类获取命令 */
  getByCategory(): Map<string, CommandDefinition[]> {
    const map = new Map<string, CommandDefinition[]>()
    for (const cmd of this.commands.values()) {
      const list = map.get(cmd.category) ?? []
      list.push(cmd)
      map.set(cmd.category, list)
    }
    return map
  }

  /**
   * 分发命令
   * @returns true 表示命令被处理，false 表示未找到
   */
  async dispatch(name: string, ctx: CommandContext): Promise<boolean> {
    const cmd = this.commands.get(name)
    if (!cmd) return false
    // 注入完整命令列表供 /help 使用
    ctx.commands = this.getAll()
    await cmd.handler(ctx)
    return true
  }
}
