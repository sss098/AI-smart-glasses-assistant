import { Audio } from 'expo-av';
import { textToSpeech } from './xfyun-tts';
import { useState } from 'react';

let audioPlayer: Audio.Sound | null = null;

export async function startAudio(text: string) {
  try {
    // 使用讯飞 TTS
    const audioData = await textToSpeech(text);
    if (audioPlayer) {
      await audioPlayer.unloadAsync();
    }
    audioPlayer = new Audio.Sound();
    await audioPlayer.loadAsync({ uri: URL.createObjectURL(new Blob([audioData], { type: 'audio/mp3' })) });
    await audioPlayer.playAsync();
  } catch (error) {
    console.error('TTS error:', error);
    throw error;
  }
}

export async function stopAudio() {
  if (audioPlayer) {
    try {
      await audioPlayer.stopAsync();
      await audioPlayer.unloadAsync();
      audioPlayer = null;
    } catch (error) {
      console.error('Error stopping audio:', error);
    }
  }
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const useOpenAI = () => {
  const [response, setResponse] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async (message: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'user',
              content: message,
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error('API 请求失败');
      }

      const data = await response.json();
      setResponse(data.choices[0].message.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : '发生未知错误');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    response,
    isLoading,
    error,
    sendMessage,
  };
}; 