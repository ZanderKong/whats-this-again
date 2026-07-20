# 「这是啥来着」

[English](README.en.md)

「这是啥来着」是一款 Chrome Manifest V3 阅读辅助插件。它面向技术文档、论文、英文资料和行业文章阅读场景，在用户划选陌生概念、缩写或短句后，调用用户配置的 AI 模型生成结合上下文的简洁解释，并把有价值的回答保存为本地阅读记忆。

插件强调低干扰体验：解释默认是临时的，只有用户主动保存后才进入历史；再次遇到已保存词语时，页面只显示轻量提示，不长期覆盖正文。

## 快速开始

### 安装插件

当前仓库提供源码形式的未打包扩展，可以按中文浏览器界面这样加载：

1. 打开 `chrome://extensions`。如果使用 Vivaldi，也可以打开 `vivaldi://extensions`。
2. 打开右上角的「开发者模式」。
3. 点击左上角的「加载已解包扩展」。Chrome 中文界面中这个按钮也可能显示为「加载已解压的扩展程序」。
4. 选择本项目根目录，也就是包含 `manifest.json` 的目录。
5. 首次安装会自动打开快速教程，可在其中配置模型并测试连接。
6. 完成或跳过教程后，刷新目标网页并开始划选文本；设置页可随时重新打开教程。

浏览器内部页面、Chrome Web Store 页面和其他扩展页面无法运行内容脚本，这是 Chrome 的安全限制。

### 怎么使用

1. 在普通网页中选中一个词语、缩写或短句。
2. 点击选区旁的小圆点，使用默认 prompt 生成解释。
3. 如需自定义问题，长按小圆点打开输入框。
4. 在回答面板中继续追问，或保存全文/节选。
5. 后续再次遇到同一词语时，通过历史提示回看已保存解释。

## 图文速览

点击图片可以查看原图。

<table>
  <tr>
    <td width="33%" valign="top">
      <a href="docs/assets/readme/how-to-use.png">
        <img src="docs/assets/readme/how-to-use.png" alt="「这是啥来着」使用方法：短按解释、长按提问、悬浮查看、历史回看" width="100%">
      </a>
      <br>
      <strong>短按解释、长按提问</strong>
    </td>
    <td width="33%" valign="top">
      <a href="docs/assets/readme/quick-lookup.png">
        <img src="docs/assets/readme/quick-lookup.png" alt="划词即查，留在当前语境里快速理解陌生概念" width="100%">
      </a>
      <br>
      <strong>留在当前语境里理解</strong>
    </td>
    <td width="33%" valign="top">
      <a href="docs/assets/readme/keep-context.png">
        <img src="docs/assets/readme/keep-context.png" alt="不分屏、不跳出当前页面，让解释留在正在阅读的位置" width="100%">
      </a>
      <br>
      <strong>不分屏、不跳出页面</strong>
    </td>
  </tr>
</table>

## 友链

- [LINUX DO](https://linux.do) - 面向开发者的中文社区。本项目根据 [LINUX DO 开源推广说明](https://linux.do/t/topic/1776670) 添加友链。

## 当前版本

- 扩展版本：`0.5.2`
- Manifest：Chrome Manifest V3
- Landing page：`docs/index.html`
- 数据存储：`chrome.storage.local`

## 核心能力

- **选词解释**：在网页中划选词语或短句后，点击选区旁入口生成解释。
- **上下文感知**：可把选区附近的简短前后文发送给模型，提高解释准确性。
- **自定义提问**：长按入口打开输入框，直接输入自定义问题。
- **独立问答界面**：回答区与输入区是同级 Surface，避免多层白色卡片嵌套。
- **首次快速教程**：八步完成模型连接、划线、追问、保存和批注教学，设置页可重新打开。
- **连续追问**：在回答面板中继续围绕同一概念提问。
- **多处批注**：连续暂存多段原文和意见，在批注篮中直接编辑或删除后拖入 AI 输入框，不自动发送。
- **可靠回退**：编辑器注入核验失败时写入剪贴板，只有匹配的粘贴行为才会完成待处理批注。
- **主动保存**：临时回答默认不入库；点击保存后才写入本地历史。
- **节选保存**：选中回答片段后保存，只保留真正有用的内容。
- **历史提示**：再次遇到保存过的词语时，以低干扰提示回看旧解释。
- **多模型支持**：支持常见 OpenAI-compatible 服务和本地模型服务。
- **预设主题**：提供五套经过验证的主题色，不接受任意自定义颜色。
- **本地优先**：插件不包含遥测，不向项目作者运营的服务器发送数据。

## 模型配置

设置页提供以下预设，也支持自定义 OpenAI-compatible 接口：

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

默认 prompt：

```text
联系上下文{{term}} ，请用简洁中文解释这个概念。如果在该文中单独定义了该词，则回答。
```

从 `0.3.0` 起，插件支持中文和英文界面。语言默认跟随浏览器，也可在设置页手动切换。

默认 prompt 会跟随设置页语言自动切换；其中 `{{term}}` 代表当前选中的文本。

## 隐私与数据

「这是啥来着」不会把数据发送到项目作者的服务器，也不包含遥测。

插件会在发起解释时向用户配置的模型接口发送：

- 选中的词语或短句。
- 用户输入的问题。
- 选区附近的简短上下文，仅在上下文选项开启时发送。

以下数据保存在本地浏览器的 `chrome.storage.local`：

- 模型配置和 API Key。
- 默认 prompt、主题色、保存范围和提示方式。
- 用户主动保存的解释、节选、追问和来源页面信息。
- 暂存和已处理的批注原文、有限上下文、用户意见、页面信息与交付状态。

插件仅在用户拖放注入失败或主动点击“复制全部”时写入剪贴板；不会读取剪贴板，也不会自动发送消息。批注拖入第三方 AI 输入框后，由对应网站按其隐私政策处理。批注内容不会发送到项目作者的服务器。

使用第三方模型服务时，请同时遵守该服务的隐私政策和数据使用条款。

## 权限说明

`manifest.json` 使用以下权限：

- `storage`：保存设置和历史解释。
- `activeTab`：刷新当前页面状态。
- `tabs`：打开历史来源页面和设置页面。
- `clipboardWrite`：仅在拖放注入失败或用户主动复制批注时写入整合文本；插件没有读取剪贴板的权限。
- `http://*/*`、`https://*/*`：在普通网页中注入内容脚本。

工具栏图标使用 `16`、`24`、`32`、`48` 和 `128` 像素 PNG，以适配不同浏览器缩放和显示密度。

## 项目结构

```text
.
├── assets
│   ├── icon16.png
│   ├── icon24.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── docs
│   ├── assets
│   │   ├── hero-product.jpg
│   │   ├── icon128.png
│   │   └── readme
│   │       ├── how-to-use.png
│   │       ├── keep-context.png
│   │       └── quick-lookup.png
│   ├── index.html
│   └── styles.css
├── src
│   ├── background
│   ├── content
│   ├── history
│   ├── onboarding
│   ├── options
│   ├── popup
│   ├── shared
│   └── vendor
├── tools
│   ├── package-extension.mjs
│   └── validate-extension.mjs
├── manifest.json
├── package.json
└── README.md
```

## 本地开发

项目不需要构建步骤，源码目录即可作为 Chrome unpacked extension 加载。

提交前运行：

```bash
npm run validate
```

校验脚本会检查 manifest、入口文件、图标尺寸和主要 JavaScript 语法。

## 打包

生成 zip 包：

```bash
npm run package
```

输出文件为 `dist/whats-this-again.zip`。正式提交 Chrome Web Store 前，还需要根据商店要求补充隐私政策、截图、分类和详细说明。

## 已知限制

- 历史匹配基于保存词语的文本匹配，不做语义归并。
- 网页刷新后，未保存的临时回答不会保留。
- 当前主要面向 Chromium 系浏览器；Firefox、Safari 和移动端未做兼容性承诺。
- 模型质量、响应速度和数据处理政策取决于用户配置的模型服务商。

## 许可证

本项目采用 MIT License。详见 [LICENSE](LICENSE)。
