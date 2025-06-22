import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { XfyunASR, XfyunConfig } from '../modules/xfyun-asr';
import { useOpenAI } from '../modules/openai';

// 讯飞配置
// Get your Xunfei API key from https://www.xfyun.cn/
const xfyunConfig: XfyunConfig = {
  appId: 'YOUR_XFYUN_APP_ID',
  apiKey: 'YOUR_XFYUN_API_KEY',
  apiSecret: 'YOUR_XFYUN_API_SECRET'
};

// 消息类型
type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export const VoiceChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [asr, setAsr] = useState<XfyunASR | null>(null);
  const { response, isLoading, error: openaiError, sendMessage } = useOpenAI();

  // 初始化讯飞语音识别
  useEffect(() => {
    const xfyunAsr = new XfyunASR(xfyunConfig);
    setAsr(xfyunAsr);
    return () => {
      xfyunAsr.stop();
    };
  }, []);

  // 开始录音
  const startListening = useCallback(async () => {
    if (!asr) return;
    
    try {
      setError(null);
      setIsListening(true);
      setCurrentText('');
      
      await asr.start(
        (text) => {
          setCurrentText(text);
        },
        (error) => {
          setError(error.message);
          setIsListening(false);
        }
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : '启动录音失败');
      setIsListening(false);
    }
  }, [asr]);

  // 停止录音
  const stopListening = useCallback(async () => {
    if (!asr) return;
    
    try {
      await asr.stop();
      setIsListening(false);
      
      if (currentText) {
        // 添加用户消息
        const userMessage: Message = {
          role: 'user',
          content: currentText
        };
        setMessages(prev => [...prev, userMessage]);
        
        // 发送到 OpenAI
        await sendMessage(currentText);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '停止录音失败');
    }
  }, [asr, currentText, sendMessage]);

  // 处理 AI 响应
  useEffect(() => {
    if (response) {
      const assistantMessage: Message = {
        role: 'assistant',
        content: response
      };
      setMessages(prev => [...prev, assistantMessage]);
    }
  }, [response]);

  // 处理 OpenAI 错误
  useEffect(() => {
    if (openaiError) {
      setError(openaiError);
    }
  }, [openaiError]);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.messageContainer}>
        {messages.map((message, index) => (
          <View
            key={index}
            style={[
              styles.message,
              message.role === 'user' ? styles.userMessage : styles.assistantMessage
            ]}
          >
            <Text style={styles.messageText}>{message.content}</Text>
          </View>
        ))}
        {currentText && (
          <View style={[styles.message, styles.userMessage]}>
            <Text style={styles.messageText}>{currentText}</Text>
          </View>
        )}
      </ScrollView>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.controls}>
        <TouchableOpacity
          style={[
            styles.button,
            isListening ? styles.buttonActive : styles.buttonInactive
          ]}
          onPress={isListening ? stopListening : startListening}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isListening ? '停止录音' : '开始录音'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  messageContainer: {
    flex: 1,
    padding: 16,
  },
  message: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#E5E5EA',
  },
  messageText: {
    fontSize: 16,
    color: '#000',
  },
  errorContainer: {
    padding: 8,
    backgroundColor: '#FFE5E5',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
  },
  controls: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonActive: {
    backgroundColor: '#FF3B30',
  },
  buttonInactive: {
    backgroundColor: '#007AFF',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 