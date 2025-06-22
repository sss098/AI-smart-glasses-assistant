import { KnownModel, ollamaInference } from "../modules/ollama";
import { groqRequest } from "../modules/groq-llama3";
import { gptRequest } from "../modules/openai";

export async function imageDescription(
  src: Uint8Array,
  model: KnownModel = "moondream:1.8b-v2-fp16"
): Promise<string> {
  return ollamaInference({
    model: model,
    messages: [
      {
        role: "system",
        content:
          "You are a very advanced model and your task is to describe the image as precisely as possible. Transcribe any text you see.",
      },
      {
        role: "user",
        content: "Describe the scene",
        images: [src],
      },
    ],
  });
}

export async function translateToChinese(
  englishText: string,
  model: KnownModel = "qwen:latest"
): Promise<string> {
  const response = await ollamaInference({
    model: model,
    messages: [
      {
        role: "system",
        content: "你是一个翻译助手，请将英文翻译为流畅自然的中文。",
      },
      {
        role: "user",
        content: `请翻译以下内容：\n${englishText}`,
      },
    ],
  });

  return response;
}

export async function llamaFind(
  question: string,
  images: string
): Promise<string> {
  return ollamaInference({
    model: "qwen:latest",
    messages: [
      {
        role: "system",
        content: `你是一个智能助手，需要根据图片描述来回答用户的问题。
                以下是图片描述：
                ${images}
                
                请直接回答问题，不要提及图片描述。
                不要尝试概括或提供可能的场景。
                只使用图片描述中的信息来回答问题。
                回答要简洁具体。`,
      },
      {
        role: "user",
        content: question,
      },
    ],
  });
}

export async function openAIFind(
  question: string,
  images: string
): Promise<string> {
  return gptRequest(
    `
                You are a smart AI that need to read through description of a images and answer user's questions.

                This are the provided images:
                ${images}

                DO NOT mention the images, scenes or descriptions in your answer, just answer the question.
                DO NOT try to generalize or provide possible scenarios.
                ONLY use the information in the description of the images to answer the question.
                BE concise and specific.
            `,
    question
  );
}
