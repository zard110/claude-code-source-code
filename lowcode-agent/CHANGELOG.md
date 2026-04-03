# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-04-03

### 新增
- 使用 `@clack/prompts` 重写终端 UI，支持 `/` 命令内联自动补全（仿 Claude Code 风格）
- 模型名称显示在提示符中：`> [qwen3.5-plus]`
- 历史记录持久化，退出后保存到 `.agent/history`，下次启动自动恢复
- Ctrl+C 二次确认，防止误退出
- 交互式模型选择（上下箭头）
- 新增 `write_file` 工具，支持写入 Markdown、YAML、TXT 等任意文本文件
- 新增 Skills 系统，支持内置技能和文件加载自定义技能
- 新增 `src/utils/select.ts`，封装 clack 的 select/confirm/text 组件

### 修复
- 修复 agent 循环重试逻辑导致无限循环的问题：操作完成后模型总结文本被误判为"意图但未执行"
  - 完成标记优先检测（"已"、"成功"、"完成"等），不再对操作总结触发重试
  - 移除 `mentionsTool` 检查（文本提及工具名≠需要重试）
  - 收紧意图正则，只匹配明确的未来意图（"让我"/"我来" + 动作词）
  - 文本长度阈值从 800 降至 300，长文本直接视为正常回复
- 修复"你好"等纯对话触发 5 次无效迭代的问题（添加 `currentIteration > 1` 守卫）
- 修复自动压缩（auto-compact）可能卡死的问题：添加 30 秒超时 + 熔断器
- 修复 `/model` 命令选择后程序退出的问题
- 修复 `ask_user` 工具重复显示问题
- 修复模型输出 "continue" 文字时 agent 误停止的问题

### 变更
- 默认 provider 改为 qwen，默认模型改为 `qwen3.5-plus`
- `COMPACT_MESSAGE_COUNT` 阈值从 50 提升至 100，减少不必要的压缩
- `/model` 命令改用 clack 交互式 UI

## [0.1.0] - 2026-03-01

### 新增
- 初始发布：AI 驱动的低代码 JSON 编辑 Agent
- 支持自然语言创建、修改、删除低代码页面和接口配置文件
- 批量文件操作工具：`write_files`、`delete_files`
- 子代理（Sub-Agent）系统，支持任务委托
- 可扩展的 Slash 命令系统（`/model`、`/new`、`/compact`、`/help` 等）
- `ask_user` 虚拟工具，LLM 可主动向用户提问
- 终端 Markdown 渲染
- 上下文压缩（compact）：按消息数量和 token 用量自动触发
- 微压缩（micro-compact）：轻量级工具结果清理，无需 API 调用
- `-m/--model` CLI 参数支持启动时指定模型
- `<think>` 标签过滤，兼容 qwq 模型思考输出
- 任务边界保护，防止模型跨轮次继续旧任务

[0.2.0]: https://github.com/zard110/claude-code-source-code/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/zard110/claude-code-source-code/releases/tag/v0.1.0
