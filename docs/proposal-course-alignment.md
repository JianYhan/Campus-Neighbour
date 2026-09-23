# 申报书与 JC2001 课件的对应说明

本说明帮助组员理解申报书如何运用课堂内容，供内部阅读。正式申报书仍沿用课程模板的 Title、Problem、Solution、Objectives、Benefits、Timeline、Action plan 七部分。

## 四份课件对应在哪里

| 课件与相关章节 | 课堂重点 | 申报书中的具体回应 |
| --- | --- | --- |
| Lecture 1 — Introduction & Course Overview；Software Product、Course learning outcomes | 软件工程还包括需求、设计、安全、测试、文档和维护 | §3.3 写明权限、可靠性、可用性与可维护性，并保留安装说明、用户指南和缺陷记录；O1、O4 覆盖需求设计与验证交付。 |
| Lecture 2 — Software Processes & Agile Software Development；Incremental Development、Extreme Programming、Software validation | 增量开发、反馈、测试先行、持续集成和重构 | §3.2 说明每轮交织需求、设计、实现和验证；§4 写明 TDD 的失败测试→实现→重构，并用同一商品不能被两名买家同时预留举例。 |
| Lecture 3 — Project Management；Project management activities、Group communications | 任务计划、估算、协作、进度证据、风险与汇报 | §7 用任务、依赖和完成证据追踪进度；安排每周评审，记录阻碍和决定，关注集成延误与范围变化。负责人、内部日期和进度仍待填写。 |
| Lecture 5 — Requirements Engineering；User and system requirements、Elicitation、Validation、Change management | 区分用户需求与系统需求、功能与质量约束，获取和验证需求，管理变更 | O1 计划访谈买卖双方、走查交易习惯、评审管理需求；检查需求的有效性、一致性、完整性、可行性和可测试性；§7 说明变更前评估影响，再同步需求与计划。 |

## 怎样理解这些修改

**用项目中的做法回应课程。** 例如，“防止同一商品重复预留”既是交易需求，也是设计约束和测试场景；“先让同学试用再调整”体现需求验证和迭代反馈。课件不是新的功能清单。

**迭代既包括优化，也包括已约定范围内的增强。** 完善搜索、错误提示、手机操作和交易可靠性都是迭代。一对一换物仍属于二手交易主线；地图、美食和复杂支付等仍放在 Future work。

**课程概念与团队选择分开看。** 课件介绍了多种开发过程，并没有要求所有项目都采用完整 Scrum。申报书选用增量开发和敏捷实践；TDD 是本组此前已经选定的方法。GitHub Issues 和每周评审是把课程管理原则落地的项目安排，不是课件强制指定的工具或频次。

**计划与证据分开写。** 申报书中的访谈、需求评审和学生任务测试是计划，不能据此声称已经完成。后续应保留真实的访谈摘要、评审决定、任务记录和测试结果，再据此撰写项目更新与技术报告。已有代码通过测试，也不能自动证明采用了测试先行。

## 提交前由小组确认

- 填写小组编号、专业、导师、项目起止日期和行动计划中的待填项。
- 确认访谈与试用对象，以及谁代表管理员角色提出需求；不默认学校工作人员已经参与或认可项目。
- 用原型核对关键规则，例如预留取消、换物确认、20 字自由消息限制及英文输入体验。
- 保留可用性、性能目标的讨论空间，在明确测试环境后写成可以验证的验收条件。

## 来源

用户提供的四份 JC2001 2026–27 课件：Lecture 1（Week 1, Day 1）、Lecture 2（Week 2, Day 1）、Lecture 3（Week 2, Day 2）、Lecture 5（Week 4, Day 1）。上表使用课件章节名称定位；课件正文未提供统一可核对的页码，因而不编造幻灯片编号。申报书正文参考文献 [2]—[5] 对应这四份课件。

格式参照用户提供的 Proposal_Template.pdf；本说明属于辅助材料，不新增到八份工程文档中。

另核对《JC2001 Group Project Description and Requirements 2026–27》的 Project Proposal 与 Formatting Requirements：要求标题页列出小组编号、专业及成员姓名和学号；正文为 4–8 页，标题页不计入；采用 A4、四边 1 英寸页边距、12 号 Arial 或 Times New Roman、单栏、1.5 倍行距。当前导出为标题页 1 页加正文及参考文献 7 页。
