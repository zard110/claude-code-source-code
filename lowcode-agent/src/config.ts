/**
 * 默认配置 — 内置 API，用户无需配置即可使用
 *
 * 优先级：环境变量 > 项目 .env.local > 此默认值
 * 用户如需用自己的 key，设环境变量即可覆盖。
 */

// 简单混淆：base64 编码，运行时解码
function _d(s: string): string {
  return Buffer.from(s, 'base64').toString('utf-8')
}

const DEFAULTS: Record<string, string> = {
  AI_PROVIDER: 'centit',
  // Centit
  CENTIT_BASE_URL: _d('aHR0cHM6Ly9jbG91ZC5jZW50aXQuY29tL2xvY29kZS9hcGkvbGx2bQ=='),
  CENTIT_API_KEY: _d('Y2VudGl0LjE='),
  CENTIT_PLANNER_MODEL: 'qwq',
  CENTIT_MODELS: 'qwq',
  // Qwen（阿里云百炼）
  QWEN_BASE_URL: _d('aHR0cHM6Ly9jb2RpbmcuZGFzaHNjb3BlLmFsaXl1bmNzLmNvbS92MQ=='),
  QWEN_API_KEY: _d('c2stc3AtNjI3NDY2OTllYTk5NGNjMGJmMmI2NDE5NzA3YzA2Njg='),
  QWEN_PLANNER_MODEL: _d('cXdlbjMuNS1wbHVz'),
  QWEN_MODELS: _d('cXdlbjMuNS1wbHVzLGdsbS01LGdsbS00Ljcsa2ltaS1rMi41LE1pbmlNYXgtTTIuNQ=='),
}

/**
 * 初始化默认配置 — 将默认值注入 process.env（仅当环境变量不存在时）
 * 这样 dotenv 加载的 .env 可以覆盖默认值
 */
export function initDefaults(): void {
  for (const [key, value] of Object.entries(DEFAULTS)) {
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}
