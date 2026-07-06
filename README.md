# 这是啥来着

这是啥来着是一款面向技术阅读场景的 Chrome Manifest V3 插件。它帮助用户在网页中遇到陌生概念、缩写、术语或上下文相关表达时，快速调用自定义 AI 模型获得简洁解释，并把有价值的回答保存为本地阅读记忆。

插件的设计目标是降低阅读中断感：解释默认是临时的，保存需要用户主动确认；保存后的历史记录只在再次悬停到同一词语附近时以低干扰胶囊提示，不会长期高亮或改写页面正文。

## 功能特性

- **选词解释**：在普通网页中划选词语或短句后显示小圆点，点击后按默认 prompt 自动生成解释。
- **上下文感知**：可读取选区附近前后文，帮助模型判断术语在当前文章里的具体含义。
- **自定义提问**：长按圆点直接打开回答框，输入自定义 prompt。
- **继续追问**：在回答框内继续提问，按 Enter 发送，Shift+Enter 换行。
- **主动保存**：临时回答默认不进入历史；点击保存后才写入本地历史记录。
- **节选保存**：选中回答中的局部文字后保存，可只保留真正有用的片段。
- **历史回看提示**：同一网页或其他页面再次遇到保存过的词语时，悬停到词语附近会显示“存有 x 条记录”胶囊提示，点击后打开历史回答。
- **可移动回答框**：拖动标题栏可移动回答框，点击标题栏可折叠或展开。
- **多模型提供商**：支持 DeepSeek、Kimi、火山方舟、智谱 GLM、MiniMax、硅基流动、OpenAI、OpenRouter、Groq、本地 Ollama、LM Studio，以及自定义 OpenAI-compatible 地址。
- **模型列表刷新**：支持模型列表接口的提供商可在设置页刷新模型列表；不支持时仍可手动填写模型名。
- **保存范围控制**：可设置保存解释仅匹配当前页面、域名家族，或所有网页。
- **本地优先**：设置、API Key、保存的解释都存放在 `chrome.storage.local`，插件不包含遥测。

## 使用方式

1. 在网页中选中一个词语、术语或短句。
2. 点击选区旁边的小圆点，插件会按默认 prompt 生成解释。
3. 如需自定义问题，长按圆点打开输入框。
4. 觉得回答有价值时点击保存。
5. 之后再次在任意匹配范围内遇到同一词语，鼠标悬停到词语附近会出现历史提示胶囊。

## 安装到 Chrome

当前项目是源码形式的未打包插件，可通过开发者模式加载：

1. 打开 `chrome://extensions`。
2. 开启右上角的 `Developer mode`。
3. 点击 `Load unpacked`。
4. 选择本项目根目录，也就是包含 `manifest.json` 的目录。
5. 打开插件设置页，配置模型提供商、API Base URL、API Key 和模型名。

浏览器内部页面、Chrome Web Store 页面、其他扩展页面无法运行内容脚本，这是 Chrome 的安全限制。

## 模型配置

设置页提供常见模型服务商预设。你也可以使用任何兼容 OpenAI Chat Completions API 的服务。

| 提供商 | Base URL 示例 | 说明 |
| --- | --- | --- |
| DeepSeek | `https://api.deepseek.com/v1` | 默认提供商 |
| Kimi | `https://api.moonshot.cn/v1` | 支持刷新模型列表 |
| 火山方舟 | `https://ark.cn-beijing.volces.com/api/v3` | 通常需要手动填写模型名 |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4` | 支持 OpenAI-compatible 调用 |
| OpenAI | `https://api.openai.com/v1` | 支持官方模型接口 |
| OpenRouter | `https://openrouter.ai/api/v1` | 可路由多家模型 |
| Groq | `https://api.groq.com/openai/v1` | 支持高速推理模型 |
| Ollama | `http://localhost:11434/v1` | 本地模型，可不填 API Key |
| LM Studio | `http://localhost:1234/v1` | 本地模型，可不填 API Key |

默认 prompt 为：

```text
联系上下文，请用简洁中文解释这个概念。
```

可以在设置页修改，也可以使用 `{{term}}` 引用当前选中的词语。

## 隐私与数据

这是啥来着不会把数据发送到插件作者的服务器，也不包含遥测。

插件会在以下情况下向你配置的模型接口发送数据：

- 选中的词语或短句。
- 用户输入的问题。
- 如果开启上下文选项，会发送选区附近的简短前后文。

以下数据保存在本地浏览器的 `chrome.storage.local`：

- 模型配置和 API Key。
- 默认 prompt、主题色和保存范围。
- 用户主动保存的解释、节选、追问和来源页面信息。

如果你使用第三方模型服务，请同时阅读该服务的隐私政策和数据使用条款。

## 权限说明

`manifest.json` 使用以下权限：

- `storage`：保存设置和历史解释。
- `activeTab`：配合工具栏刷新当前页面状态。
- `tabs`：打开历史来源页面和设置页面。
- `http://*/*`、`https://*/*`：在普通网页中注入内容脚本，用于选词解释和历史提示。

## 项目结构

```text
.
├── assets
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── src
│   ├── background
│   │   └── background.js
│   ├── content
│   │   └── content.js
│   ├── history
│   │   ├── history.css
│   │   ├── history.html
│   │   └── history.js
│   ├── options
│   │   ├── options.css
│   │   ├── options.html
│   │   └── options.js
│   ├── popup
│   │   ├── popup.css
│   │   ├── popup.html
│   │   └── popup.js
│   ├── shared
│   │   └── constants.js
│   └── vendor
│       └── mark.min.js
├── tools
│   └── validate-extension.mjs
├── manifest.json
├── package.json
└── README.md
```

## 本地开发

项目不需要构建步骤，源码目录即可作为 Chrome unpacked extension 加载。

推荐在提交前运行：

```bash
npm run validate
```

校验脚本会检查：

- `manifest.json` 是否可解析。
- 插件名称是否为“这是啥来着”。
- Manifest 引用的入口文件和图标是否存在。
- 图标 PNG 尺寸是否符合 manifest 声明。
- 主要 JavaScript 文件是否通过 `node --check` 语法检查。

## 打包发布

可用以下命令生成 zip 包：

```bash
npm run package
```

生成的 `dist/zhe-shi-sha-lai-zhe.zip` 可用于手动备份或提交到 Chrome Web Store 的发布流程。正式上架前建议补充隐私政策页面，并根据商店要求准备截图、详细说明和分类信息。

## 已知限制

- 历史匹配基于保存词语的文本匹配，不做语义合并或同义词归并。
- 网页刷新后，未保存的临时回答不会保留。
- 目前主要面向 Chromium 系浏览器；Firefox、Safari 和移动端未做兼容性承诺。
- 模型质量、响应速度和数据处理政策取决于用户配置的模型服务商。

## 贡献

欢迎通过 issue 或 pull request 提交问题、建议和改进。提交代码前请运行 `npm run validate`，并尽量保持 UI 的低干扰阅读体验。

## 许可证

本项目采用 MIT License。详见 [LICENSE](LICENSE)。
