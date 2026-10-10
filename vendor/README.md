# WANX SDK 依赖

当前安装包：`centaurai-wanx-0.1.0-alpha.8.tgz`。`package.json` 使用本地文件依赖，`package-lock.json` 锁定同一版本，克隆仓库后可直接 `npm ci`。

SHA-256：`80130e550e54ed686029e0c08eb95c8dd92bdf0a5f9968222401c229139b5c37`。

安装包保留 SDK 的接口类型、实现、原生平台组件、授权与第三方声明。它是客户端依赖，不包含 WANX 服务端。版本升级应替换安装包、更新依赖与锁文件，并重新运行客户端检查。

## 局域网 HTTP 兼容修复（客户端 0.2.1）

原始 alpha.8 安装包保持不变。`npm ci` 的 postinstall 执行 `tools/patch-wanx-http.mjs`，为 HTTP transport 增加 `allowPrivateNetworkHTTP` 显式选项；默认仍只接受 HTTPS 或本机 HTTP。超级参谋团在主进程验证用户选中的局域网地址后开启该选项，仅允许 RFC1918 私有 IPv4，不允许公网 HTTP、域名 HTTP、带凭据、查询串或片段的地址。HTTP 与 WebSocket 复用同一地址和 SDK 的原有认证、取消及禁止重定向机制。

补丁固定用于 alpha.8，升级 SDK 前必须重新审查；不使用 `--ignore-scripts` 安装，否则此兼容修复不会应用。原 SDK tarball 的校验值与授权声明保持不变。
