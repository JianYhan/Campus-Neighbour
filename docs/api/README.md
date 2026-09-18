# Campus Neighbour 接口契约

版本：v0.1 完整初稿｜日期：2026年9月18日｜负责人、审核人：待填写。

状态：供团队评审，尚未实现或验证。具体业务默认值为建议基线；TDD开发方式已由项目发起人明确采用。

## 1 用途与统一约定

接口是前后端共同遵守的数据约定。本文覆盖当前功能范围，是可供评审的人工可读契约；OpenAPI机器定义将在开工前按本文补齐、校验，尚未生成。数据库字段见[数据库设计](../database.md)，页面行为见[页面设计](../product-design.md)。

- 基础路径`/api/v1`，UTF-8 JSON；ID均UUID字符串。请求字段camelCase，数据库字段snake_case。
- 时间ISO 8601带时区，响应统一UTC，例如`2026-09-30T08:00:00Z`；显示时转换Asia/Shanghai。
- 金额`priceMinor`为整数分，币种固定CNY；2500表示25.00元。ID不当作数字处理。
- 身份来自HttpOnly会话Cookie。写操作携带`X-CSRF-TOKEN`，登录也保留CSRF防护；登录成功后重新取token。
- 成功返回`{"data": ...}`；分页`{"data":{"items":[],"nextCursor":null}}`。默认limit20，最大100；游标包含稳定排序值和ID，不接受任意SQL排序表达式。
- 创建返回201，读取和状态动作返回200，退出204。字段未知、类型错误、必填缺失返回400；自由文本语义校验失败422。
- 401未登录、403明确无操作权限、404资源不存在或对无关用户不可见、409状态／版本／幂等冲突、413过大、415文件类型不支持、429限流、503依赖不可用。
- 错误结构：`{"error":{"code":"STATE_CONFLICT","message":"当前状态不允许此操作","fieldErrors":{},"requestId":"..."}}`。客户端主要按code翻译，日志按requestId关联。
- 错误码包括VALIDATION_ERROR、UNAUTHENTICATED、FORBIDDEN、NOT_FOUND、STATE_CONFLICT、VERSION_CONFLICT、ITEM_UNAVAILABLE、MESSAGE_TOO_LONG、IDEMPOTENCY_CONFLICT、DEPENDENCY_UNAVAILABLE。
- 创建交易、接受换物、取消、确认、评价要求`Idempotency-Key` UUID；相同账号同操作同key同内容返回原结果，同key不同内容409。数据唯一约束仍必须生效。
- 商品编辑提交`expectedVersion`，不匹配返回409，提示重新加载；不得覆盖他人较新编辑。

本文下表P=公开、S=已登录账号（包括管理员的本人会话操作）、O=资源所有者、M=会话或交易参与者、A=管理员。管理员身份不自动拥有私人聊天读取权。

## 2 账号、资料和字典

| 方法与路径 | 权限 | 请求 | 响应data／行为 |
| --- | --- | --- | --- |
| GET /auth/csrf | P | 无 | `{token,headerName}`；禁止缓存 |
| POST /auth/register | P | `{email,nickname,password}` | UserSelf；建议注册后仍需登录，201；不能提交角色 |
| POST /auth/login | P | `{email,password}` | UserSelf并设置会话Cookie；统一登录失败提示 |
| POST /auth/logout | S | 无 | 204，会话失效；前端断开消息连接 |
| GET /me | S | 无 | UserSelf |
| PATCH /me/profile | S | ProfileWrite，部分更新 | Profile；显式null清空选填字段 |
| GET /users/{id}/profile | P | 无 | PublicProfile；受限或不可见资料按公开规则处理 |
| GET /dictionaries/{kind} | P | kind=buildings/courses/categories | `{items:[DictionaryItem]}`；默认仅active |

UserSelf=`{id,email,nickname,role,status,verified,profile}`；PublicProfile=`{userId,nickname,college,major,year,bio,courses:[{courseId,courseName,teacher,description}]}`；不包含邮箱、学号、登录信息或房号。Profile同公开结构。

ProfileWrite允许nickname(1—40)、college/major(≤100)、year(≤20)、bio(≤500)、courses数组；courses提交时整体替换，仅可引用已有课程。DictionaryItem=`{id,code?,nameZh,nameEn,active}`。注册邮箱语法合法且大小写归一后唯一；密码建议12—128字符、不截断，具体策略与认证方式D01待确认；邮箱未验证不得显示校园认证。找回密码流程D01未确定，当前不承诺找回接口。

## 3 图片与商品

| 方法与路径 | 权限 | 请求／查询 | 响应data |
| --- | --- | --- | --- |
| POST /images | S | multipart字段file；建议JPEG/PNG/WebP，每张≤5MiB | `{id,url,mimeType,sizeBytes}`，201；归属当前用户 |
| GET /listings | P | q、categoryId、buildingId、courseId、minPriceMinor、maxPriceMinor、swapEnabled、sort、cursor、limit | ListingCard分页；仅公开可见记录 |
| GET /listings/{id} | P或相关参与者 | 无 | ListingDetail；历史参与者可看必要快照，不能借此公开管理隐藏商品 |
| POST /listings | S | ListingWrite | ListingDetail，201 |
| PATCH /listings/{id} | O | 允许变更字段及expectedVersion | ListingDetail；预约后拒绝关键内容更改 |
| POST /listings/{id}/withdraw | O | `{expectedVersion}` | ListingDetail；有占用时409，管理隐藏另走管理接口 |
| POST /listings/{id}/relist | O | `{expectedVersion}` | ListingDetail；仅WITHDRAWN且未被管理隐藏可恢复 |
| GET /me/listings | S | status、cursor、limit | 本人商品分页，含下架记录 |

ListingWrite必填title(1—80)、description(1—2000)、priceMinor(≥0整数)、categoryId、buildingId、conditionCode、imageIds(1—6个本人图片ID)。可选courseId、bookAuthor、bookEdition、swapEnabled(默认false)、wantedDescription。课程／作者／版本在教材详情明确展示，是否作为教材必填项留D03评审；不允许提交ownerId、status、moderationStatus。

ListingCard=`{id,title,priceMinor,currency,coverUrl,conditionCode,building,status,swapEnabled,createdAt}`。
ListingDetail在卡片上增加`{description,images,category,course,bookAuthor,bookEdition,wantedDescription,seller:PublicProfile,contentVersion,moderationStatus,updatedAt}`。images为`[{id,url,position}]`；building/category/course引用字典对象。

sort仅NEWEST/PRICE_ASC/PRICE_DESC，使用ID打破相同价格或时间的平局。q最长100字符，min≤max；基础查询无语义理解。公开列表建议仅AVAILABLE，售出详情仍按可见性展示状态。图片尺寸与像素上限待上传验证确定，不能仅信任扩展名。

## 4 会话、消息和实时事件

| 方法与路径 | 权限 | 请求／查询 | 响应data |
| --- | --- | --- | --- |
| POST /conversations | S | `{listingId}` | Conversation；相同买家与商品复用原会话，禁止与自己创建 |
| GET /conversations | S | cursor、limit | Conversation分页 |
| GET /conversations/{id}/messages | M | beforeCursor或afterCursor二选一、limit | Message分页；无游标取最近一页；beforeCursor取更早、afterCursor取更晚；items均按消息序号升序，nextCursor沿请求方向继续 |
| POST /conversations/{id}/messages | M | TextMessage或TemplateMessage | Message，201；重复clientMessageId返回已存结果200 |
| POST /conversations/{id}/read | M | `{lastReadMessageId}` | `{unreadCount}`；只能推进到此会话已存在消息 |
| GET /chat/templates | S | locale=zh-CN/en | `{items:[{code,label,text}]}` |

Conversation=`{id,listingId,otherUser:{id,nickname},listingSummary,lastMessage,unreadCount,updatedAt}`。
Message=`{id,conversationId,senderId,clientMessageId,kind,body,templateCode,locale,createdAt,sequence}`。正文是最终保存文本，历史不可由客户端替换。

自由消息请求：

```json
{"clientMessageId":"a1111111-1111-4111-8111-111111111111","kind":"TEXT","text":"周五下午可以吗？"}
```

固定问题请求：

```json
{"clientMessageId":"a2222222-2222-4222-8222-222222222222","kind":"TEMPLATE","templateCode":"ASK_LOCATION","locale":"en"}
```

TEXT要求1—20个用户可见字符，空白禁止；计数包含标点和空格，组合emoji按字素簇处理。前后端须共享测试样本验证计数。TEMPLATE只接受ASK_PRICE/ASK_CONDITION/ASK_LOCATION及受支持locale，拒绝自定义body/text；完整英文模板可超过20字符。编辑预填内容后按TEXT发送。模板例外待D10最终确认。

senderId不接受客户端指定；客户端临时状态SENDING/SENT/FAILED只用于显示，SENT表示已保存。失败重试复用同一clientMessageId；相同ID不同文本409。同ID换会话也视为内容冲突。每会话消息sequence严格递增；写入时锁会话行分配序号并入库，提交后才允许下一事务分配。历史游标以sequence为界，避免按时间分页漏掉延迟提交的消息。

### WebSocket契约

连接入口`/ws`，采用STOMP；使用现有Cookie并在CONNECT携带CSRF token，校验允许的Origin。仅订阅`/user/queue/events`。客户端不能订阅其他用户目标或向任意broker地址SEND；业务发送走上述REST接口。

事件统一结构：`{eventId,type,resourceId,occurredAt,payload}`。服务端待发事件可重试，因此推送可能重复；离线客户端不保证收到每次推送，必须从持久化历史补取。客户端按eventId及资源ID去重；事件到达不是替代权限检查的凭证。

| type | payload | 客户端处理 |
| --- | --- | --- |
| MESSAGE_CREATED | Message | 按messageId合并当前会话，更新未读 |
| TRADE_CHANGED | `{tradeId,status}` | 重新请求授权交易详情 |
| NOTIFICATION_CREATED | Notification | 合并通知并更新计数 |

断线后退避重连；重新读取会话列表、通知和当前会话afterCursor之后的消息。不能只靠WebSocket已收到事件判断历史完整。退出时断开并清空当前用户缓存。

## 5 买卖交易、换物与评价

| 方法与路径 | 权限 | 请求／查询 | 响应data |
| --- | --- | --- | --- |
| POST /trades | O | `{conversationId,meetingLocation,meetingAt,expectedListingVersion}` | Trade，201；卖家为会话买家预约，SALE |
| GET /trades | S | role=buyer/seller/swap、status、cursor、limit | TradeSummary分页，限本人 |
| GET /trades/{id} | M | 无 | Trade |
| POST /trades/{id}/cancel | M | `{reason}`1—300字 | Trade；确认交付前可取消，终态重复返回原结果 |
| POST /trades/{id}/confirm-receipt | 合法接收者 | 无 | Trade；SALE仅买家，SWAP双方分别确认 |
| POST /trades/{id}/reviews | M | `{rating,comment?}` | Review，201；完成后每人一次 |
| GET /trades/{id}/reviews | M | 无 | `{items:[Review]}` |
| GET /users/{id}/reviews | P | cursor、limit | 公开Review分页，仅昵称、评分、文字和时间，不返回私有交易安排 |
| POST /swap-requests | S | `{offeredListingId,requestedListingId,offeredVersion,requestedVersion,meetingLocation,meetingAt}` | SwapRequest，201；表达发起方同意 |
| GET /swap-requests | S | direction=sent/received、status、cursor、limit | SwapRequest分页 |
| GET /swap-requests/{id} | 双方 | 无 | SwapRequest |
| POST /swap-requests/{id}/accept | 接收方 | 无 | `{request:SwapRequest,trade:Trade}`；原子占用双方商品 |
| POST /swap-requests/{id}/reject | 接收方 | 无 | SwapRequest；仅PENDING |
| POST /swap-requests/{id}/withdraw | 发起方 | 无 | SwapRequest；仅PENDING |

meetingLocation非空≤200，meetingAt为带时区未来时间（初稿建议）；变更预约先取消再建立。API不接受任意状态值进行交易状态修改。

TradeSummary=`{id,kind,status,otherUser,itemSummaries,meetingAt,createdAt}`。
Trade在摘要上增加`{initiatorId,counterpartyId,meetingLocation,items:[{listingId,giverId,receiverId,snapshot}],confirmations:[{userId,createdAt}],cancelReason,cancelledAt,completedAt,allowedActions}`。快照字段对应数据库trade_items，allowedActions是提示，服务端执行时重新验证。
SwapRequest=`{id,proposerId,recipientId,offeredListingId,requestedListingId,offeredVersion,requestedVersion,status,meetingLocation,meetingAt,tradeId,createdAt}`。
Review=`{id,author:{id,nickname},recipientId,rating,comment,createdAt}`；评分1—5整数，comment≤300，初稿不允许修改。

交易状态WAITING_MEETUP/PARTIALLY_CONFIRMED/COMPLETED/CANCELLED；商品状态和管理可见性独立，见数据库设计。接受换物时商品变化或已占用返回409；一方确认后不能普通取消。对COMPLETED取消或对CANCELLED确认返回409；重复同一已成功动作返回原结果。并发动作必须事务化，不能依赖按钮禁用。

## 6 通知、专区与管理

| 方法与路径 | 权限 | 请求／查询 | 响应data |
| --- | --- | --- | --- |
| GET /notifications | S | unreadOnly、cursor、limit | Notification分页 |
| POST /notifications/{id}/read | O | 无 | Notification，重复读取无副作用 |
| GET /zones | P | 无 | `{items:[Zone]}`，当前启用专区 |
| GET /zones/{id} | P | 无 | Zone，含是否已结束 |
| GET /zones/{id}/listings | P | cursor、limit | ListingCard分页，按专区与可交易可见条件交集 |
| GET /admin/listings | A | q、moderationStatus、cursor、limit | 管理商品分页 |
| POST /admin/listings/{id}/moderation | A | `{action:HIDE或RESTORE,reason}` | `{id,moderationStatus}`，审计留痕 |
| GET /admin/users | A | q、status、cursor、limit | `{items:[{id,nickname,status}],nextCursor}` |
| POST /admin/users/{id}/restriction | A | `{restricted:boolean,reason}` | `{id,status}`，不自动修改商品可见性 |
| GET /admin/dictionaries/{kind} | A | 无 | 含停用项的字典列表 |
| POST /admin/dictionaries/{kind} | A | `{code?,nameZh,nameEn?,active}` | DictionaryItem，201 |
| PATCH /admin/dictionaries/{kind}/{id} | A | 可变名称与active | DictionaryItem；不删除历史引用 |
| GET /admin/zones | A | cursor、limit | Zone分页，含未启用及过期项 |
| POST /admin/zones | A | ZoneWrite | Zone，201 |
| PATCH /admin/zones/{id} | A | ZoneWrite部分更新 | Zone |
| GET /admin/audit-logs | A | targetType、targetId、cursor、limit | 审计记录分页 |

Notification=`{id,type,resourceType,resourceId,createdAt,readAt}`。ZoneWrite=`{titleZh,titleEn,descriptionZh?,descriptionEn?,startsAt,endsAt,enabled,categoryId?,buildingId?}`；Zone增加id和activeNow。审计记录=`{id,actorId,targetType,targetId,action,reason,beforeState,afterState,createdAt}`，必须过滤凭据等敏感字段。

管理操作理由1—300字符；受限账号处理建议见数据库设计，D07评审后统一。管理员不得通过这些接口强制收货或读取私聊正文。

## 7 支付展示、错误示例与TDD契约验证

支付展示是前端路由`/payment-unavailable`，可携带tradeId以展示本人交易金额；读取仍走受保护交易详情。**不设计支付提交、支付回调或支付成功接口。** 打开或返回不能修改任何交易状态。

预约失败示例：HTTP409，code=ITEM_UNAVAILABLE，前端刷新详情并提示“商品已被预约，请与卖家沟通”。聊天过长：HTTP422，code=MESSAGE_TOO_LONG，fieldErrors指向text，保留输入；不得显示发送成功。第三人读取会话：404，不返回消息片段。

TDD要求：接口实现前先写契约测试，包括合法请求、必填／边界、401/403/404和状态冲突；验证失败来自尚未实现的行为，再写实现。金额、时间、枚举、分页游标和幂等结果必须被断言。前端可用本契约虚构数据开发测试，但Mock通过不代表后端接口已验证。

待补实施材料：OpenAPI文件、真实请求样例、自动契约比对及测试报告。任何接口修改同时调整页面、数据设计和对应验收用例。
