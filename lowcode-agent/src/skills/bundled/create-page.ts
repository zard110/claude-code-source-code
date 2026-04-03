/**
 * Create-Page Skill — 低代码页面创建向导
 *
 * Guides the agent through creating a well-structured low-code page JSON.
 */
import type { SkillDefinition } from '../types.js'

const CREATE_PAGE_PROMPT = `# Create Page: 低代码页面创建向导

你正在帮助用户创建一个新的低代码页面。按照以下步骤操作：

## 步骤 1: 收集需求

使用 ask_user 工具收集以下信息（如果用户没有提供）：

1. 页面用途和标题
2. 页面类型（列表页 / 详情页 / 表单页 / 仪表盘）
3. 主要数据字段（如果是列表或表单）
4. 布局偏好（如果需要）

## 步骤 2: 设计页面结构

根据收集的信息，设计 JSON 页面结构。一个典型的低代码页面包含：

- id: 页面唯一标识
- title: 页面标题
- type: 页面类型
- layout: 布局配置
- components: 组件列表

## 步骤 3: 创建文件

使用 write_json 工具创建页面文件。文件路径格式：pages/<page-id>.json

## 页面模板

### 列表页模板
\`\`\`json
{
  "id": "page-id",
  "title": "页面标题",
  "type": "list",
  "layout": { "columns": 1 },
  "components": [
    {
      "type": "search-bar",
      "fields": []
    },
    {
      "type": "table",
      "columns": [],
      "dataSource": ["apis/resource-query.json"]
    }
  ]
}
\`\`\`

### 表单页模板
\`\`\`json
{
  "id": "page-id",
  "title": "页面标题",
  "type": "form",
  "layout": { "columns": 2 },
  "components": [
    {
      "type": "form",
      "fields": [],
      "actions": [
        { "type": "submit", "label": "提交" },
        { "type": "cancel", "label": "取消" }
      ]
    }
  ]
}
\`\`\`

## 注意事项

- 如果用户提供了 $ARGUMENTS，用它作为页面创建的起点
- 确保页面 id 使用 kebab-case（如 user-list, order-detail）
- 创建完成后，向用户展示页面概要`

export function registerCreatePageSkill(registry: import('../registry.js').SkillRegistry): void {
  const skill: SkillDefinition = {
    name: 'create-page',
    description: '低代码页面创建向导，引导用户通过问答创建页面 JSON',
    whenToUse: '当用户要求创建新页面但需求不够具体时使用',
    source: 'bundled',
    async getPrompt(args: string) {
      let prompt = CREATE_PAGE_PROMPT
      if (args) {
        prompt = prompt.replace(/\$ARGUMENTS/g, args)
      } else {
        prompt = prompt.replace(/\$ARGUMENTS/g, '页面信息（需要通过 ask_user 收集）')
      }
      return prompt
    },
  }
  registry.register(skill)
}
