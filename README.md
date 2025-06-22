# AI Smart Glasses Assistant - Open Source Smart Glasses Project

AI Smart Glasses Assistant is an open-source smart glasses project, optimized and innovated based on the [OpenGlass](https://github.com/BasedHardware/OpenGlass) project. It aims to provide you with a powerful and highly customizable personal AI assistant. By combining the power of your smartphone with the convenience of glasses, this project can observe the world, talk to you, and help you with various tasks.

## ✨ Key Features

- **👓 Real-time Visual Q&A**: Takes a picture of what you see based on your command, describes what you see, and answers follow-up questions about the image.
- **🤖️ Multi-Model AI Support**: The system integrates multiple powerful Large Language Models (LLMs) and can intelligently switch between them based on the task:
    - **Ollama**: Drives core tool usage and general conversation.
    - **Zhipu AI (GLM-4V)**: Handles complex visual Q&A tasks.
    - **Groq**: Provides high-speed text responses.
    - **OpenAI**: Serves as a high-quality alternative model.
- **🌐 Autonomous Web Browsing**: This project is more than just an image describer. It can control the browser on your computer to perform tasks like "open Baidu," "scan the page," "click the button," or "type in the input box."
- **🗣️ Fluent Voice Interaction**: Integrates iFlytek's speech recognition (ASR) and text-to-speech (TTS) technology for a natural, low-latency Chinese voice conversation experience.
- **🔌 Bluetooth Connectivity**: Seamlessly connects with the companion smart glasses hardware (based on ESP32-S3) via Bluetooth Low Energy (BLE).
- **🔧 Highly Extensible**: The project uses a tool-based modular architecture, allowing you to easily add new features and integrations.

## 🚀 Key Feature Improvements

1.  **Multi-modal AI Agent**: The agent can process both text and images simultaneously, enabling true visual Q&A capabilities.
2.  **Autonomous Web Browsing**: The agent can control a full desktop browser to perform complex tasks, greatly expanding its practical applications.
3.  **Tool-Based Extensibility**: The agent's capabilities are defined and extended through a series of clear "tools." This architecture makes adding new features (e.g., controlling other applications, connecting to smart homes) straightforward.
4.  **Flexible AI Backend**: The system design allows for dynamic selection of the most appropriate AI model for the task, achieving the best balance between cost, speed, and performance.
5.  **Intelligent Context Switching**: The agent can intelligently distinguish between general conversation and questions about an image, providing more accurate and contextual answers.

## 📂 Project Structure

```
.
├── firmware/              # Firmware for ESP32-S3 glasses hardware (Arduino)
├── sources/               # Core source code for the React Native application
│   ├── agent/             # Core logic for the AI agent
│   ├── app/               # UI views and main components
│   ├── modules/           # Functional modules (e.g., AI models, Bluetooth, TTS)
│   └── utils/             # Utility functions
├── browser-control-server.js # Local server for browser control (Node.js + Playwright)
├── App.tsx                # Application entry point
├── package.json           # Project dependencies and scripts
└── README.md              # The file you are currently reading
```

## 🛠️ Getting Started

### 1. Prerequisites

- **Node.js**: `v18` or higher.
- **Yarn** or **npm**: For package management.
- **Git**: For cloning the repository.
- **Ollama**: For running large language models locally. Visit [ollama.com](https://ollama.com/) to download and install. After installation, run the following commands to pull the required models for the project:
  
  ```bash
  ollama pull qwen2:1.5b-instruct-fp16
  ollama pull moondream:1.8b-v2-fp16
  ollama pull qwen:latest
  ```
- **Arduino CLI**: (Optional) If you need to modify and upload the firmware.
- **Expo Go App**: Install the Expo Go app on your phone for debugging.

### 2. Clone the Project

```bash
git clone https://github.com/your-username/ai-dialogue-smart-glasses.git
cd ai-dialogue-smart-glasses
```

### 3. Install Dependencies

```bash
yarn install
# or
npm install
```

### 4. Configure API Keys

This is the most important step! The project requires API keys from several services to function correctly. Please enter your keys directly into the code.

- **`sources/keys.ts`**:
  - Fill in your `Groq` and `OpenAI` API keys in this file. The `Ollama` URL usually does not need to be changed.
  ```typescript
  export const keys = {
    // Get from https://console.groq.com/keys
    groq: "YOUR_GROQ_API_KEY_HERE",
    // Default local ollama address, modify if different
    ollama: "http://localhost:11434/api/chat",
    // Get from https://platform.openai.com/api-keys
    openai: "YOUR_OPENAI_API_KEY_HERE",
  };
  ```

- **`sources/app/DeviceView.tsx` and `sources/components/VoiceChat.tsx`**:
  - In these two files, find the `xfyunConfig` object and fill in your `appId`, `apiKey`, and `apiSecret` obtained from the [iFlytek Open Platform](https://www.xfyun.cn/).

- **`sources/modules/zhipuai.ts`**:
  - Find the `API_KEY` variable in this file and fill in your key from the [Zhipu AI Open Platform](https://open.bigmodel.cn/).

### 5. Run the Project

This project consists of two main parts: the React Native app and the browser control server. You need to run both simultaneously.

**a) Run the Browser Control Server**

Open a new terminal window and run the following command:

```bash
yarn browser-server
# or
npm run browser-server
```

This server will start and wait for commands from the main application to control the Microsoft Edge browser.

**b) Run the React Native App**

In the original terminal window, run:

```bash
yarn start
# or
npm start
```

This will start the Expo Metro server. You can use the Expo Go app on your phone to scan the QR code and run the application on your device.

### 6. Hardware and Firmware

- **Hardware**: The project uses [Seeed Studio XIAO ESP32S3](https://www.seeedstudio.com/Seeed-XIAO-ESP32S3-p-5631.html) and [EEMB LP502030 3.7v 250mAH battery](https://www.amazon.com/EEMB-Battery-Rechargeable-Lithium-Connector/dp/B08VRZTHDL).
- **Case Model**: The file is `Glass shell model.stl` in the `firmware` directory.
- **Firmware**: The `firmware` directory contains the Arduino firmware used. Open the `.ino` file in the Arduino IDE, add the ESP32S3 board to your Arduino IDE, then go to the library manager on the left menu, search for and install libraries like `ArduinoBLE` and `Adafruit Pycamera Library`. After that, go to the "Tools" dropdown in the Arduino IDE, ensure "PSRAM:" is set to "OPI PSRAM", and then click the `Upload` button.

## 🤝 Contributing

We welcome contributions of all forms! If you have any ideas, suggestions, or find a bug, please feel free to submit a Pull Request or create an Issue.

## 📄 License

This project is open-sourced under the [MIT License](LICENSE). 