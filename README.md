# Campus Neighbour

校园二手交易平台 · JC2001 Introduction to Software Engineering

当前阶段是文档评审：仓库保存项目说明、需求和技术方案，尚未搭建前后端框架。目前只有需求说明书完整初稿与技术评审基础，8份工程文档尚未齐备。下一步先准备完整的8份初稿，再组织团队评审；详见文档与开发路线。

## 阅读顺序

| 文档 | 内容 | 状态 |
| --- | --- | --- |
| [团队阅读版](docs/team-guide.md) | 项目做什么、需求文档有什么用、成员如何参与 | v0.2 |
| [项目申报书](docs/proposal.md) | 项目目标、范围、收益与课程时间表 | 已同步聊天功能更正 |
| [软件需求规格说明书](docs/requirements.md) | 功能、规则、权限、验收和待确认事项 | v0.2讨论稿 |
| [技术选型评审](docs/technology-review.md) | 技术栈、版本注意事项、Monorepo建议 | 方案稿，未执行组合测试 |
| [文档与开发路线](docs/document-roadmap.md) | 后续文档、开发顺序与交付节点 | 工作建议 |
| [修改记录](docs/changes.md) | 本次需求更正与版本说明 | 持续更新 |

## 本次聊天功能更正

在买卖双方的实时聊天窗口提供“问价格”“问物品状态”“问交易地点”和“自由聊天”。快捷问题发送给会话对方，由对方回复；自由消息暂按每条20字上限，双方可连续发送多条。

这项功能属于人与人聊天，不是AI自动问答。详细交互建议与英文模板长度处理见需求说明书第5节。

## 下载文档

- [申报书 Word](docs/downloads/Campus_Neighbour_Proposal.docx)
- [申报书 PDF](docs/downloads/Campus_Neighbour_Proposal.pdf)
- [需求说明书 Word](docs/downloads/Campus_Neighbour_SRS.docx)

Markdown用于在线阅读与版本维护，Word／PDF为对应导出文件。修改时需要同步导出，避免内容分叉。

## 如何提意见

可在仓库Issues中注明文档名称、章节或需求编号，并写清“目前的描述、建议怎样调整、原因或例子”。没有编程经验也可以评审页面流程、文案和验收步骤。

代码目录、依赖配置及运行命令将在文档评审后另行建立。技术评审中的目录树是建议，尚未实施。
