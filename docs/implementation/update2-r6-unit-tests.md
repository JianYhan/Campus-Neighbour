# Update2 · R6 第三项：账号与商品核心业务单元测试

负责人：R6 ZIYE JIANG  
执行日期：2026-11-01（Asia/Shanghai）

## 完成内容

为已开发的账号与商品服务补充 JUnit Jupiter + Mockito 单元测试，不启动 Spring 上下文、PostgreSQL、Redis 或 Docker。未修改业务实现、数据库结构或 CI 定义。

| 文件 | 执行用例数（含参数化展开） | 覆盖行为 |
| --- | ---: | --- |
| `apps/api/src/test/java/campus/neighbour/AccountsTest.java` | 11 | 匿名访问、服务端身份、限制账号拒绝写入、管理员权限、邮箱与密码校验、禁止注册时指定角色、邮箱规范化和密码编码、密码比对、公开资料字段 |
| `apps/api/src/test/java/campus/neighbour/CatalogTest.java` | 27 | 公开详情可见性、所有者查看、越权修改、占用及完成状态、版本冲突、价格上下限与小数、必填标题、分类引用、图片数量和重复、图片归属与复用、图片顺序、上下架和冲突拒绝 |
| 现有 `ChatRulesTest.java` | 4 | 聊天规则回归 |

需求追踪：对应现有测试计划 T01/T02/T03/T04 的服务层子场景；不等于这些验收场景已完整通过。注册的唯一邮箱约束、登录/退出会话、真实 SQL 与事务回滚、并发及 HTTP 安全过滤仍需集成测试。

失败路径检查数据库写入未发生；正常注册检查规范化邮箱及编码密码，正常发布检查金额、图片关联顺序，上下架检查目标状态。Db、PasswordEncoder 和账号依赖通过 Mock 隔离；部分成功路径隔离详情组装，避免服务测试依赖无关查询。图片归属测试通过模拟数据库拒绝查询来检查业务中止，不能证明真实数据库的归属筛选正确。

## 执行结果与环境

- Maven `test-compile`：成功，按项目 Java release 21 编译。
- JUnit Platform Console Standalone 6.0.3：42 项通过，0 失败，0 跳过；新增 38 项。
- 新增两个 Java 文件：使用项目同版本 Prettier 3.9.8、prettier-plugin-java 2.10.4 格式化并检查。
- 本机使用 IntelliJ IDEA 自带 Java，临时 Apache Maven 3.9.11；没有修改系统 Java 配置。
- 本机标准 Maven test 执行受阻：Surefire 3.5.6 缓存缺 POM/依赖，在线获取返回 HTTP 403。因此实际结果来自独立 JUnit 执行器，不能写成 Maven verify 或 CI 已通过。
- 未执行需要真实服务的 FlowsTest、前端、E2E 或完整验收；本次也没有处理 R6 第二项 CI 修复。

## 团队复跑

在配置好 JDK 21、Maven 依赖可获取的环境中，从项目根目录执行：

```sh
cd apps/api
./mvnw -B -ntp -Dtest=AccountsTest,CatalogTest,ChatRulesTest test
```

现有后端 CI 运行 `verify`，会自动发现新增的 `*Test` 类，不需要额外配置。但本轮未触发或验证远程 CI。

## 过程说明

本次为已有实现补充单元回归测试，不能追溯认定为 Red→Green 的 TDD 开发。首次独立执行为 41 通过、1 失败，原因是 Mockito 对 Map 返回空 Map，而测试需要明确模拟不存在的分类；补齐 `thenReturn(null)` 后 42 项通过。这是测试准备修正，不是业务缺陷，也不计作有效 TDD Red。未发现需要修改生产代码的业务失败。

## 可用于 Update2 的汇报文字

已针对账号和商品模块补充 38 项服务层单元测试，覆盖身份与权限、注册输入和密码处理、商品金额边界、图片使用限制、版本冲突及上下架状态限制。与现有 4 项聊天规则测试一起执行，共 42 项通过。测试可脱离数据库和 Docker 独立运行；数据库事务、完整登录会话及端到端流程保留在后续集成与验收范围。本机 Maven 测试插件依赖获取受阻，已用独立 JUnit 执行器验证，尚不能宣称 CI 已通过。
