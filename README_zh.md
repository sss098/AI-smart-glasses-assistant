# AI smart glasses assistant   - 开源智能眼镜项目

AI smart glasses assistant   是一个开源的智能眼镜项目，基于[OpenGlass]([BasedHardware/OpenGlass: Turn any glasses into AI-powered smart glasses](https://github.com/BasedHardware/OpenGlass))项目进行优化改进创新，旨在为您提供一个功能强大、可高度定制的个人 AI 助手。通过将智能手机的强大功能与眼镜的便捷性相结合，本项目能够观察世界、与您对话、并帮助您完成各种任务。

## ✨ 主要功能

- **👓 实时视觉问答**: 根据用户指令拍下您眼前的景象，可以描述您看到的内容，并回答关于图像的追问。
- **🤖️ 多模型 AI 支持**: 系统集成了多种强大的大型语言模型（LLM），并能根据任务智能切换：
    - **Ollama**: 用于驱动核心的工具使用和通用对话。
    - **智谱AI (GLM-4V)**: 用于处理复杂的视觉问答任务。
    - **Groq**: 提供高速的文本响应。
    - **OpenAI**: 作为备选的高质量模型。
- **🌐 自主网页浏览**: 本项目不只是一个图片描述器。它可以控制电脑上的浏览器来执行任务，例如"打开百度"、"扫描页面"、"点击按钮"或"在输入框中输入"。
- **🗣️ 流畅的语音交互**: 集成科大讯飞的语音识别（ASR）和文本转语音（TTS）技术，提供自然、低延迟的中文语音对话体验。
- **🔌 蓝牙连接**: 通过低功耗蓝牙（BLE）与配套的智能眼镜硬件（基于 ESP32-S3）无缝连接。
- **🔧 高度可扩展**: 项目采用基于工具的模块化架构，您可以轻松地为其添加新的功能和集成。

## 🚀 主要功能改进点

1.  **多模态AI代理**: 代理能同时处理文本和图像，实现了真正的视觉问答能力。
2.  **自主网页浏览**: 代理能够控制一个完整的桌面浏览器来执行复杂任务，极大地扩展了其实用场景。
3.  **基于工具的可扩展性**: 代理的能力通过一系列明确的"工具"来定义和扩展。这种架构使得添加新功能（例如，控制其他应用、连接智能家居等）变得简单明了。
4.  **灵活的AI后端**: 系统设计允许根据任务类型动态选择最合适的AI模型，从而在成本、速度和性能之间取得最佳平衡。
5.  **智能上下文切换**: 代理能够智能地区分普通对话和针对图像的提问，从而提供更准确、更具上下文的回答。

## 📂 项目结构

```
.
├── firmware/              # ESP32-S3 眼镜硬件的固件 (Arduino)
├── sources/               # React Native 应用的核心源代码
│   ├── agent/             # AI 代理的核心逻辑
│   ├── app/               # UI 视图和主要组件
│   ├── modules/           # 功能模块 (如: AI模型, 蓝牙, TTS)
│   └── utils/             # 实用工具函数
├── browser-control-server.js # 用于控制浏览器的本地服务器 (Node.js + Playwright)
├── App.tsx                # 应用入口
├── package.json           # 项目依赖和脚本
└── README.md              # 就是你正在看的这个文件
```

## 🛠️ 开始使用

### 1. 环境准备

- **Node.js**: `v18` 或更高版本。
- **Yarn** 或 **npm**: 用于包管理。
- **Git**: 用于克隆仓库。
- **Ollama**: 用于在本地运行大语言模型。请访问 [ollama.com](https://ollama.com/) 下载并安装。安装后，请运行以下命令拉取项目所需的三个模型：
  
  ```bash
  ollama pull qwen2:1.5b-instruct-fp16
  ollama pull moondream:1.8b-v2-fp16
  ollama pull qwen:latest
  ```
- **Arduino CLI**: (可选) 如果您需要修改和上传固件。
- **Expo Go 应用**: 在您的手机上安装 Expo Go 应用以进行调试。

### 2. 克隆项目

```bash
git clone https://github.com/your-username/ai-dialogue-smart-glasses.git
cd ai-dialogue-smart-glasses
```

### 3. 安装依赖

```bash
yarn install
# 或者
npm install
```

### 4. 配置 API 密钥

这是最重要的一步！项目需要多个服务的 API 密钥才能正常工作。请直接在代码中填入您的密钥。

- **`sources/keys.ts`**:
  - 在此文件中填入您的 `Groq` 和 `OpenAI` 的 API 密钥。`Ollama` 的 URL 通常不需要修改。
  ```typescript
  export const keys = {
    // 在 https://console.groq.com/keys 获取
    groq: "YOUR_GROQ_API_KEY_HERE",
    // 默认本地ollama地址，如有不同请修改
    ollama: "http://localhost:11434/api/chat",
    // 在 https://platform.openai.com/api-keys 获取
    openai: "YOUR_OPENAI_API_KEY_HERE",
  };
  ```

- **`sources/app/DeviceView.tsx` 和 `sources/components/VoiceChat.tsx`**:
  - 在这两个文件中找到 `xfyunConfig` 对象，并填入您在 [讯飞开放平台](https://www.xfyun.cn/) 申请的 `appId`, `apiKey`, 和 `apiSecret`。

- **`sources/modules/zhipuai.ts`**:
  - 在该文件中找到 `API_KEY` 变量并填入您在 [智谱开放平台](https://open.bigmodel.cn/) 申请的密钥。

### 5. 运行项目

本项目包含两个主要部分：React Native 应用和浏览器控制服务器。您需要同时运行它们。

**a) 运行浏览器控制服务器**

打开一个新的终端窗口，运行以下命令：

```bash
yarn browser-server
# 或者
npm run browser-server
```

这个服务器会启动并等待来自主应用的指令来控制 Microsoft Edge 浏览器。

**b) 运行 React Native 应用**

在原来的终端窗口中，运行：

```bash
yarn start
# 或者
npm start
```

这会启动 Expo Metro 服务器。您可以使用手机上的 Expo Go 应用扫描显示的二维码来在您的手机上运行此应用。

### 6. 硬件与固件

- **硬件**: 项目的使用硬件是 [Seeed Studio XIAO ESP32S3](https://www.seeedstudio.com/Seeed-XIAO-ESP32S3-p-5631.html)、[EEMB LP502030 3.7v 250mAH battery](https://www.amazon.com/EEMB-Battery-Rechargeable-Lithium-Connector/dp/B08VRZTHDL)
- **外壳模型：**在`firmware` 目录下的`Glass shell model.stl`文件中
- **固件**: `firmware` 目录下包含了使用的 Arduino 固件，在 Arduino IDE 中打开 `.ino` 文件，然后将 ESP32S3 板 添加到您的 Arduino IDE后，点击左边菜单的库，搜索并安装 `ArduinoBLE`、`Adafruit Pycamera Library`等库后，转到Arduino IDE中的"工具"下拉列表，并确保将"PSRAM："设置为"PSRAM：""OPI PSRAM"，然后点击`上传`按钮

## 🤝 贡献

我们欢迎任何形式的贡献！如果您有任何想法、建议或发现了 Bug，请随时提交 Pull Request 或创建 Issue。

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源。 