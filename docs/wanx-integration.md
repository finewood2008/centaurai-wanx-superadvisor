# WANX 接入说明

此仓库是超级参谋团桌面客户端，依赖 WANX 的原生账号、应用授权、私有 Agent、Teams / inbox、专家库、SkillHub 与知君资料能力。它不启动 WANX 服务端，也不直接连接模型服务商。

## 兼容服务

当前客户端携带 `centaurai-wanx@0.1.0-alpha.8` SDK。WANX 服务需提供下列接口；仅有普通聊天接口的旧版服务不能运行本应用。实际请求与响应类型随 SDK 安装于 `node_modules/centaurai-wanx/dist/brainstorm-contracts.d.ts`，SDK 会议说明位于 `node_modules/centaurai-wanx/docs/brainstorm.md`。

| 用途 | WANX 接口 |
| --- | --- |
| 同一账号登录、身份与退出 | `POST /api/auth/login`、`GET /api/auth/me`、`POST /api/auth/logout` |
| 读取参谋、专家目录与启用模型 | `GET /api/brainstorm/profile` |
| 保存专家选择及各专家的模型 | `POST /api/brainstorm/profile` |
| 技能市场专家搜索与导入 | `GET /api/experts/hub`、`POST /api/brainstorm/experts/{slug}/import` |
| 讨论列表、发起与状态 | `GET/POST /api/brainstorm/sessions`、`GET /api/brainstorm/sessions/{thread_id}` |
| 回答、议程确认、暂停、恢复、来源与裁决 | `POST /api/brainstorm/sessions/{thread_id}/control` |
| 报告与可编辑 Word 文档 | `GET /api/brainstorm/sessions/{thread_id}/report`、`GET /api/brainstorm/sessions/{thread_id}/report/document` |
| 历史消息 | `GET /api/agents/{agent_id}/threads/{thread_id}/history` |
| 实时讨论 | SDK 原生 `chat` WebSocket，按 `team_id` 连接并订阅 `thread_id` |

## 应用与模型配置

登录请求携带 `application_id: "super-advisory"`。WANX 应部署并授权该应用，声明 `chat / teams / brainstorm / zhijun_context` 能力，绑定主持人模型与所需资源。README 的启用脚本通过已有 SDK 应用管理接口完成部署与账号授权。

参谋团设置从 `getProfile().body.experts` 读取专家、从 `getProfile().body.models` 读取当前启用的对话模型。保存 `expert_ids` 与按专家 ID 索引的 `expert_models`；服务端验证模型可用性，并拒绝在讨论运行或成员任务未完成时修改配置。服务商、API 密钥、新增模型及主持人部署绑定在 WANX 中维护。

## 会议与资料

创建主题后先由主持人与用户确认目标、条件和议程；用户确认才允许向参谋派工。普通阶段由原生 Teams / inbox 回叫推进；关键判断与最终裁决等待用户。提交判断带当前 `decision_id` 和 `revision`，服务端校验过期提交。

知君资料由 WANX 按当前登录账号与讨论主题读取，客户端展示来源并允许调整引用范围。改变来源会暂停讨论并影响后续上下文；已保存消息和先前模型输入不会被撤回。客户端不直接读取知君数据库。

报告在会议收尾后冻结，明确区分用户裁决和参谋建议。Word 导出使用服务端返回的 DOCX 字节，主进程通过系统保存对话框写入用户选择的位置。
