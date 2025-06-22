import axios from 'axios';
import { toBase64 } from '../utils/base64';

export async function zhipuaiInference(args: {
  messages: {
    role: "system" | "user" | "assistant";
    content: string | Array<{
      type: "text" | "image_url";
      text?: string;
      image_url?: {
        url: string;
      };
    }>;
  }[];
}) {
  // Get your ZhipuAI API key from https://open.bigmodel.cn/
  const API_KEY = "YOUR_ZHIPUAI_API_KEY_HERE";
  
  const response = await axios.post(
    "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    {
      model: "glm-4v-flash",
      messages: args.messages,
    },
    {
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data.choices[0].message.content;
} 