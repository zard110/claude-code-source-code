/**
 * Simplify Skill — 代码审查和简化
 *
 * Inspired by Claude Code's bundled simplify skill.
 * Reviews project files for quality issues and suggests improvements.
 */
import type { SkillDefinition } from '../types.js'

const SIMPLIFY_PROMPT = `# Simplify: 项目文件审查

审查当前项目中的所有 JSON 文件，检查以下问题并直接修复：

## 审查步骤

1. 先用 list_files 列出所有文件
2. 逐个读取文件内容（read_json）
3. 检查每个文件是否有以下问题：

### 质量检查
- **冗余字段**: 不使用的字段、重复定义的属性
- **命名一致性**: id、name、title 等字段命名风格是否统一
- **结构一致性**: 同类文件的 JSON 结构是否保持一致
- **缺失字段**: 必要字段是否缺失（如缺少 title、id 等）

### 简洁性检查
- **过度嵌套**: 不必要的深层嵌套结构
- **冗余配置**: 可以合并或简化的配置
- **默认值冗余**: 明确写了默认值的字段（可省略）

4. 发现问题后，使用 modify_json 逐一修复
5. 修复完成后，总结修改内容

## 注意事项

- 每次修改前先确认当前文件内容
- 一次只修改一个问题，确认成功后再继续
- 如果 $ARGUMENTS 不为空，优先关注用户指定的文件或方面
- 如果没有发现问题，直接告知用户代码质量良好`

export function registerSimplifySkill(registry: import('../registry.js').SkillRegistry): void {
  const skill: SkillDefinition = {
    name: 'simplify',
    description: '审查项目 JSON 文件的代码质量，修复冗余和不一致问题',
    whenToUse: '当用户要求审查代码质量、简化文件、检查一致性时使用',
    source: 'bundled',
    async getPrompt(args: string) {
      let prompt = SIMPLIFY_PROMPT
      if (args) {
        prompt = prompt.replace(/\$ARGUMENTS/g, args)
        prompt += `\n\n## 用户特别关注\n\n${args}`
      } else {
        prompt = prompt.replace(/\$ARGUMENTS/g, '所有文件')
      }
      return prompt
    },
  }
  registry.register(skill)
}
