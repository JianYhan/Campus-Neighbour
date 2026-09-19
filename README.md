# Campus Neighbour

校园二手交易平台 · JC2001 Introduction to Software Engineering

**当前状态：首版可运行实现，待团队代码评审。** 前端连接真实Java接口，业务数据存入PostgreSQL，会话使用Redis。功能和验证范围见[实施记录](docs/implementation/README.md)。

<img src="docs/implementation/screenshots/desktop.png" alt="校园邻里首页" width="850" />

## 已有功能

- 邮箱注册、登录退出，公开个人及课程简介。
- 商品图片上传、发布编辑、上下架；关键词、楼栋、课程、类别和价格筛选。
- 买卖双方实时聊天：三个快捷问题、20个可见字符以内的自由消息、历史记录、发送失败重试。
- 卖家预约、线下面交、买家确认、双方评价；数据库约束防止重复占用。
- 一对一换物请求、接受／拒绝／撤回、双商品预约、双方分别确认。
- 季节专区、站内通知、管理员隐藏商品／限制账号／维护字典与专区、处理记录。
- 中英界面、浅色／深色主题、移动端布局；支付页只展示提示，不处理资金。

地图、美食、生活指南、真实支付／担保仍为Future Work。快捷聊天由对方本人回复，不调用AI。

## 本地启动

需要Java 21、Node 24 LTS、pnpm 10.33.0、可运行的Docker。Java构建使用仓库自带Maven Wrapper。

在仓库根目录先运行：

```sh
pnpm install --frozen-lockfile
docker compose -f infra/compose.yml up -d --wait
```

另开一个终端启动后端：

```sh
cd apps/api
./mvnw spring-boot:run
```

再开一个终端，在仓库根目录启动前端：

```sh
pnpm dev
```

打开 **http://127.0.0.1:5173**。接口健康检查为`http://localhost:8080/actuator/health`，Swagger UI为`http://localhost:8080/docs`。Windows后端使用`mvnw.cmd`。

### 可选：虚构演示数据

首次启动空数据库时，可以将后端启动命令改为：

```sh
DEMO_DATA_ENABLED=true DEMO_PASSWORD='Campus-demo-2026!' ./mvnw spring-boot:run
```

仅在本地演示使用上述示例密码。会创建`seller@example.test`、`buyer@example.test`和`admin@example.test`，密码为你设置的`DEMO_PASSWORD`；已有演示账号时不会覆盖密码或重建数据。商品、图片与学院信息均为虚构。默认关闭演示数据，不应在公网环境使用示例凭据。

数据库、Redis使用Compose数据卷，图片默认保存于后端工作目录的`.data/uploads`。停止容器不会自动清空数据。完整配置、容器运行及恢复说明见[运行指南](docs/operations.md)。

## 测试与TDD

采用**Red → Green → Refactor**。先写失败测试，再实现，再重构；修复问题先补复现测试。[TDD记录及实际验证结果](docs/implementation/README.md#验证记录)区分了已执行检查和待执行内容。

```sh
pnpm test                         # 前端规则及交互测试
pnpm build                        # TypeScript检查与生产构建
pnpm format:check                 # 前后端格式检查
cd apps/api
./mvnw verify                     # 含真实PostgreSQL/Redis的Testcontainers测试
```

后端测试需要Docker，无须提前启动本地业务数据库。测试容器使用随机端口及独立数据。

浏览器端测试：先启动本地数据库／Redis，再执行以下命令；Playwright会启动前后端或复用已有本地服务。

```sh
pnpm --filter @campus/web exec playwright install chromium
pnpm test:e2e
```

GitHub Actions包含前端、后端和浏览器测试任务。首版代码`b1cf75c`的[远程检查全部通过](https://github.com/JianYhan/Campus-Neighbour/actions/runs/35429970574)：14项后端测试、6项前端测试、2项浏览器端到端测试，以及前后端构建和格式检查。后续提交以对应Checks结果为准。

## 项目结构与技术

```text
apps/web/        React + TypeScript + Vite + Tailwind
apps/api/        Java 21 + Spring Boot + MyBatis-Plus + Flyway
infra/           PostgreSQL / Redis / Nginx / Docker Compose
.github/         GitHub Actions
docs/           需求、设计、接口、测试与运行资料
```

前端使用TanStack Router / Query、Zustand及双语资源；消息通过REST提交入库、WebSocket/STOMP推送。后端提供Redis会话、CSRF防护、资源归属校验及商品占用事务。依赖已锁定，实际验证环境见实施记录。

## 8份工程文档

| 编号 | 文档 | 用途 |
| --- | --- | --- |
| 1 | [需求说明书](docs/requirements.md) | 项目范围、业务规则、验收条件 |
| 2 | [功能与页面设计](docs/product-design.md) | 13个页面、流程、状态和交互 |
| 3 | [技术选型与架构](docs/architecture.md) | 技术职责、模块和关键链路 |
| 4 | [数据库设计](docs/database.md) | 初稿模型及实际迁移对照 |
| 5 | [接口契约](docs/api/README.md) | 设计契约与实际OpenAPI入口 |
| 6 | [开发协作与任务计划](CONTRIBUTING.md) | TDD、任务、PR和完成标准 |
| 7 | [测试计划与验收记录](docs/testing.md) | 需求追踪和测试计划 |
| 8 | [部署运行与用户说明](docs/operations.md) | 实际启动步骤及用户操作 |

先看[团队阅读版](docs/team-guide.md)和页面设计，再按参与内容阅读其他文档。负责人和审核人仍待填写。设计初稿与代码存在的具体差异在[实施记录](docs/implementation/README.md)集中说明，不能把初稿中所有计划理解为已经验证。

辅助材料：[申报书](docs/proposal.md) · [技术评审背景](docs/technology-review.md) · [路线](docs/document-roadmap.md) · [修改记录](docs/changes.md)。

导出文件：[申报书Word](docs/downloads/Campus_Neighbour_Proposal.docx) · [申报书PDF](docs/downloads/Campus_Neighbour_Proposal.pdf) · [需求Word v0.2](docs/downloads/Campus_Neighbour_SRS.docx)。这些导出保留需求评审版本，不含本次代码实施记录。
