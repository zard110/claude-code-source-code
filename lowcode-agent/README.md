# @centit/locode

AI 驱动的低代码 JSON 编辑助手 — 用自然语言创建页面和接口配置。

## 安装

```bash
npm i -g @centit/locode
# 或
pnpm i -g @centit/locode
```

安装即用，无需配置。

## 快速开始

```bash
# 进入你的低代码项目目录
cd my-project

# 启动
locode
```

然后直接用自然语言对话：

```
> 帮我创建一个客户列表页面
> 添加一个查询客户数据的接口
> 在表单里加上部门字段
> 列出所有页面和接口
```

## 命令

### 内置命令

| 命令 | 说明 |
|------|------|
| `/help` | 显示所有可用命令 |
| `/model` | 查看当前模型 |
| `/model qwq` | 切换模型 |
| `/new` | 清空聊天记录，开始新会话 |
| `/compact` | 手动压缩上下文 |
| `/clear` | 清屏 |
| `/skills` | 查看已加载技能 |
| `/agents` | 查看已加载子代理 |
| `exit` | 退出 |

### CLI 参数

```bash
locode [工作目录] [选项]

选项:
  -m, --model <name>      指定模型
  --fresh                 开始新会话（忽略历史记录）

示例:
  locode                    # 当前目录
  locode ./my-project       # 指定目录
  locode -m qwen3.5-plus    # 指定模型
  locode --fresh            # 全新会话
```

别名：`locode` 或 `lc`

```bash
lc ./my-project
```

## 技能

内置技能，可直接输入 `/技能名` 调用：

| 技能 | 说明 |
|------|------|
| `/simplify` | 审查并精简项目中的 JSON 文件 |
| `/create-page` | 页面创建向导，引导式生成页面配置 |

## 子代理

主代理会根据任务自动选择合适的子代理执行：

| 代理 | 说明 |
|------|------|
| **page-writer** | 专门创建和修改页面 JSON 配置 |
| **api-writer** | 专门创建和修改接口 JSON 配置 |
| **architect** | 分析项目现状，规划系统结构（只读） |
| **requirements-analyzer** | 将自然语言需求解析为结构化方案（只读） |

## 扩展

### 自定义技能

在项目根目录创建 `.skills/<名称>/SKILL.md`：

```markdown
---
description: 批量审查所有页面配置
kind: active
---

请检查以下所有页面 JSON 文件的完整性和一致性...
```

### 自定义子代理

在项目根目录创建 `.agents/<名称>/AGENT.md`：

```markdown
---
description: 数据导入配置代理
when_to_use: 当需要配置数据导入映射时使用
allowed_tools: list_files,read_json,write_json,modify_json,ask_user
max_iterations: 15
---

# Data Import Agent

你是一个专门的数据导入配置代理...
```

启动后会自动加载，`/help` 中可见。

同名文件会覆盖内置的技能/代理。

## 可用模型

```
> /model

  当前模型: qwq

  可用模型:
    qwq              (centit)    ← 当前
    qwen3.5-plus     (qwen)
    glm-5            (qwen)
    kimi-k2.5        (qwen)
```

切换模型：

```
> /model qwen3.5-plus
  ✓ 已切换模型: qwen3.5-plus
```

## SDK

编程方式调用，适合集成到其他工具或 CI：

```typescript
import { createSDK } from '@centit/locode'

const sdk = await createSDK({ workDir: './my-project' })

// 一次性查询
const result = await sdk.query('帮我创建一个用户列表页面')
console.log(result.text)

// 流式
for await (const event of sdk.stream('列出所有页面')) {
  if (event.type === 'assistant_text') {
    process.stdout.write(event.text)
  }
}
```

## 配置（可选）

默认已内置 AI 服务，安装即用。如需用自己的 key：

在项目目录创建 `.env.local`：

```bash
# 覆盖默认提供商
AI_PROVIDER=qwen

QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
QWEN_API_KEY=sk-your-key
QWEN_MODELS=qwen3.5-plus,qwen3
```

或直接设环境变量：

```bash
export CENTIT_API_KEY=your-key
locode ./my-project
```

## 工具列表

Agent 可使用的文件操作工具：

| 工具 | 说明 |
|------|------|
| `list_files` | 列出项目文件 |
| `read_json` | 读取 JSON 文件 |
| `write_json` | 创建单个 JSON 文件 |
| `write_files` | 批量创建多个文件 |
| `modify_json` | 精确修改 JSON 指定节点 |
| `delete_file` | 删除单个文件 |
| `delete_files` | 批量删除文件 |
| `move_file` | 移动或重命名文件 |
| `ask_user` | 向用户提问确认 |

## 技术架构

```
用户输入
  │
  ├─ /命令 → CommandRegistry → 内置命令处理
  │
  ├─ /技能名 → SkillRegistry → 注入 prompt
  │
  └─ 自然语言 → AgentLoop → LLM → 工具调用 → 文件操作
                                    │
                                    └─ 自动选择子代理 (page-writer / api-writer / ...)
```

## License

MIT
