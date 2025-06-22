import { textToSpeech as xfyunTextToSpeech } from "./xfyun-tts";

let currentAudio: HTMLAudioElement | null = null;

export async function startAudio(text: string) {
    try {
        await textToSpeech(text);
    } catch (error) {
        console.error("Error in startAudio:", error);
    }
}

export async function textToSpeech(text: string) {
    try {
        // 使用科大讯飞的TTS服务
        const audioBuffer = await xfyunTextToSpeech(text);
        
        // 将音频数据转换为Blob
        const blob = new Blob([audioBuffer], { type: 'audio/mp3' });
        const audioUrl = URL.createObjectURL(blob);

        // 停止当前正在播放的音频
        if (currentAudio) {
            currentAudio.pause();
            currentAudio = null;
        }

        // 创建新的音频元素并播放
        const audio = new Audio(audioUrl);
        currentAudio = audio;

        // 监听播放完成事件
        audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            currentAudio = null;
        };

        // 开始播放
        await audio.play();

        return audioBuffer;
    } catch (error) {
        console.error("Error in textToSpeech:", error);
        return null;
    }
} 