# Campus Neighbour 技术选型评审

日期：2026年9月18日。状态：技术方案评审稿，尚未创建工程或执行组合兼容性测试。前端方向、主题与双语需求依据用户最新决定；Monorepo布局与工程细则是建议方案。

## 结论

整体适合本项目。采用React前端、Java模块化单体后端、PostgreSQL与Redis，足以承载当前二手交易和后续校园模块。主要风险在登录与实时消息整合、交易一致性、版本组合及团队协作，不在技术名称是否足够多。

建议使用一个前后端同仓的Monorepo；pnpm管理前端工作区，Maven Wrapper管理Java后端。暂不增加独立管理端、微服务、任务编排平台或多个共享包。

## 前端方案

| 组件 | 用途与约定 |
| --- | --- |
| React 19 + TypeScript | 页面与组件；使用严格类型检查；具体补丁版本由工程验证后锁定 |
| Vite 8 | 开发服务器与打包；建议使用Node 24 LTS，锁定具体版本 |
| Tailwind CSS 3 | 按用户选择保留3.x，采用v3的PostCSS配置；不要混用v4安装方式 |
| TanStack Router | 页面路由、路由参数和可分享的筛选条件 |
| TanStack Query | 服务端数据的读取、缓存、刷新和提交后同步 |
| Zustand | 少量跨组件本地状态，不再复制一份商品和交易服务端数据 |
| i18next + react-i18next | 建议的中英界面翻译方案；本地化文案按业务模块组织 |
| pnpm | 固定包管理器版本，提交锁文件，持续集成按锁文件安装 |

Router和Query是不同职责，可同时使用。筛选条件优先放URL，界面局部状态优先放组件；有明确跨组件需要时再使用Zustand。

主题：dark / light，即深色和浅色。建议首次跟随系统，用户选择后保存；使用统一颜色变量，避免每个页面自己选择一组颜色。

双语：覆盖菜单、按钮、表单校验、错误提示、交易状态、空状态、通知模板、快捷聊天模板和日期数字显示。后端返回稳定的状态与错误编号，前端负责对应语言展示。商品介绍和私聊不自动翻译；自由聊天单条暂按20字上限，英文输入体验需产品确认；固定快捷模板的长度例外见需求说明书。模板发送后保存原文，不随界面语言变化重写历史消息。

依据：[Vite 8要求](https://vite.dev/blog/announcing-vite8)、[Node官方版本](https://nodejs.org/en/download)、[Tailwind v3配置](https://v3.tailwindcss.com/docs/guides/vite)、[TanStack Query](https://tanstack.com/query/latest/docs/framework/react/overview)、[Router](https://tanstack.com/router/latest/docs/overview)、[react-i18next](https://react.i18next.com/latest/using-with-hooks)。

快捷询问和自由消息属于买卖双方实时聊天，使用相同的WebSocket和消息存储链路。本次功能不调用模型API，不创建AI自动问答服务。

## 后端方案

- Java 21 LTS / Eclipse Temurin与Spring Boot 4.1.x + MVC：保留。官方Boot 4.1系统要求支持Java 21。统一使用Boot依赖管理，避免随意覆盖Spring子组件版本。
- MyBatis-Plus：保留Boot 4专用starter，不能只写模糊的3.5.x；官方从3.5.13开始提供该starter。开工前验证拟定的具体版本与Boot 4.1组合，不重复引入另一个MyBatis starter。
- PostgreSQL 18.x：保留。业务筛选和基础关键词查询先用数据库；中文语义搜索、分词及复杂排序不是基础关键词匹配自动具备的能力。
- Flyway：保留，并包含PostgreSQL数据库支持模块；迁移、驱动与PostgreSQL 18的具体组合需实测。Testcontainers使用与部署相同的大版本镜像。
- Spring Security、Spring Session与Redis：保留。Redis首先用于会话，商品与交易仍以PostgreSQL为准；业务缓存按实际需要增加。Redis版本、会话过期和退出行为待锁定。
- Spring WebSocket + STOMP：保留。消息先可靠入库再推送；断线重连后按游标补取，客户端发送编号用于防止重试产生重复消息。登录、发送、订阅分别校验，不能让用户订阅他人的会话。
- Jakarta Validation、springdoc-openapi 3.x、SLF4J/Logback和Actuator：保留。springdoc官方将3.x对应到Boot 4；具体小版本按兼容矩阵验证。管理与诊断接口限制访问。
- Spring Scheduling：按实际任务使用。需要重试时保存任务状态并控制重复执行；仅有定时注解不能保证通知可靠送达。单实例阶段无需引入专用任务平台。

Cookie会话建议通过同源部署简化整合：Nginx承接页面、/api及WebSocket路径；开发时Vite代理。会话Cookie使用HttpOnly、生产环境Secure及适当SameSite；写操作保留CSRF防护。WebSocket握手、STOMP CONNECT与订阅权限一起验证，不能为了连接成功就整体关闭保护。

图片使用服务器持久化目录是可接受的初期方案，但应挂载数据卷、保留备份、使用生成的文件名，并经过存储接口封装。容器内部临时目录不能作为持久存储；多实例部署时需要重新评估共享存储。

交易通过数据库事务与带状态条件的更新保证商品唯一占用；换物同时处理两件商品，遵循固定加锁顺序并检查整笔操作的成功条件。Redis不承担交易正确性的唯一保证。

依据：[Boot系统要求](https://docs.spring.io/spring-boot/system-requirements.html)、[MyBatis-Plus安装](https://baomidou.com/getting-started/install/)、[springdoc兼容说明](https://springdoc.org/)、[Flyway支持版本](https://documentation.red-gate.com/fd/supported-database-versions-143754067.html)、[Flyway PostgreSQL模块](https://documentation.red-gate.com/flyway/reference/database-driver-reference/postgresql-database)、[WebSocket安全](https://docs.spring.io/spring-security/reference/servlet/integrations/websocket.html)。

## Monorepo建议

Monorepo表示把多个相关工程放在同一个版本库中。它既不等于微服务，也不要求把每个业务模块拆成独立应用。九人共同维护同一产品，前后端接口和需求经常一起改，用一个仓库有利于审查和同步。

建议初始布局：

```text
Campus-Neighbour/
  apps/
    web/                 React应用，包含学生页面与受权限保护的管理页面
    api/                 Spring Boot应用，使用Maven Wrapper
  docs/                  需求、设计、测试与运行说明
  infra/                 Docker Compose与Nginx配置
  .github/workflows/      前端和后端检查
  pnpm-workspace.yaml    只纳入JS/TS工程
  pnpm-lock.yaml
  README.md
```

pnpm工作区先只纳入apps/web，不把Java目录假装成Node包。前后端各自构建部署，提交可以一并审查；公共接口变化应触发相关检查。

前端按auth、marketplace、chat、trades、profile等功能目录组织，后端按相应业务边界分包。未来地图、美食等优先添加模块；只有出现多个实际消费者时再提取共享UI、翻译资源或API客户端包。出现独立发布和运行要求时，再讨论独立应用或服务。

Java类型不直接作为TypeScript代码共享；可通过OpenAPI契约生成或校验前端类型。暂不需要为了Monorepo额外加入Turborepo或Nx。

依据：[pnpm Workspace](https://pnpm.io/workspaces)。以上目录与工具取舍是针对本团队的工程建议。

## 测试和开工验证

后端采用用户提出的Spring Boot Test、JUnit和Testcontainers。前端应补充组件和页面测试，以及浏览器端关键流程测试；具体工具在工程初始化时核对版本后确定。

在声称技术栈兼容之前，完成一个小型整合验证：

1. 安装固定版本依赖，前后端均能构建。
2. PostgreSQL 18通过Flyway建表，MyBatis-Plus完成一次读写。
3. Cookie登录、CSRF、Redis会话及退出能正确工作。
4. Swagger UI可打开，接口契约可生成。
5. 两个用户收发并重连恢复消息，第三人订阅被拒绝。
6. 深浅主题与中英切换覆盖一个真实表单及错误反馈。
7. Compose重启后数据库与图片仍存在；自动检查可在干净环境通过。

该验证当前尚未执行。TypeScript、pnpm、TanStack、Zustand、Redis和所有补丁版本仍需要写入版本清单；不能以4.1.x或latest作为最终可复现的配置。
