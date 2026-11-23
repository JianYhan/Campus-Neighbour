# R6 自动化与质量记录 · 2026-11-23

分支：test/r6-account-listing。开始时工作区干净；已有 AccountsTest、CatalogTest、ChatRulesTest、FlowsTest 及 Playwright 流程，未删除或重复新增对应模块。

新增 ChatTest（9 个展开用例）、TradingTest（14 个展开用例），预约与交易共用 Trading 服务，没有虚构 Reservation/Transaction 类。新增 1 个真实注册、进入资料及刷新会话的 Playwright 测试。未修改业务实现、未 push/merge/创建 PR。

验证：Maven 离线 test-compile 成功。独立 JUnit 首次发现 65 项，4 通过、61 因 Mockito 动态 agent 初始化失败；属于环境失败，不是业务断言失败。随后改用显式 Mockito javaagent 重试，最终结果见下方追加记录。新增 Java 已按现有 prettier-plugin-java 格式化。

E2E 未执行：项目缺少 apps/web/node_modules/.bin/playwright，本机未找到 Docker 命令，真实服务前提不齐。不声称浏览器用例通过。资料页文案断言仍需在可运行环境验证。

CI：已检查 .github/workflows 的 frontend/backend/browser 工作及 Playwright 双 webServer 配置。现有提交历史包含等待聊天访问撤销状态的测试修正，但没有本轮远程失败日志，无法确认现时 CI 故障。历史依赖 403 不等于当前远程失败原因。未为推测原因修改工作流。

下一步：补齐浏览器与真实服务环境，运行新增 E2E 和 FlowsTest；取得远程 Actions run/step 日志；补预约成功路径、并发竞争与真实幂等持久化验证。R5 负责人工计划、冒烟、探索及复测，R6 负责自动化及结果；R5/R6 职责分工已由用户在 2026-11-23 明确确认并要求标记为双方已确认。

最终重试：显式使用缓存中的 mockito-core JAR 作为 javaagent，独立 JUnit 执行 65 项，65 通过、0 失败、0 跳过；其中本轮新增 23 项。此结果不包括 FlowsTest 或 E2E，也不代表 Maven verify 或远程 CI 通过。无需修改业务代码。

## 收尾验证与分工确认（2026-11-23）

- 核对全部未提交内容，仅含本轮 Chat/Trading 测试、一个 E2E 和两份测试文档；业务代码、锁文件和 CI 未修改。注册资料 E2E 改为等待 /profile 跳转并断言昵称输入框值，修正原先不适用的页面文本断言。
- `pnpm install --frozen-lockfile` 成功（使用临时 store，锁文件未变化）。Chromium 下载已尝试，但下载未完成即中止；不声称浏览器安装成功。
- 实际执行新增 Playwright 用例：后端 webServer 未启动，首次为 ~/.m2/wrapper 写权限错误；改用工作区 MAVEN_USER_HOME 后仍启动失败。本轮没有执行到浏览器业务断言。Docker 命令及 /Applications/Docker.app 均不存在，不能启动项目 Compose 服务。
- Playwright `--list --grep` 成功发现新增用例 1 项，证明测试可被框架加载，不等于执行通过。
- 后端独立 JUnit 复跑：65 通过、0 失败；前端 Vitest：7 文件、28 项通过；项目 `pnpm format:check` 全部通过，`git diff --check` 通过。
- R5 人工测试 / R6 自动化职责：双方已确认。确认日期 2026-11-23，依据为用户在本次对话明确要求记录为双方已确认；已同步 Testing Strategy。
- 未解决：真实服务 E2E、FlowsTest 和远程 Actions 结果尚未验证；下一步在有 Docker、Maven 可用且浏览器安装完整的环境运行。当前 65 项仅为选定单元测试，28 项为前端测试，不能汇总成全系统验收通过。
