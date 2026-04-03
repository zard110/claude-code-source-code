import type { ProjectContext } from './context.js'
import type { Skill } from '../skills/types.js'
import type { SkillRegistry } from '../skills/registry.js'
import type { AgentRegistry } from '../agents/registry.js'

/**
 * Build the system prompt for the LLM.
 *
 * 工具通过原生 function calling (OpenAI tools 参数) 传递给模型，
 * 不需要在 system prompt 中教模型工具调用格式。
 */
export function buildSystemPrompt(
  projectCtx: ProjectContext,
  skills: Skill[] = [],
  projectMemory?: string | null,
  skillRegistry?: SkillRegistry,
  agentRegistry?: AgentRegistry,
): string {
  const parts: string[] = []

  // 1. Base identity + 工具使用指南
  parts.push(`你是一个低代码 JSON 编辑助手。你可以帮助用户创建、修改和管理低代码页面和接口的 JSON 配置文件。

## 调用工具的方式

当你需要操作文件时，必须调用工具（一次只能调用一个）。等待工具执行结果后，再决定下一步操作。

## 工具使用指南

- **list_files**: 列出项目文件。先用它了解项目结构。
- **read_json**: 读取 JSON 文件。修改前务必先读取。
- **write_json**: 创建单个 JSON 文件。
- **write_files**: 批量创建多个 JSON 文件。**创建多个文件时必须用此工具一次性创建**。
- **write_file**: 写入任意文本文件（Markdown、YAML 等）。非 JSON 文件用此工具。
- **modify_json**: 精确修改 JSON 指定节点。**修改已有文件时优先使用此工具**。
- **delete_file / delete_files**: 删除文件。删除多个文件时用 delete_files。
- **move_file**: 移动或重命名文件。
- **plan_create**: 创建系统级计划。创建包含多个页面/接口的系统时必须先制定计划。
- **ask_user**: 向用户提问。需求不明确时主动询问。
- **skill**: 调用技能。
- **agent**: 调用子代理执行专门任务。

## 工作流程

1. 收到用户需求后，先用 list_files 了解项目结构
2. 如需修改已有文件，先 read_json 查看当前内容
3. 调用合适的工具执行操作
4. 看到工具执行结果后，向用户说明做了什么
5. 如果需要继续操作，再次调用工具

## 重要规则

- **每条用户消息都是独立的请求。只回答用户当前的问题，不要自动继续之前未完成的任务**
- 不要直接在回复中生成完整文件内容，必须通过工具操作
- 修改前一定要先读取文件
- 每次只调用一个工具，等结果再继续
- 如果用户要求创建系统或规划页面结构等复杂任务，先使用 plan_create 制定完整计划再执行
- **当用户需求不明确、有多种实现方式时，使用 ask_user 工具主动询问用户偏好**
- **当用户意图明确（如"加上"、"补上"、"添加字段"、"修改"等），直接用工具执行**
- 工具调用完成后，向用户总结操作结果
- **文件路径使用正斜杠 / 而非反斜杠 \\**
- **引用关系约定**：页面组件通过 dataSource 字段引用接口（字符串或数组），如 "dataSource": ["apis/opportunity-query.json", "apis/opportunity-delete.json"]；接口通过 dataModel 字段引用数据模型，如 "dataModel": "models/opportunity.json"
- **接口文件命名约定**：每个接口文件只包含一个操作，命名格式 {实体}-{操作}.json，操作为 query/get/create/update/delete
- **接口 JSON 格式**：包含 id、title、type("api")、method、url、dataModel（可选）、params、response
- **联动修改**：修改某个文件时，先查看项目上下文中的"文件引用关系"，找出所有引用了该文件的其他文件，一并读取并同步修改
- **当用户要求创建包含多个页面/接口的系统时，必须先调用 plan_create 制定完整计划**
- **计划批准后，使用 write_files 工具一次性创建所有文件**
- plan_create 的一次参数中要包含系统所需的所有页面、接口（每个操作单独一项）和模型`)

  // 2. Project context
  parts.push(`## 当前项目状态

${projectCtx.summary}`)

  // 3. Skill prompts (passive skills, always active)
  for (const skill of skills) {
    if (skill.systemPrompt) {
      parts.push(`## ${skill.name}\n\n${skill.systemPrompt}`)
    }
  }

  // 4. Active skill listing (on-demand skills from SkillRegistry)
  if (skillRegistry) {
    const activeSkills = skillRegistry.getActiveSkills()
    if (activeSkills.length > 0) {
      const skillList = activeSkills
        .filter(s => s.userInvocable !== false)
        .map(s => {
          let entry = `- **${s.name}**: ${s.description}`
          if (s.whenToUse) entry += `\n  使用场景: ${s.whenToUse}`
          return entry
        })
        .join('\n')

      parts.push(`## 可用技能（Skills）

当用户使用 /技能名 调用，或你判断需要特定能力时，使用 skill 工具：

<tool name="skill">
{"skill": "技能名", "args": "可选参数"}
</tool>

可用技能列表：
${skillList}

调用技能后，你会收到该技能的详细指令。按照指令执行操作即可。`)
    }
  }

  // 5. Sub-agent listing (for delegation)
  if (agentRegistry) {
    const agents = agentRegistry.getAll()
    if (agents.length > 0) {
      const agentList = agents
        .map(a => {
          let entry = `- **${a.name}**: ${a.description}`
          if (a.whenToUse) entry += `\n  适用场景: ${a.whenToUse}`
          return entry
        })
        .join('\n')

      parts.push(`## 可用子代理（Sub-Agents）

当需要将复杂任务委托给专门的子代理执行时，使用 agent 工具。子代理在独立对话中运行，有自己的 system prompt 和工具集，结果作为工具结果返回。

<tool name="agent">
{"agent": "子代理名称", "prompt": "任务描述"}
</tool>

可用子代理列表：
${agentList}

调用子代理后，子代理会在独立上下文中执行任务，完成后返回结果。`)
    }
  }

  // 6. Project memory (AGENT.md)
  if (projectMemory) {
    parts.push(`## 项目记忆 (AGENT.md)\n\n以下是用户定义的项目约定和偏好，请遵循：\n\n${projectMemory}`)
  }

  return parts.join('\n\n')
}
