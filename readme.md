# BotBrowser MCP

多实例浏览器自动化 MCP Server，集成 [@playwright/mcp](https://www.npmjs.com/package/@playwright/mcp) 的 22 个浏览器工具，支持配置管理、账号管理和多实例切换。

**版本:** v0.1.9  
**平台:** Windows | Linux | macOS

> 📖 查看 [平台兼容性说明](PLATFORM_COMPATIBILITY.md) 了解不同平台的配置差异

## 安装

```bash
npm install -g botbrowser-mcp
```

## 配置

在 MCP 客户端（如 Claude Desktop）的配置文件中添加：

```json
{
  "mcpServers": {
    "botbrowser": {
      "command": "botbrowser-mcp"
    }
  }
}
```

或使用 npx（无需安装）：

```json
{
  "mcpServers": {
    "botbrowser": {
      "command": "npx",
      "args": ["-y", "botbrowser-mcp"]
    }
  }
}
```

## 核心概念

### 三层数据模型

1. **浏览器配置 (Profile)** - 定义浏览器启动参数
   - Chrome 可执行文件路径
   - Cookie/LocalStorage 存储路径（可选）
   - 用户数据目录（自动管理，存储缓存/扩展/设置等）
   - 代理设置
   - **限制：同一 Profile 同时只能启动一个实例**

2. **账号 (Account)** - 绑定到配置的用户账号
   - 平台标识（twitter, github 等）
   - 用户名和元数据（密码、2FA 等）

3. **浏览器实例 (Instance)** - 运行中的浏览器
   - 基于某个配置启动
   - 可选关联某个账号
   - 同时只有一个实例为活跃状态
   - 复用配置的 userDataDir（保留浏览器状态）

## 快速开始

### 示例：管理多个 Twitter 账号

```
# 1. 创建浏览器配置
create_browser_profile(
  alias: "twitter-bot",
  # Windows 路径示例
  executable_path: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  # Linux 路径示例
  # executable_path: "/usr/bin/google-chrome",
  # macOS 路径示例
  # executable_path: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  storage_state_path: "/Users/me/.botbrowser/twitter_cookies.json"
)

# 2. 添加账号
add_account(
  profile_alias: "twitter-bot",
  platform: "twitter",
  identifier: "account1",
  username: "account1@twitter.com",
  metadata: "password: SecurePass123"
)

# 3. 启动浏览器（自动成为活跃实例）
launch_browser(profile_alias: "twitter-bot", account_id: 1)
# 返回: Browser instance 1 launched successfully

# 4. 方式1：使用活跃实例（传统方式）
browser_navigate(url: "https://twitter.com")
browser_click(element: "登录按钮")

# 5. 启动第二个实例
launch_browser(profile_alias: "twitter-bot", account_id: 2)
# 返回: Browser instance 2 launched successfully

# 6. 方式2：直接指定实例ID（推荐！）
browser_navigate(url: "https://twitter.com", instance_id: 1)  # 在实例1操作
browser_navigate(url: "https://facebook.com", instance_id: 2) # 在实例2操作

# 7. 方式3：切换活跃实例再操作
switch_browser_instance(instance_id: 1)
browser_click(element: "Tweet按钮")  # 自动使用实例1
```

### 多实例操作的两种方式

**方式1: 显式指定 instance_id（推荐）**
```
# 所有浏览器工具都支持 instance_id 参数
browser_navigate(url: "https://example.com", instance_id: 1)
browser_click(element: "按钮", ref: "abc123", instance_id: 2)
browser_type(element: "输入框", ref: "xyz", text: "hello", instance_id: 1)
```

**方式2: 切换活跃实例**
```
switch_browser_instance(instance_id: 1)
browser_navigate(url: "https://example.com")  # 使用实例1
browser_click(element: "按钮")                 # 使用实例1
```

## 可用工具 (36个)

### 配置管理 (4个)
- `list_browser_profiles` - 列出所有配置
- `create_browser_profile` - 创建新配置
- `update_browser_profile` - 更新配置
- `delete_browser_profile` - 删除配置

### 账号管理 (5个)
- `add_account` - 添加账号
- `list_accounts` - 列出账号
- `find_account` - 查找账号
- `update_account` - 更新账号
- `delete_account` - 删除账号

### 实例管理 (5个)
- `launch_browser` - 启动浏览器
- `list_browser_instances` - 列出实例
- `switch_browser_instance` - 切换活跃实例
- `stop_browser_instance` - 停止实例
- `cleanup_orphaned_instances` - 清理孤立记录

### 浏览器操作 (22个 - 来自 @playwright/mcp)

**所有浏览器工具都支持可选的 `instance_id` 参数，可直接指定要操作的浏览器实例**

- `browser_navigate` - 导航到 URL
- `browser_click` - 点击元素
- `browser_type` - 输入文本
- `browser_screenshot` - 截图
- `browser_evaluate` - 执行 JavaScript
- `browser_fill_form` - 批量填充表单
- `browser_select_option` - 选择下拉选项
- `browser_hover` - 鼠标悬停
- `browser_drag` - 拖拽操作
- `browser_handle_dialog` - 处理对话框
- `browser_file_upload` - 文件上传
- `browser_navigate_back` - 后退
- `browser_tabs` - 标签页管理
- `browser_wait_for` - 等待元素/文本/时间
- `browser_console_messages` - 获取控制台消息
- `browser_network_requests` - 获取网络请求
- `browser_run_code` - 执行 Playwright 代码片段
- `browser_close` - 关闭页面
- 其他高级操作工具...

## 架构

```
┌─────────────────────────────────────────┐
│      LLM Agent (Claude/Cursor)          │
│  "启动 twitter-bot 的 account1"          │
└────────────────┬────────────────────────┘
                 │ stdio (MCP Protocol)
                 ↓
┌─────────────────────────────────────────┐
│       BotBrowser-MCP Server             │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │   自定义工具 (14个)              │   │
│  │   - 配置管理 (4)                 │   │
│  │   - 账号管理 (5)                 │   │
│  │   - 实例管理 (5)                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │   PlaywrightMCPProxy            │   │
│  │   - 包装 @playwright/mcp        │   │
│  │   - 动态上下文切换               │   │
│  │   - 浏览器工具 (22个)            │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │   PlaywrightManager             │   │
│  │   instances: Map {              │   │
│  │     1: { context, browser }     │   │
│  │     2: { context, browser }     │   │
│  │   }                             │   │
│  │   activeInstanceId: 1           │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │   SQLite Database               │   │
│  │   ~/.botbrowser-mcp/            │   │
│  │   - browser_profiles            │   │
│  │   - accounts                    │   │
│  │   - browser_instances           │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
                 │
                 ↓
    ┌────────────────────────────┐
    │   实际运行的浏览器          │
    │   Instance 1: Chrome       │
    │   Instance 2: Chrome       │
    └────────────────────────────┘
```

## 技术特性

### 多实例浏览器切换

- **动态上下文切换**: 使用 `PlaywrightMCPProxy` 包装 @playwright/mcp，通过 `resetContext()` 清除缓存
- **独立浏览器状态**: 每个实例维护独立的页面、会话和导航历史
- **完整配置支持**: 提供包含超时设置的完整 BrowserServerBackend 配置
- **直接实例指定**: 所有浏览器工具支持 `instance_id` 参数，无需切换即可操作指定实例

**工作原理:**
1. AI Agent 调用浏览器工具时，可选提供 `instance_id` 参数
2. 如果提供了 `instance_id`，临时切换到该实例
3. 执行工具操作后，自动恢复到之前的活跃实例
4. 如果未提供 `instance_id`，使用当前活跃实例

**示例:**
```javascript
// 同时操作两个浏览器实例，无需显式切换
await browser_navigate({ url: "https://twitter.com", instance_id: 1 });
await browser_navigate({ url: "https://facebook.com", instance_id: 2 });
await browser_click({ element: "Tweet按钮", ref: "xyz", instance_id: 1 });
await browser_click({ element: "Post按钮", ref: "abc", instance_id: 2 });
```

### 元数据字段

账号的 `metadata` 字段支持任意格式，LLM 可自由存取：

```
# 键值对格式
metadata: "password: abc123, 2fa: JBSWY3DP, email: backup@gmail.com"

# JSON 格式
metadata: '{"password":"abc123","2fa":"JBSWY3DP","recovery":["c1","c2"]}'

# 自然语言
metadata: "密码是 abc123，双因素认证是 JBSWY3DP，备用邮箱 backup@gmail.com"
```

### 用户数据目录管理

**自动管理:**
- 每个 Profile 使用固定的 userDataDir: `~/.botbrowser-mcp/user-data/{profile_alias}/`
- 首次启动自动创建并存储到数据库
- 停止实例时**不会删除** userDataDir，下次启动继续使用
- 保留浏览器缓存、扩展、网站数据、会话等

**双重状态保存:**
1. **userDataDir** - 完整的浏览器状态（缓存、扩展、设置等）
2. **storage_state_path** (可选) - 仅保存 Cookies 和 LocalStorage

**多开限制:**
- 同一 Profile 不能同时启动多个实例（Playwright 限制）
- 需要多开请创建多个 Profile（可使用相同的 executable_path）

## 数据存储

所有数据存储在: `~/.botbrowser-mcp/`

**目录结构:**
```
~/.botbrowser-mcp/
├── botbrowser.db              # SQLite 数据库
└── user-data/                 # 浏览器用户数据目录
    ├── twitter-bot/           # Profile: twitter-bot
    ├── work-profile/          # Profile: work-profile
    └── personal/              # Profile: personal
```

**数据库表:**
- `browser_profiles` - 浏览器配置（包含 user_data_dir）
- `accounts` - 账号信息
- `browser_instances` - 运行中的实例

可使用 SQLite 客户端查看：
```bash
sqlite3 ~/.botbrowser-mcp/botbrowser.db
SELECT alias, user_data_dir FROM browser_profiles;
```

## 常见问题

**Q: 如何知道哪个实例是活跃的？**  
A: 使用 `list_browser_instances` 查看，`is_active: 1` 的实例就是当前活跃实例。

**Q: 可以同时操作多个实例吗？**  
A: 可以！有两种方式：
   1. 在每个工具调用时指定 `instance_id` 参数（推荐）
   2. 使用 `switch_browser_instance` 切换活跃实例

**Q: 为什么同一个 Profile 不能多开？**  
A: Playwright 的 `launchPersistentContext` 会锁定 userDataDir，同一目录只能被一个实例使用。如需多开，请创建多个 Profile。

**Q: 如何实现多账号同时登录？**  
A: 为每个账号创建独立的 Profile：
```
create_browser_profile(alias: "twitter-account1", ...)
create_browser_profile(alias: "twitter-account2", ...)
launch_browser(profile_alias: "twitter-account1")
launch_browser(profile_alias: "twitter-account2")
```

**Q: userDataDir 什么时候清理？**  
A: 不会自动清理。停止实例时保留 userDataDir 以便下次使用。如需清理，手动删除 `~/.botbrowser-mcp/user-data/{profile}/`。

**Q: Cookie 什么时候保存？**  
A: 
   - userDataDir 中的数据实时保存
   - storage_state_path（如果配置）在停止实例时保存

**Q: 什么时候需要使用 instance_id 参数？**  
A: 当你需要频繁在多个浏览器之间切换操作时，使用 `instance_id` 更方便，避免反复调用 `switch_browser_instance`。

**Q: 孤立实例记录是什么？**  
A: 如果程序异常退出，浏览器已关闭但数据库记录还在，使用 `cleanup_orphaned_instances` 清理。

## 故障排查

如果遇到 "Connection closed" 错误：
1. 确保使用最新版本: `npm install -g botbrowser-mcp@latest`
2. 尝试完整路径: `"command": "/usr/local/bin/botbrowser-mcp"`
3. 检查 Node.js 已安装: `node --version`

## 依赖

- Node.js 18+
- @playwright/mcp - 浏览器自动化工具
- playwright - 浏览器驱动
- better-sqlite3 - SQLite 数据库

## 许可证

Apache-2.0

