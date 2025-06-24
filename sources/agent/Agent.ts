import * as React from "react";
import { AsyncLock } from "../utils/lock";
import {
  imageDescription,
  translateToChinese,
} from "./imageDescription";
import { startAudio } from "../modules/tts";
import { ollamaInference, KnownModel } from "../modules/ollama";
import {
  toolBrowserClickElement,
  toolBrowserClosePage,
  toolBrowserGetContent,
  toolBrowserGoBack,
  toolBrowserGoForward,
  toolBrowserLabelElements,
  toolBrowserOpenUrl,
  toolBrowserRefreshPage, // <--- 确保这一行存在
  toolBrowserScroll,
  toolBrowserTypeInElement
} from "../modules/browser";
import { zhipuaiInference } from "../modules/zhipuai";
import { toBase64 } from "../utils/base64";

type AgentState = {
  lastDescription?: string;
  answer?: string;
  loading: boolean;
  isImageQuestionMode: boolean;
  isImageResponse?: boolean;
};

const tools = [
  {
    name: "browser_open_url",
    description: "打开一个指定的URL。当你需要访问某个网站时首先使用它。",
    parameters: [
      { name: "url", type: "string", description: "需要打开的完整URL地址，例如 'https://www.google.com'" }
    ]
  },
  {
    name: "browser_label_elements",
    description: "扫描当前浏览器页面，并为所有可见的可交互元素（如链接、按钮、输入框）分配一个数字ID。这是与页面交互的第一步。在点击或输入之前，必须先调用此工具来获取元素的ID。",
    parameters: []
  },
  {
    name: "browser_click_element",
    description: "根据ID点击一个页面上的可交互元素。必须先使用'browser_label_elements'工具获取元素的ID。",
    parameters: [
      { name: "id", type: "number", description: "需要点击的元素的数字ID" }
    ]
  },
  {
    name: "browser_type_in_element",
    description: "在一个指定的输入框中输入文本。必须先使用'browser_label_elements'工具获取输入框的ID。",
    parameters: [
      { name: "id", type: "number", description: "目标输入框的数字ID" },
      { name: "text", type: "string", description: "要输入的文本内容" }
    ]
  },
  {
    name: "browser_get_content",
    description: "获取当前已打开页面的文本内容摘要。用于理解页面信息。",
    parameters: []
  },
  {
    name: "browser_scroll",
    description: "在当前页面上进行滚动。",
    parameters: [
      { name: "direction", type: "string", enum: ["up", "down"], description: "滚动的方向：'up'为向上，'down'为向下" }
    ]
  },
  {
    name: "browser_go_back",
    description: "返回到浏览历史的上一页。",
    parameters: []
  },
  {
    name: "browser_go_forward",
    description: "前进到浏览历史的下一页。",
    parameters: []
  },
  {
    name: "browser_refresh_page",
    description: "刷新当前页面。当页面加载异常或需要重新加载内容时使用。",
    parameters: []
  },
  {
    name: "browser_close_page",
    description: "关闭当前的浏览器标签页。",
    parameters: []
  }
];

const SYSTEM_PROMPT = `你是一个强大的AI助手，你可以使用工具来帮助用户在网络浏览器中完成任务。
你的决策过程严格遵循"思考-行动-观察"的循环。

**与浏览器交互的工作流程**:
1. **打开页面**: 用户要求打开网址时，使用 \`browser_open_url\`。
2. **扫描页面**: 页面打开后，**必须**首先使用 \`browser_label_elements\` 工具来查看页面上有哪些可交互的元素。这会给所有按钮、链接和输入框分配一个ID。
3. **执行操作**: 查看扫描结果后，根据用户的指令和元素的ID，选择使用 \`browser_click_element\` 或 \`browser_type_in_element\`。
4. **获取内容/滚动**: 如果需要，可以使用 \`browser_get_content\` 来阅读页面文本，或使用 \`browser_scroll\` 来查看页面其他部分，滚动后应重新扫描。
5. **刷新页面**: 当页面加载异常、内容需要更新或用户明确要求刷新时，使用 \`browser_refresh_page\`。
6. **重复**: 重复扫描和行动，直到任务完成。

**快捷指令**:
- 用户说"刷新"、"refresh"或"刷新网页"时，直接使用 \`browser_refresh_page\` 工具
- 用户说"前进"、"go forward"或"网页前进"时，使用 \`browser_go_forward\` 工具
- 用户说"后退"、"go back"或"网页回退"时，使用 \`browser_go_back\` 工具
- 用户说"关闭"、"close"或"关闭网页"时，使用 \`browser_close_page\` 工具
- 用户说"向上滚动"或"scroll up"时，使用 \`browser_scroll\` 工具，参数为"up"
- 用户说"向下滚动"或"scroll down"时，使用 \`browser_scroll\` 工具，参数为"down"
- 用户说"扫描页面"或"scan page"时，使用 \`browser_label_elements\` 工具

可用工具列表:
${JSON.stringify(tools, null, 2)}

每次回应时，你必须从以下两种模式中选择一种：

模式一：调用工具
你的回答必须是这个格式的、不包含任何其他文字的JSON对象:
{
  "tool": "工具名称",
  "parameters": {
    "参数名": "参数值"
  }
}

模式二：直接回答
如果任务完成，或者你正在对用户说话，请直接用纯文本回答。

现在，让我们开始吧！`;

export class Agent {
  #lock = new AsyncLock();
  #photos: { photo: Uint8Array; description: string }[] = [];
  #state: AgentState = { loading: false, isImageQuestionMode: false, isImageResponse: false };
  #stateCopy: AgentState = { loading: false, isImageQuestionMode: false, isImageResponse: false };
  #stateListeners: (() => void)[] = [];

  async addPhoto(photos: Uint8Array[]) {
    await this.#lock.inLock(async () => {
      // Append photos
      let lastDescription: string | null = null;
      for (let p of photos) {
        console.log("Processing photo", p.length);
        let description = await imageDescription(p);
        console.log("Description", description);
        description = await translateToChinese(description);
        console.log("Chinese Description", description);
        this.#photos.push({ photo: p, description });
        lastDescription = description;
        
        // 直接设置答案并播放
        this.#state.answer = description;
        this.#state.isImageResponse = true;  // 标记这是图片响应
        this.#notify();  // 触发 UI 更新
        await startAudio(description);
      }

      // 更新状态
      if (lastDescription) {
        this.#state.lastDescription = lastDescription;
        this.#notify();
      }
    });
  }

  toggleImageQuestionMode() {
    this.#state.isImageQuestionMode = !this.#state.isImageQuestionMode;
    this.#notify();
    return this.#state.isImageQuestionMode;
  }

  async answer(question: string) {
    if (this.#state.loading) {
      return;
    }
    this.#state.loading = true;
    this.#state.isImageResponse = false;
    this.#notify();
    await this.#lock.inLock(async () => {
      try {
        let rawAnswer = "";

        // 优先判断是否在图像追问模式
        if (this.#state.isImageQuestionMode && this.#photos.length > 0) {
          // 在此模式下，所有问题都视为对最后一张照片的追问
          const latestPhoto = this.#photos[this.#photos.length - 1];
          rawAnswer = await this.#handleImageQuestion(question, latestPhoto.photo);
          this.#state.isImageResponse = true;

        } else if (this.#photos.length > 0 && (question.toLowerCase().includes("照片") || question.toLowerCase().includes("图片") || question.toLowerCase().includes("拍照") || question.toLowerCase().includes("拍"))) {
          // 如果不是追问模式，但问题涉及照片，直接返回已保存的中文描述
          const latestPhoto = this.#photos[this.#photos.length - 1];
          rawAnswer = latestPhoto.description;
          this.#state.isImageResponse = true;

        } else {
          // 处理一般对话
          rawAnswer = await this.#handleGeneralConversation(question);
        }

        // 移除<think>标签并设置最终答案
        const finalAnswer = rawAnswer.replace(/<think>[\s\S]*<\/think>/, '').trim();
        this.#state.answer = finalAnswer;
        
        // 任何时候都播报语音
        await startAudio(finalAnswer);

      } catch (error) {
        console.error("Error in answer:", error);
      } finally {
        this.#state.loading = false;
        this.#notify();
      }
    });
  }

  async #handleImageQuestion(question: string, photo: Uint8Array): Promise<string> {
    // 如果是追问模式，使用智谱AI
    if (this.#state.isImageQuestionMode) {
      const base64Image = toBase64(photo);
      const response = await zhipuaiInference({
        messages: [
          {
            role: "system",
            content: "你是一个智能助手，需要根据图片回答用户的问题。请保持友好和专业的态度。"
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: base64Image
                }
              },
              {
                type: "text",
                text: question
              }
            ]
          }
        ]
      });
      return response;
    }
    
    // 非追问模式，使用 moondream 生成描述并用 qwen 翻译
    const description = await imageDescription(photo);
    return await translateToChinese(description);
  }

  async #handleGeneralConversation(question: string): Promise<string> {
    
    // 快捷指令处理
    const trimmedQuestion = question.trim();
    const numericId = parseInt(trimmedQuestion, 10);

    if (!isNaN(numericId) && /^\d+$/.test(trimmedQuestion)) {
      console.log(`快捷指令：点击ID为 ${numericId} 的元素`);
      return await toolBrowserClickElement(numericId);
    }
    if (trimmedQuestion === "前进" || trimmedQuestion.toLowerCase() === "go forward" || trimmedQuestion === "网页前进") {
      console.log("快捷指令：前进");
      return await toolBrowserGoForward();
    }
    if (trimmedQuestion === "后退" || trimmedQuestion.toLowerCase() === "go back" || trimmedQuestion === "网页回退") {
      console.log("快捷指令：后退");
      return await toolBrowserGoBack();
    }
    if (trimmedQuestion === "刷新" || trimmedQuestion.toLowerCase() === "refresh" || trimmedQuestion === "刷新网页") {
      console.log("快捷指令：刷新页面");
      return await toolBrowserRefreshPage();
    }
    if (trimmedQuestion === "关闭" || trimmedQuestion.toLowerCase() === "close" || trimmedQuestion === "关闭网页") {
      console.log("快捷指令：关闭页面");
      return await toolBrowserClosePage();
    }
    if (trimmedQuestion === "向上滚动" || trimmedQuestion.toLowerCase() === "scroll up") {
      console.log("快捷指令：向上滚动");
      return await toolBrowserScroll("up");
    }
    if (trimmedQuestion === "向下滚动" || trimmedQuestion.toLowerCase() === "scroll down") {
      console.log("快捷指令：向下滚动");
      return await toolBrowserScroll("down");
    }
    if (trimmedQuestion === "扫描页面" || trimmedQuestion.toLowerCase() === "scan page") {
      console.log("快捷指令：扫描页面");
      return await toolBrowserLabelElements();
    }

    let messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: question },
    ];

    for (let i = 0; i < 5; i++) { // 最多进行5轮工具调用
      
      const responseText = await ollamaInference({
        model: "qwen2:1.5b-instruct-fp16", // 推荐使用qwen2系列模型以获得更好的工具调用效果
        messages: messages,
      });
      
      messages.push({ role: "assistant", content: responseText });

      try {
        // 从返回的文本中提取纯净的JSON部分
        const jsonRegex = /\{[\s\S]*\}/;
        const match = responseText.match(jsonRegex);

        if (match) {
            const toolCall = JSON.parse(match[0]);
            if (toolCall.tool && toolCall.parameters) {
              console.log("Tool call:", toolCall);
              
              let toolResult = "";
              if (toolCall.tool === "browser_open_url") {
                toolResult = await toolBrowserOpenUrl(toolCall.parameters.url);
              } else if (toolCall.tool === "browser_get_content") {
                toolResult = await toolBrowserGetContent();
              } else if (toolCall.tool === "browser_label_elements") {
                toolResult = await toolBrowserLabelElements();
              } else if (toolCall.tool === "browser_click_element") {
                toolResult = await toolBrowserClickElement(toolCall.parameters.id);
              } else if (toolCall.tool === "browser_type_in_element") {
                toolResult = await toolBrowserTypeInElement(toolCall.parameters.id, toolCall.parameters.text);
              } else if (toolCall.tool === "browser_scroll") {
                toolResult = await toolBrowserScroll(toolCall.parameters.direction);
              } else if (toolCall.tool === "browser_go_back") {
                toolResult = await toolBrowserGoBack();
              } else if (toolCall.tool === "browser_go_forward") {
                toolResult = await toolBrowserGoForward();
              } else if (toolCall.tool === "browser_refresh_page") {
                toolResult = await toolBrowserRefreshPage();
              } else if (toolCall.tool === "browser_close_page") {
                toolResult = await toolBrowserClosePage();
              } else {
                toolResult = `未知的工具: ${toolCall.tool}`;
              }

              console.log("Tool result:", toolResult);
              messages.push({
                role: "system", // 使用system角色来提供工具结果
                content: `工具执行结果:\n${toolResult}`,
              });
              continue; // 继续循环，让模型根据工具结果进行下一步操作
            }
        } else {
            // 如果没有找到JSON，直接返回文本
            return responseText;
        }

      } catch (e) {
        // 如果提取或解析JSON失败，也直接返回原始文本
        return responseText;
      }
    }
    return "工具调用次数过多，请简化你的问题。";
  }

  #notify = () => {
    this.#stateCopy = { ...this.#state };
    for (let l of this.#stateListeners) {
      l();
    }
  };

  use() {
    const [state, setState] = React.useState(this.#stateCopy);
    React.useEffect(() => {
      const listener = () => setState(this.#stateCopy);
      this.#stateListeners.push(listener);
      return () => {
        this.#stateListeners = this.#stateListeners.filter(
          (l) => l !== listener
        );
      };
    }, []);
    return state;
  }
}
