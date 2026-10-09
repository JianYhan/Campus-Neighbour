# Campus Neighbour

校园二手交易平台 · JC2001 Introduction to Software Engineering

## 现在是什么阶段？

**main 分支维护八份工程文档和申报材料，当前正在安排九人分工与评审。** 实现代码位于[开发分支](https://github.com/JianYhan/Campus-Neighbour/tree/feat/campus-neighbour-app)；各功能是否完成，应结合该分支的实际版本和验证证据核对。

项目以校园二手交易为主线：发布 → 搜索 → 买卖双方聊天 → 预约线下面交 → 买家确认收货 → 评价。校园楼栋／课程检索、简介、季节专区和一对一换物保留在计划范围。支持中文／英文及深浅主题；支付入口仅展示“暂时无法提供支付方式”。

初稿覆盖全流程，但不代表所有业务规则已经获团队批准。九人岗位负责人已确定，具体任务审核人、内部日期和进度仍待填写；部分文档保留前期“未实现／未验证”状态，接手任务时需核对并更新，不能据此重复开发已有功能。

## 从哪里开始读？

- **查看已确定的九人分工：** [九人分工与项目协作手册](docs/team-workflow.md)。包含岗位姓名、任务、学习与阅读入口、首轮任务、完整交接流程及最终提交责任。
- **先了解项目：** [团队阅读版](docs/team-guide.md)。
- **看具体操作：** [功能与页面设计](docs/product-design.md)，包含13个页面、文字线框、买卖及换物状态。
- **核对范围和规则：** [需求说明书](docs/requirements.md)。重点讨论D01—D13待定事项，再按负责内容看其他文档。

## 8份工程文档

| 编号 | 文档 | 回答什么问题 | 状态 |
| --- | --- | --- | --- |
| 1 | [软件需求规格说明书](docs/requirements.md) | 做什么、谁能做、怎样验收？ | v0.2讨论稿 |
| 2 | [功能与页面设计](docs/product-design.md) | 页面显示什么，点击后怎样变化？ | v0.1完整初稿 |
| 3 | [技术选型与系统架构](docs/architecture.md) | 技术与模块如何配合？ | v0.1完整初稿 |
| 4 | [数据库设计](docs/database.md) | 保存什么，怎样避免数据冲突？ | v0.1完整初稿 |
| 5 | [接口契约](docs/api/README.md) | 前后端如何交换请求、结果与消息？ | v0.1完整初稿 |
| 6 | [开发协作与任务计划](CONTRIBUTING.md) · [九人分工与流程](docs/team-workflow.md) | 如何按TDD开发、分工、交接、审查与合并？ | 岗位名单已确定，任务细节待填写 |
| 7 | [测试计划与验收记录](docs/testing.md) | 先写哪些测试，怎样记录真实结果？ | v0.1完整初稿，测试未执行 |
| 8 | [部署运行与用户说明](docs/operations.md) | 怎样部署、恢复和使用？ | v0.1完整初稿，运行未验证 |

“完整初稿”指已覆盖设计范围和评审内容。接口当前采用可阅读的字段与端点契约，机器可校验OpenAPI将在相关接口开工前补齐；实际测试和运行证据在实施后记录。

## 技术栈与运行环境

| 类别 | 组件 | 版本／说明 | 验证状态 |
| --- | --- | --- | --- |
| 前端 | React + TypeScript + Vite | 包管理 pnpm（版本见 `.nvmrc` / `pnpm-lock.yaml`） | 已在 macOS 本机运行 |
| 后端 | Java + Spring Boot | 使用仓库自带 Maven Wrapper（`mvnw`），Java 21 | 已在 macOS 本机运行 |
| 数据库 | PostgreSQL | 以 `infra` 中 Compose 配置为准 | 已在 macOS 本机运行 |
| 缓存／会话 | Redis | 以 Compose 配置为准 | 已在 macOS 本机运行 |
| 容器 | Docker / Docker Compose | 启动 PostgreSQL 与 Redis 等依赖服务 | 已在 macOS 本机运行 |
| CI | GitHub Actions（`.github/workflows/checks.yml`） | 前端检查、后端 Maven 验证、Playwright 浏览器检查 | 已配置；运行失败原因待排查 |

> 验证状态说明：“已在 macOS 本机运行”指 R7 已在 macOS 个人电脑上配置环境并完成本地启动，验证了页面访问、登录和商品查看（基于 `feat/campus-neighbour-app` 分支）；其他操作系统复现、完整交易流程及线上部署尚未验证。各组件最终版本以 R1 选型确认和实际配置文件为准。

## 快速启动（基于 macOS 验证）

```bash
# 1. 切换到开发分支
git checkout feat/campus-neighbour-app

# 2. 复制环境变量模板并按需填写（勿提交真实密码或密钥）
cp .env.example .env

# 3. 启动 PostgreSQL、Redis 等依赖服务
docker compose up -d

# 4. 安装前端依赖并启动前端
pnpm install
pnpm dev

# 5. 启动后端（Spring Boot）
./mvnw spring-boot:run
```

> 以上为概要流程；具体命令、端口与配置以 [docs/operations.md](docs/operations.md) 和开发分支实际配置为准。
> 当前已验证内容（macOS，`feat/campus-neighbour-app` 分支）：网页可打开、可登录、可查看商品信息。聊天、预约、确认收货等完整流程及跨设备复现尚未验证。

## 开发方式：TDD

项目已确定采用**测试驱动开发（TDD）**：

1. 选一个小行为，先写测试并运行，确认因缺少目标行为而失败（Red）。
2. 写必要实现，让测试通过（Green）。
3. 在测试保护下整理代码，再运行测试（Refactor）。

缺陷修复先补失败的复现测试。交易并发使用真实数据库测试；前端交互也先写行为测试。提交时说明测试先行过程和最终结果，不要求把失败测试合入主分支。详细规则见[协作规范](CONTRIBUTING.md)与[测试计划](docs/testing.md)。

## 聊天功能说明

“问价格、问物品状态、问交易地点”是买卖双方聊天中的快捷问题，由交易对方回复；另有暂定每条20个可见字符的自由消息，可连续发送。该功能不是AI自动问答。完整英文固定模板的长度例外是待评审建议。

## 接下来做什么？

1. 阅读并记录评审意见：文档章节／FR编号、当前描述、建议和例子。
2. 确认待定业务规则及技术版本验证计划，同步8份文档。
3. 按已确定的岗位落实具体任务及审核人，核对已有实现、环境和测试证据。
4. 领取小任务：已有功能进行独立验收和缺陷修复，未完成行为按TDD逐步实现。

课程节点见[文档与开发路线](docs/document-roadmap.md)，任务接手与交接见[协作手册](docs/team-workflow.md)。路线中的阶段状态保留早期规划；实际运行命令应结合开发分支核验后同步到运行说明。

## 部署与交付状态（R7）

- **已完成：** GitHub 仓库基础结构与 README 维护；依赖清单草稿（见上表）；macOS 本地环境配置与启动验证（页面访问、登录、商品查看）。
- **待验证：** 聊天、预约、确认收货等完整交易流程；其他组员按本说明独立启动复现；CI 工作流失败原因排查（与 R6 协作）。
- **待确认：** 线上部署平台、域名与生产环境配置（Nginx／HTTPS 为计划内容，尚未实施）。

后续复现与验证结果将更新到[部署运行与用户说明](docs/operations.md)，并区分“已验证”与“待验证”步骤。

## 辅助材料与下载

- [项目申报书（在线阅读）](docs/proposal.md)
- [申报书与四份课件的对应说明](docs/proposal-course-alignment.md)：需求工程、增量开发、TDD、项目管理如何体现在方案中。
- [技术选型评审背景](docs/technology-review.md)
- [修改记录](docs/changes.md)
- [申报书Word](docs/downloads/Campus_Neighbour_Proposal.docx) · [申报书PDF](docs/downloads/Campus_Neighbour_Proposal.pdf)
- [需求说明书Word（v0.2）](docs/downloads/Campus_Neighbour_SRS.docx)

申报书、团队阅读版、路线和修改记录属于辅助材料，不另计入8份工程文档。新补设计以仓库Markdown为维护版本；现有Word/PDF导出对应申报书和需求说明书，不包含所有新增工程文档。

申报书 Markdown、Word 和 PDF 已于2026年9月23日同步补充课程内容；访谈、学生试用和每周评审均按计划描述，实际执行证据应另行记录。
