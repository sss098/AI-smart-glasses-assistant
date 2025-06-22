import CryptoJS from 'crypto-js';
import { Platform } from 'react-native';

// 讯飞语音识别配置接口
export interface XfyunConfig {
  appId: string;
  apiKey: string;
  apiSecret: string;
}

// 讯飞语音识别选项接口
export interface XfyunASROptions {
  language?: string;
  accent?: string;
  format?: string;
  sampleRate?: string;
}

// WebSocket URL
const HOST = 'iat-api.xfyun.cn';
const PATH = '/v2/iat';

export class XfyunASR {
  private config: XfyunConfig;
  private options: XfyunASROptions;
  private ws: WebSocket | null = null;
  private isRecording: boolean = false;
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: any = null;
  private stream: MediaStream | null = null;
  private processor: any = null;

  constructor(config: XfyunConfig, options: XfyunASROptions = {}) {
    this.config = config;
    this.options = {
      language: 'cn',
      accent: 'mandarin',
      format: 'audio/L16;rate=16000',
      sampleRate: '16000',
      ...options
    };
  }

  // 生成鉴权URL
  private generateAuthUrl(): string {
    const host = 'wss://iat-api.xfyun.cn/v2/iat';
    const date = new Date().toUTCString();
    const algorithm = 'hmac-sha256';
    const headers = 'host date request-line';
    const signatureOrigin = `host: iat-api.xfyun.cn\ndate: ${date}\nGET /v2/iat HTTP/1.1`;
    const signatureSha = CryptoJS.HmacSHA256(signatureOrigin, this.config.apiSecret);
    const signature = CryptoJS.enc.Base64.stringify(signatureSha);
    const authorizationOrigin = `api_key="${this.config.apiKey}", algorithm="${algorithm}", headers="${headers}", signature="${signature}"`;
    const authorization = btoa(authorizationOrigin);

    return `${host}?authorization=${authorization}&date=${encodeURI(date)}&host=iat-api.xfyun.cn`;
  }

  // 初始化音频上下文
  private async initAudioContext(): Promise<void> {
    try {
      console.log('开始初始化音频');
      
      // 检查是否在 Web 环境
      if (Platform.OS !== 'web') {
        throw new Error('当前环境不支持语音识别');
      }

      // 检查浏览器是否支持必要的 API
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('浏览器不支持 getUserMedia API');
      }

      console.log('请求麦克风权限');
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,  // 设置采样率
          channelCount: 1     // 设置为单声道
        } 
      });
      console.log('获得麦克风权限');

      // 创建音频上下文
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) {
        throw new Error('浏览器不支持 AudioContext');
      }

      this.audioContext = new AudioContext({
        sampleRate: 16000  // 设置采样率
      });
      const source = this.audioContext.createMediaStreamSource(this.stream);
      
      // 创建音频处理器
      this.processor = this.audioContext.createScriptProcessor(1024, 1, 1);
      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      let isFirstChunk = true;
      this.processor.onaudioprocess = (e: any) => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          const audioData = e.inputBuffer.getChannelData(0);
          const base64Audio = this.audioToBase64(audioData);
          
          // 发送音频数据
          this.ws.send(JSON.stringify({
            common: {
              app_id: this.config.appId
            },
            business: {
              language: this.options.language,
              accent: this.options.accent,
              domain: "iat",
              vad_eos: 3000,
              nbest: 1,
              wbest: 1,
              pd: "speech"  // 添加标点符号
            },
            data: {
              status: isFirstChunk ? 0 : 1,  // 第一帧发送 0，后续发送 1
              format: "audio/L16;rate=16000",
              encoding: "raw",
              audio: base64Audio
            }
          }));
          
          isFirstChunk = false;
        }
      };
      console.log('音频上下文初始化完成');
    } catch (error) {
      console.error('初始化音频上下文失败:', error);
      throw error;
    }
  }

  // 将音频数据转换为Base64
  private audioToBase64(audioData: Float32Array): string {
    // 将 Float32Array 转换为 Int16Array
    const buffer = new ArrayBuffer(audioData.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < audioData.length; i++) {
      const s = Math.max(-1, Math.min(1, audioData[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    const int16Array = new Int16Array(buffer);
    
    // 将 Int16Array 转换为 Base64
    const bytes = new Uint8Array(int16Array.buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // 开始录音和识别
  public async start(onResult: (text: string) => void, onError: (error: Error) => void): Promise<void> {
    if (this.isRecording) {
      console.log('已经在录音中');
      return;
    }

    try {
      console.log('开始初始化语音识别');
      const url = this.generateAuthUrl();
      console.log('WebSocket URL:', url);
      
      this.ws = new WebSocket(url);

      this.ws.onopen = async () => {
        console.log('WebSocket连接已建立');
        try {
          await this.initAudioContext();
        } catch (error) {
          console.error('初始化音频上下文失败:', error);
          onError(error instanceof Error ? error : new Error('初始化音频失败'));
          this.stop();
        }
      };

      this.ws.onmessage = (event) => {
        console.log('收到WebSocket消息:', event.data);
        try {
          const response = JSON.parse(event.data);
          if (response.code !== 0) {
            console.error('语音识别错误:', response);
            onError(new Error(response.message || '语音识别失败'));
            return;
          }

          const result = response.data.result;
          if (result && result.ws) {
            let text = '';
            result.ws.forEach((ws: any) => {
              ws.cw.forEach((cw: any) => {
                if (cw.w) {  // 只添加非空文本
                  text += cw.w;
                }
              });
            });
            if (text) {  // 只处理非空结果
              console.log('识别结果:', text);
              onResult(text);
            }
          }
        } catch (error) {
          console.error('处理WebSocket消息失败:', error);
          onError(error instanceof Error ? error : new Error('处理语音识别结果失败'));
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket错误:', error);
        onError(new Error('WebSocket连接错误'));
        this.stop();
      };

      this.ws.onclose = () => {
        console.log('WebSocket连接已关闭');
        this.isRecording = false;
      };

      this.isRecording = true;
    } catch (error) {
      console.error('启动语音识别失败:', error);
      onError(error instanceof Error ? error : new Error('未知错误'));
      this.stop();
    }
  }

  // 停止录音和识别
  public async stop(): Promise<void> {
    console.log('停止录音');
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('发送结束标记');
      this.ws.send(JSON.stringify({
        data: {
          status: 2,
          format: 'audio/L16;rate=16000',
          encoding: 'raw',
          audio: ''
        }
      }));
      this.ws.close();
    }

    if (this.processor) {
      console.log('断开音频处理器');
      this.processor.disconnect();
      this.processor = null;
    }

    if (this.stream) {
      console.log('停止音频流');
      this.stream.getTracks().forEach(track => track.stop());
    }

    if (this.audioContext) {
      console.log('关闭音频上下文');
      await this.audioContext.close();
    }

    this.ws = null;
    this.stream = null;
    this.audioContext = null;
    this.isRecording = false;
    console.log('录音已完全停止');
  }
} 