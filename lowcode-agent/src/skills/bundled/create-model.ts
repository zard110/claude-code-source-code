/**
 * Create-Model Skill — 数据模型创建向导
 */
import type { SkillDefinition } from '../types.js'

const CREATE_MODEL_PROMPT = `# Create Model: 数据模型创建向导

你正在帮助用户创建一个新的数据模型（表结构）。按照以下步骤操作：

## 步骤 1: 收集需求

使用 ask_user 工具收集以下信息（如果用户没有提供）：

1. 模型名称和用途
2. 需要哪些字段（字段名、类型、是否必填）
3. 是否有枚举字段（如状态、类型等）

## 步骤 2: 设计模型结构

根据收集的信息，设计 JSON 模型结构：

- id: 模型唯一标识（英文 kebab-case）
- title: 模型中文名称
- type: 固定为 "model"
- tableName: 数据库表名（snake_case）
- fields: 字段列表

支持的字段类型：string、text、integer、bigint、decimal、boolean、datetime、date、enum、json

## 步骤 3: 创建文件

使用 write_json 工具创建模型文件，路径格式：models/<model-id>.json

## 模型模板

\`\`\`json
{
  "id": "model-id",
  "title": "模型名称",
  "type": "model",
  "tableName": "table_name",
  "fields": [
    { "name": "id", "type": "bigint", "label": "ID", "primaryKey": true },
    { "name": "title", "type": "string", "label": "名称", "required": true },
    { "name": "amount", "type": "decimal", "label": "金额" },
    { "name": "status", "type": "enum", "label": "状态", "options": ["选项1", "选项2"] },
    { "name": "remark", "type": "text", "label": "备注" },
    { "name": "createdAt", "type": "datetime", "label": "创建时间" }
  ]
}
\`\`\`

## 注意事项

- 如果用户提供了 $ARGUMENTS，用它作为模型创建的起点
- id 和 tableName 使用英文，id 用 kebab-case，tableName 用 snake_case
- 创建完成后，向用户展示模型字段概要`

export function registerCreateModelSkill(registry: import('../registry.js').SkillRegistry): void {
  const skill: SkillDefinition = {
    name: 'create-model',
    description: '数据模型创建向导，引导用户创建表结构 JSON',
    whenToUse: '当用户要求创建数据模型、表结构时使用',
    source: 'bundled',
    async getPrompt(args: string) {
      let prompt = CREATE_MODEL_PROMPT
      prompt = prompt.replace(/\$ARGUMENTS/g, args || '模型信息（需要通过 ask_user 收集）')
      return prompt
    },
  }
  registry.register(skill)
}
