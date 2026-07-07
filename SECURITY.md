# Security Policy

[English](SECURITY.en.md)

## 支持范围

`main` 分支是当前受支持的开发线。安全修复会优先合入该分支。

## 漏洞报告

如发现安全问题，请先私下联系仓库维护者，不要在公开 issue 中披露可利用细节。

报告中建议包含：

- 浏览器和操作系统版本。
- 插件版本或 commit SHA。
- 复现步骤。
- 是否可能影响 API Key、保存的阅读记忆或页面内容。

## 安全说明

- API Key 存储在 `chrome.storage.local`。
- 插件只会把选中文本、用户问题和可选上下文发送到用户配置的模型接口。
- 插件不包含遥测，也不使用项目作者运营的后端服务。
- Ollama、LM Studio 等本地模型接口可以在不配置 API Key 的情况下使用。
