import axios from "axios";
import { keys } from "../keys";
import CryptoJS from 'crypto-js';

// 科大讯飞TTS配置
const APP_ID = "2ac1d767";
const API_KEY = "43825bd74df2aa5c96c7bba1922f5272";
const API_SECRET = "YjZkMGJlNjYxNDE4MTg5MDU2NTA5OTUy";
const HOST = "tts-api.xfyun.cn";
const TTS_URL = "wss://tts-api.xfyun.cn/v2/tts";

class WsParam {
    constructor(
        private APPID: string,
        private APIKey: string,
        private APISecret: string,
        private Text: string,
        private Vcn: string = "xiaoyan"
    ) {}

    createUrl(): string {
        const date = new Date().toUTCString();
        const requestLine = "GET /v2/tts HTTP/1.1";
        const signatureOrigin = `host: ${HOST}\ndate: ${date}\n${requestLine}`;
        
        // 使用CryptoJS进行HMAC-SHA256加密
        const signatureSha = CryptoJS.HmacSHA256(signatureOrigin, this.APISecret);
        const signatureBase64 = CryptoJS.enc.Base64.stringify(signatureSha);

        const authorizationOrigin = `api_key="${this.APIKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureBase64}"`;
        const authorization = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(authorizationOrigin));

        const params = new URLSearchParams({
            authorization,
            date,
            host: HOST
        });

        return `${TTS_URL}?${params.toString()}`;
    }

    getRequestData() {
        return {
            common: { app_id: this.APPID },
            business: {
                aue: "lame",
                sfl: 1,
                vcn: this.Vcn,
                tte: "utf8",
                speed: 50,
                volume: 50,
                pitch: 50
            },
            data: {
                status: 2,
                text: CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(this.Text))
            }
        };
    }
}

export async function textToSpeech(text: string): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
        try {
            const wsParam = new WsParam(APP_ID, API_KEY, API_SECRET, text);
            const ws = new WebSocket(wsParam.createUrl());

            let audioData = new Uint8Array(0);
            let isConnected = false;

            // 设置超时
            const timeout = setTimeout(() => {
                if (!isConnected) {
                    ws.close();
                    reject(new Error('WebSocket connection timeout'));
                }
            }, 5000);

            ws.onopen = () => {
                isConnected = true;
                clearTimeout(timeout);
                console.log('WebSocket connected');
                ws.send(JSON.stringify(wsParam.getRequestData()));
            };

            ws.onmessage = (event) => {
                try {
                    const response = JSON.parse(event.data);
                    if (response.code !== 0) {
                        reject(new Error(`TTS Error: ${response.message}`));
                        ws.close();
                        return;
                    }

                    if (response.data?.audio) {
                        const audio = Uint8Array.from(atob(response.data.audio), c => c.charCodeAt(0));
                        const newAudioData = new Uint8Array(audioData.length + audio.length);
                        newAudioData.set(audioData);
                        newAudioData.set(audio, audioData.length);
                        audioData = newAudioData;
                    }

                    if (response.data?.status === 2) {
                        ws.close();
                        resolve(audioData);
                    }
                } catch (error) {
                    reject(error);
                    ws.close();
                }
            };

            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                clearTimeout(timeout);
                reject(error);
            };

            ws.onclose = () => {
                clearTimeout(timeout);
                if (audioData.length === 0) {
                    reject(new Error('No audio data received'));
                }
            };
        } catch (error) {
            reject(error);
        }
    });
} 