import { useState, useEffect } from 'react';

interface RecognitionResult {
  transcript: string;
  isFinal: boolean;
}

// 添加 Web Speech API 的类型定义
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
  length: number;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
}

declare global {
  interface Window {
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export const useSpeechRecognition = () => {
  const [isListening, setIsListening] = useState(false);
  const [result, setResult] = useState<RecognitionResult>({ transcript: '', isFinal: false });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 检查浏览器是否支持语音识别
    if (!('webkitSpeechRecognition' in window)) {
      setError('您的浏览器不支持语音识别功能');
      return;
    }

    const SpeechRecognition = window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    // 配置语音识别
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'zh-CN'; // 设置语言为中文

    // 处理识别结果
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('');

      setResult({
        transcript,
        isFinal: event.results[0].isFinal
      });
    };

    // 处理错误
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setError(`语音识别错误: ${event.error}`);
      setIsListening(false);
    };

    // 处理识别结束
    recognition.onend = () => {
      setIsListening(false);
    };

    // 如果正在监听，启动识别
    if (isListening) {
      recognition.start();
    }

    // 清理函数
    return () => {
      recognition.stop();
    };
  }, [isListening]);

  // 开始监听
  const startListening = () => {
    setError(null);
    setIsListening(true);
  };

  // 停止监听
  const stopListening = () => {
    setIsListening(false);
  };

  return {
    isListening,
    result,
    error,
    startListening,
    stopListening
  };
}; 