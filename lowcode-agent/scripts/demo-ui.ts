/**
 * UI 演示脚本 — 不连接 LLM，模拟完整事件流展示终端效果
 *
 * 运行: npx tsx scripts/demo-ui.ts
 */

import chalk from 'chalk'
import { SpinnerManager } from '../src/utils/spinner.js'
import { toolBadge, highlightJson, previewBox, formatToolInput, formatToolResult, formatDiff } from '../src/utils/format.js'

const spinner = new SpinnerManager()

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function demo() {
  // ─── 1. 欢迎画面 ─────────────────────────────────
  console.log('')
  console.log(chalk.cyan.bold('  低代码 JSON Agent'))
  console.log(chalk.gray('  工作目录: ./demo'))
  console.log(chalk.gray('  输入需求，Enter 发送。输入 exit 退出。'))
  console.log('')

  // ─── 2. 用户输入 ─────────────────────────────────
  console.log(chalk.green.bold('> ') + '创建一个订单列表页面')
  console.log('')

  // ─── 3. Thinking 阶段 (spinner 动画) ─────────────
  spinner.startThinking()
  await sleep(2500)
  spinner.stop()

  const thinkTime = '2.5'
  console.log(chalk.dim(`  💭 思考完成 (${thinkTime}s)`))
  console.log('')

  // ─── 4. Assistant 文本流 ─────────────────────────
  const text = '我来创建订单列表页面。先看看项目现有文件，然后创建新的页面配置。'
  for (const char of text) {
    process.stdout.write(chalk.white(char))
    await sleep(30)
  }
  console.log('\n')

  // ─── 5. 工具调用: list_files ─────────────────────
  console.log(formatToolInput('list_files', { directory: 'pages' }))
  spinner.startTool('list_files')
  await sleep(1200)
  spinner.stop()

  console.log(formatToolResult('list_files', true, '找到 3 个 JSON 文件:\n  pages/user-list.json\n  pages/order-form.json\n  pages/dashboard.json'))
  console.log('')

  // ─── 6. 工具调用: read_json ──────────────────────
  console.log(formatToolInput('read_json', { file_path: 'pages/user-list.json' }))
  spinner.startTool('read_json')
  await sleep(800)
  spinner.stop()

  const userJson = JSON.stringify({
    id: 'user-list',
    title: '用户列表',
    type: 'list',
    components: [{ type: 'Table', props: { dataSource: '/api/users' } }]
  }, null, 2)

  console.log(formatToolResult('read_json', true, userJson))
  console.log('')

  // ─── 7. 写操作确认 ──────────────────────────────
  const orderJson = JSON.stringify({
    id: 'order-list',
    title: '订单列表',
    type: 'list',
    path: '/orders',
    components: [
      {
        type: 'Table',
        props: {
          dataSource: '/api/orders',
          columns: [
            { key: 'id', label: '订单号' },
            { key: 'customer', label: '客户' },
            { key: 'amount', label: '金额' },
            { key: 'status', label: '状态' },
          ]
        }
      }
    ]
  }, null, 2)

  console.log(chalk.yellow('  ⚠ 需要确认: 写入文件 pages/order-list.json'))
  console.log(previewBox('write_json: pages/order-list.json', highlightJson(orderJson, 15)))
  console.log(chalk.yellow('  确认执行? (y/n): ') + 'y')
  console.log(chalk.green('  ✓ 已确认'))
  console.log('')

  // ─── 8. 工具调用: write_json ─────────────────────
  console.log(formatToolInput('write_json', { file_path: 'pages/order-list.json', content: '{...}' }))
  spinner.startTool('write_json')
  await sleep(600)
  spinner.stop()

  console.log(formatToolResult('write_json', true, '已写入文件 "pages/order-list.json" (287 bytes)'))
  console.log('')

  // ─── 9. Diff 展示 ────────────────────────────────
  console.log(chalk.dim('  ── 文件变更 ──'))
  console.log(formatDiff([
    { path: 'pages/order-list.json', oldValue: null, newValue: 'created', type: 'added' },
  ]))
  console.log('')

  // ─── 10. 完成回复 ────────────────────────────────
  const finalText = '已创建订单列表页面 pages/order-list.json，包含订单号、客户、金额和状态四列。数据源为 /api/orders。'
  for (const char of finalText) {
    process.stdout.write(chalk.white(char))
    await sleep(25)
  }
  console.log('\n')

  // ─── 11. Badge 展示 ──────────────────────────────
  console.log(chalk.dim('  ── 工具 Badge 展示 ──'))
  const tools = ['read_json', 'write_json', 'modify_json', 'delete_file', 'list_files']
  console.log('  ' + tools.map(t => toolBadge(t)).join('  '))
  console.log('')

  // ─── 12. JSON 语法高亮 ───────────────────────────
  console.log(chalk.dim('  ── JSON 语法高亮 ──'))
  console.log(highlightJson(orderJson))
  console.log('')

  // ─── 13. Stalled 效果说明 ────────────────────────
  console.log(chalk.dim('  ── Stalled 检测 ──'))
  console.log(chalk.gray('  当 spinner 超过 3 秒没收到新 token:'))
  console.log(chalk.cyan('  ⠹') + ' 正常状态 (青色 shimmer)')
  console.log(chalk.red('  ⠹') + ' Stalled 状态 (渐变为红色)')
  console.log('')
}

demo().catch(console.error)
