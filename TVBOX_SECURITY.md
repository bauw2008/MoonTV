# TVBox 安全配置指南

## 🔒 安全问题

TVBox 的 JSON 接口默认无鉴权，可能被他人滥用。现已添加多种可选的安全机制。

## 🛠️ 后台配置界面

所有安全配置都可以在 **管理后台 > TVBox 安全配置** 页面中进行设置，无需修改环境变量或配置文件。

### 1. Token 鉴权（推荐）

通过 URL 参数添加 token 验证：

**后台配置步骤：**

1. 登录管理后台
2. 进入 "TVBox 安全配置" 页面
3. 启用 "Token 验证"
4. 系统会自动生成安全 token（也可手动修改）
5. 保存配置

**使用方式：**

- 无鉴权：`https://your-domain.com/api/tvbox`
- 有鉴权：`https://your-domain.com/api/tvbox?token=你的token`
- Base64 格式：`https://your-domain.com/api/tvbox?format=base64&token=你的token`

### 2. IP 白名单

限制只允许特定 IP 访问：

**后台配置步骤：**

1. 在管理后台的 "TVBox 安全配置" 中启用 "IP 白名单"
2. 添加允许访问的 IP 地址（支持单个 IP 或 CIDR 格式）
3. 保存配置

### 3. 访问频率限制

防止频繁访问滥用：

**后台配置步骤：**

1. 在管理后台启用 "频率限制"
2. 设置每分钟允许的最大请求次数（默认 60 次）
3. 保存配置

## 📱 TVBox 配置示例

### 无安全限制（默认）

```
https://your-domain.com/api/tvbox
```

### 启用 Token 验证

```
https://your-domain.com/api/tvbox?token=你的token
```

### Base64 格式配置

```
https://your-domain.com/api/tvbox?format=base64&token=你的token
```

## 💡 使用建议

### 家庭使用

- 在后台启用 "Token 验证" 即可
- 建议定期更换 token 以提高安全性

### 公网部署

- 建议启用所有三种安全机制：
  1. Token 验证（必选）
  2. 频率限制（推荐设置为 30 次/分钟）
  3. IP 白名单（如果 IP 相对固定）

### 内网使用

- 可以仅使用 IP 白名单限制内网访问
- 或使用 Token 验证提供额外安全性

## ⚠️ 注意事项

1. **TVBox 兼容性**：所有安全机制都是可选的，默认保持无鉴权兼容 TVBox
2. **后台配置**：所有设置都在管理后台中完成，实时生效无需重启
3. **Token 安全**：token 一旦启用，需要在 TVBox 中配置完整 URL 才能访问
4. **IP 白名单**：适合固定网络环境，移动设备可能 IP 变化
5. **频率限制**：防止暴力访问，正常使用不会触发
6. **组合使用**：可以同时启用多种安全机制

## 🔧 故障排除

### TVBox 无法加载配置

1. 检查 URL 是否包含正确的 token 参数
2. 确认 IP 是否在白名单中
3. 检查是否触发频率限制（等待 1 分钟后重试）
4. 在管理后台查看 TVBox 安全配置是否正确保存

### 错误信息说明

- `Invalid token`：token 不正确或缺失
- `Access denied for IP`：IP 不在白名单中
- `Rate limit exceeded`：访问频率过高

## 📊 配置管理

### 在管理后台中：

1. **实时预览**：可以看到生成的 TVBox 配置 URL
2. **安全状态**：显示当前启用的安全机制
3. **Token 管理**：支持自动生成或手动设置 token
4. **IP 管理**：可视化添加/删除 IP 白名单
5. **频率设置**：滑块调整请求限制次数

这些功能让 TVBox 安全配置变得简单直观，无需编辑配置文件。
