import * as React from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from "react-native";
import { rotateImage } from "../modules/imaging";
import { toBase64Image } from "../utils/base64";
import { Agent } from "../agent/Agent";
import { InvalidateSync } from "../utils/invalidateSync";
import { textToSpeech, startAudio } from "../modules/tts";
import { XfyunASR, XfyunConfig } from "../modules/xfyun-asr";
import { saveImageToLocal } from "../utils/fileUtils";

// 讯飞配置
// Get your Xunfei API key from https://www.xfyun.cn/
const xfyunConfig: XfyunConfig = {
  appId: 'YOUR_XFYUN_APP_ID',
  apiKey: 'YOUR_XFYUN_API_KEY',
  apiSecret: 'YOUR_XFYUN_API_SECRET'
};

// 定义消息类型
interface Message {
  role: 'user' | 'assistant';
  content: string;
  image?: Uint8Array;
}

function usePhotos(device: BluetoothRemoteGATTServer) {
  const [photos, setPhotos] = React.useState<Uint8Array[]>([]);
  const [subscribed, setSubscribed] = React.useState<boolean>(false);
  React.useEffect(() => {
    (async () => {
      let previousChunk = -1;
      let buffer: Uint8Array = new Uint8Array(0);
      function onChunk(id: number | null, data: Uint8Array) {
        if (previousChunk === -1) {
          if (id === null) {
            return;
          } else if (id === 0) {
            previousChunk = 0;
            buffer = new Uint8Array(0);
          } else {
            return;
          }
        } else {
          if (id === null) {
            console.log("Photo received", buffer);
            rotateImage(buffer, "270").then((rotated) => {
              console.log("Rotated photo", rotated);
              setPhotos((p) => [...p, rotated]);
            });
            previousChunk = -1;
            return;
          } else {
            if (id !== previousChunk + 1) {
              previousChunk = -1;
              console.error("Invalid chunk", id, previousChunk);
              return;
            }
            previousChunk = id;
          }
        }
        buffer = new Uint8Array([...buffer, ...data]);
      }

      const service = await device.getPrimaryService(
        "19B10000-E8F2-537E-4F6C-D104768A1214".toLowerCase()
      );
      const photoCharacteristic = await service.getCharacteristic(
        "19b10005-e8f2-537e-4f6c-d104768a1214"
      );
      await photoCharacteristic.startNotifications();
      setSubscribed(true);
      photoCharacteristic.addEventListener(
        "characteristicvaluechanged",
        (e) => {
          let value = (e.target as BluetoothRemoteGATTCharacteristic).value!;
          let array = new Uint8Array(value.buffer);
          if (array[0] == 0xff && array[1] == 0xff) {
            onChunk(null, new Uint8Array());
          } else {
            let packetId = array[0] + (array[1] << 8);
            let packet = array.slice(2);
            onChunk(packetId, packet);
          }
        }
      );
      const photoControlCharacteristic = await service.getCharacteristic(
        "19b10006-e8f2-537e-4f6c-d104768a1214"
      );
      await photoControlCharacteristic.writeValue(new Uint8Array([0x05]));
    })();
  }, []);

  return [subscribed, photos] as const;
}

export const DeviceView = React.memo(
  (props: { device: BluetoothRemoteGATTServer }) => {
    const [subscribed, photos] = usePhotos(props.device);
    const agent = React.useMemo(() => new Agent(), []);
    const agentState = agent.use();
    const [isListening, setIsListening] = React.useState(false);
    const [currentText, setCurrentText] = React.useState('');
    const [error, setError] = React.useState<string | null>(null);
    const [asr, setAsr] = React.useState<XfyunASR | null>(null);
    const [inputText, setInputText] = React.useState('');
    const [messages, setMessages] = React.useState<Message[]>([]);
    const [isImageQuestionMode, setIsImageQuestionMode] = React.useState(false);

    // 照片同步
    const photoSync = React.useRef<InvalidateSync | null>(null);
    React.useEffect(() => {
      if (photos.length > 0) {
        if (photoSync.current === null) {
          photoSync.current = new InvalidateSync(async () => {
            // 静默添加照片，不再自动触发描述
          });
        }
        photoSync.current.invalidate();
      }
    }, [photos, agent]);

    // 更新消息列表
    React.useEffect(() => {
      if (agentState.answer && typeof agentState.answer === 'string' && !agentState.loading) {
        // 检查是否已经添加过这条消息
        const isDuplicate = messages.some(msg => 
          msg.role === 'assistant' && msg.content === agentState.answer
        );
        
        if (!isDuplicate) {
          // 如果是图像响应，则附加最新图片
          if (agentState.isImageResponse && photos.length > 0) {
            console.log('检测到图片相关消息，当前照片数量:', photos.length);
            const latestPhoto = photos[photos.length - 1];
            console.log('最新照片数据:', latestPhoto);

            // 添加描述消息和图片消息
            setMessages(prev => [
              ...prev,
              { 
                role: 'assistant', 
                content: agentState.answer as string,
                image: latestPhoto
              }
            ]);
          } else {
            // 普通消息
            setMessages(prev => [...prev, { 
              role: 'assistant', 
              content: agentState.answer as string 
            }]);
          }
        }
      }
    }, [agentState.answer, agentState.loading, agentState.isImageResponse, photos, messages]);

    // 请求麦克风权限
    const requestMicrophonePermission = React.useCallback(async () => {
      try {
        console.log('开始请求麦克风权限');
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('浏览器不支持 getUserMedia API');
        }

        const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        console.log('当前麦克风权限状态:', permissionStatus.state);

        if (permissionStatus.state === 'denied') {
          Alert.alert(
            "麦克风权限被拒绝",
            "请在浏览器设置中允许访问麦克风，然后刷新页面重试。",
            [{ text: "确定" }]
          );
          return false;
        }

        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
        stream.getTracks().forEach(track => track.stop());
        console.log('获得麦克风权限');
        return true;
      } catch (err) {
        console.error('请求麦克风权限失败:', err);
        Alert.alert(
          "需要麦克风权限",
          "请允许访问麦克风以使用语音功能",
          [{ text: "确定" }]
        );
        return false;
      }
    }, []);

    // 初始化讯飞语音识别
    React.useEffect(() => {
      console.log('初始化讯飞语音识别');
      const xfyunAsr = new XfyunASR(xfyunConfig);
      setAsr(xfyunAsr);
      return () => {
        console.log('清理讯飞语音识别');
        xfyunAsr.stop();
      };
    }, []);

    // 统一处理用户输入
    const handleSendMessage = React.useCallback(async (text: string) => {
      if (!text.trim()) return;

      setMessages(prev => [...prev, { role: 'user', content: text }]);

      const isImageRequest = text.includes('图片') || 
                           text.includes('图像') ||
                           text.includes('照片') || 
                           text.includes('image') || 
                           text.includes('photo') ||
                           text.includes('看') ||
                           text.includes('眼前有什么') ||
                           text.includes('这是什么') ||
                           text.includes('这是哪') ||
                           text.includes('帮我看看') ||
                           text.includes('识别一下') ||
                           text.includes('拍');

      if (isImageRequest && !isImageQuestionMode) {
        try {
          // 触发拍照
          const photoControlCharacteristic = await props.device.getPrimaryService(
            "19B10000-E8F2-537E-4F6C-D104768A1214".toLowerCase()
          ).then(service => service.getCharacteristic(
            "19b10006-e8f2-537e-4f6c-d104768a1214"
          ));
          await photoControlCharacteristic.writeValue(new Uint8Array([0xFF]));
          await new Promise(resolve => setTimeout(resolve, 5000));
          // 不再自动调用 agent.answer(text)
        } catch (error) {
          console.error('拍照或发送消息失败:', error);
          setError(error instanceof Error ? error.message : '拍照或发送消息失败');
        }
      } else {
        // 如果是图像追问模式，或者不是图像请求，直接让agent处理
        await agent.answer(text);
      }
    }, [agent, props.device, isImageQuestionMode]);

    // 开始录音
    const startListening = React.useCallback(async () => {
      if (!asr) {
        console.error('语音识别未初始化');
        return;
      }
      
      try {
        console.log('开始录音流程');
        const hasPermission = await requestMicrophonePermission();
        if (!hasPermission) {
          console.log('未获得麦克风权限');
          return;
        }

        setError(null);
        setIsListening(true);
        setCurrentText('');
        
        console.log('启动语音识别');
        await asr.start(
          (text) => {
            console.log('收到识别结果:', text);
            setCurrentText(text);
          },
          (error) => {
            console.error('语音识别错误:', error);
            setError(error.message);
            setIsListening(false);
          }
        );
      } catch (error) {
        console.error('启动录音失败:', error);
        setError(error instanceof Error ? error.message : '启动录音失败');
        setIsListening(false);
      }
    }, [asr, requestMicrophonePermission]);

    // 停止录音
    const stopListening = React.useCallback(async () => {
      if (!asr) return;
      
      setIsListening(false);
      await asr.stop();

      if (currentText) {
        const text = currentText.trim();
        setCurrentText('');
        if (text) {
          handleSendMessage(text);
        }
      }
    }, [asr, currentText, handleSendMessage]);

    // Background processing agent
    const processedPhotos = React.useRef<Uint8Array[]>([]);
    const sync = React.useMemo(() => {
      let processed = 0;
      return new InvalidateSync(async () => {
        if (processedPhotos.current.length > processed) {
          let unprocessed = processedPhotos.current.slice(processed);
          processed = processedPhotos.current.length;
          // 确保每张新照片都被处理
          for (const photo of unprocessed) {
            await agent.addPhoto([photo]);
          }
        }
      });
    }, [agent]);

    React.useEffect(() => {
      processedPhotos.current = photos;
      sync.invalidate();
    }, [photos, sync]);

    // 发送文本消息
    const sendTextMessage = React.useCallback(async () => {
      if (!inputText.trim()) return;
      const text = inputText;
      setInputText('');
      handleSendMessage(text);
    }, [inputText, handleSendMessage]);

    // 输入框回车处理
    const handleInputKeyPress = (e: any) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendTextMessage();
        }
    };

    // 处理图像追问模式切换
    const handleImageQuestionModeToggle = React.useCallback(async () => {
      const newMode = agent.toggleImageQuestionMode();
      setIsImageQuestionMode(newMode);
      
      const modeText = newMode ? "进入图像追问模式" : "退出图像追问模式";
      setMessages(prev => [...prev, { role: 'assistant', content: modeText }]);
      await startAudio(modeText);
    }, [agent]);

    // 使用useRef来持有最新的回调函数引用
    const sendTextMessageRef = React.useRef(sendTextMessage);
    const voiceActionRef = React.useRef(() => {
        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    });
    const imageQuestionToggleRef = React.useRef(handleImageQuestionModeToggle);

    // 确保ref持有最新的函数
    React.useEffect(() => {
        sendTextMessageRef.current = sendTextMessage;
    }, [sendTextMessage]);

    React.useEffect(() => {
        voiceActionRef.current = () => {
            if (isListening) {
                stopListening();
            } else {
                startListening();
            }
        };
    }, [isListening, startListening, stopListening]);

    React.useEffect(() => {
        imageQuestionToggleRef.current = handleImageQuestionModeToggle;
    }, [handleImageQuestionModeToggle]);

    // 添加键盘快捷键监听
    React.useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // 当焦点在输入框外时，Enter键发送消息
            if (event.key === 'Enter' && !(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) {
                sendTextMessageRef.current();
            } else if (event.key.toLowerCase() === 'q') {
                imageQuestionToggleRef.current();
            } else if (event.key.toLowerCase() === 'f') {
                voiceActionRef.current();
            } else if (event.key.toLowerCase() === 'r') {
                // R键刷新页面
                handleSendMessage("刷新网页");
            } else if (event.key.toLowerCase() === 'b') {
                // B键后退
                handleSendMessage("后退");
            } else if (event.key.toLowerCase() === 'n') {
                // N键前进
                handleSendMessage("前进");
            } else if (event.key === 'Escape') {
                // ESC键关闭页面
                handleSendMessage("关闭网页");
            } else if (event.key === 'ArrowUp') {
                // 上箭头键向上滚动
                handleSendMessage("向上滚动");
            } else if (event.key === 'ArrowDown') {
                // 下箭头键向下滚动
                handleSendMessage("向下滚动");
            } else if (event.key.toLowerCase() === 's') {
                // S键扫描页面
                handleSendMessage("扫描页面");
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        // 清理函数
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []); // 空依赖数组确保只在挂载和卸载时运行

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.headerTitle}>智能眼镜控制台</Text>
            <View style={[styles.statusIndicator, { backgroundColor: subscribed ? '#27ae60' : '#e74c3c' }]}>
              <Text style={styles.statusText}>{subscribed ? '已连接' : '未连接'}</Text>
            </View>
          </View>
          <Text style={styles.headerSubtitle}>
            {isImageQuestionMode ? "图像追问模式" : "正常模式"} | 
            快捷键: R刷新 B后退 N前进 ESC关闭 ↑↓滚动 S扫描 Q图像追问 F语音 Enter发送
          </Text>
        </View>
        
        <ScrollView 
          style={styles.chatContainer}
          contentContainerStyle={styles.chatContentContainer}
        >
          {messages.map((message, index) => (
            <View
              key={index}
              style={[
                styles.messageContainer,
                message.role === "user" ? styles.userMessage : styles.assistantMessage,
              ]}
            >
              <Text style={[
                styles.messageText,
                message.role === "user" ? styles.userMessageText : styles.assistantMessageText
              ]}>
                {message.content}
              </Text>
              {message.image && (
                <View style={styles.imageContainer}>
                  <Image
                    source={{ uri: toBase64Image(message.image) }}
                    style={styles.messageImage}
                    resizeMode="contain"
                    onError={(e) => console.error('图片加载错误:', e.nativeEvent.error)}
                  />
                </View>
              )}
            </View>
          ))}
          {agentState.loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#007AFF" />
              <Text style={styles.loadingText}>AI正在处理中...</Text>
            </View>
          )}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputContainer}>
          <View style={styles.textInputRow}>
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="输入消息..."
              placeholderTextColor="#999"
              multiline
              onKeyPress={handleInputKeyPress}
            />
            <TouchableOpacity
              style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
              onPress={sendTextMessage}
              disabled={!inputText.trim()}
            >
              <Text style={styles.sendButtonText}>发送</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.voiceButton, isListening && styles.voiceButtonActive]}
              onPress={isListening ? stopListening : startListening}
            >
              <Text style={styles.voiceButtonText}>
                {isListening ? "停止" : "语音"}
              </Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.functionButton, styles.imageQuestionButton, isImageQuestionMode && styles.imageQuestionButtonActive]}
              onPress={handleImageQuestionModeToggle}
            >
              <Text style={styles.functionButtonText}>
                图像追问
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.functionButton, styles.refreshButton]}
              onPress={() => handleSendMessage("刷新网页")}
            >
              <Text style={styles.functionButtonText}>
                刷新网页
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.functionButton, styles.closeButton]}
              onPress={() => handleSendMessage("关闭网页")}
            >
              <Text style={styles.functionButtonText}>
                关闭网页
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.functionButton, styles.backButton]}
              onPress={() => handleSendMessage("后退")}
            >
              <Text style={styles.functionButtonText}>
                网页回退
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.functionButton, styles.forwardButton]}
              onPress={() => handleSendMessage("前进")}
            >
              <Text style={styles.functionButtonText}>
                网页前进
              </Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.scrollRow}>
            <TouchableOpacity
              style={[styles.functionButton, styles.scrollUpButton]}
              onPress={() => handleSendMessage("向上滚动")}
            >
              <Text style={styles.functionButtonText}>
                向上滚动
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.functionButton, styles.scrollDownButton]}
              onPress={() => handleSendMessage("向下滚动")}
            >
              <Text style={styles.functionButtonText}>
                向下滚动
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.functionButton, styles.scanButton]}
              onPress={() => handleSendMessage("扫描页面")}
            >
              <Text style={styles.functionButtonText}>
                扫描页面
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#007AFF',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  statusIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    lineHeight: 18,
  },
  chatContainer: {
    flex: 1,
    padding: 16,
  },
  chatContentContainer: {
    paddingBottom: 20,
  },
  messageContainer: {
    maxWidth: '85%',
    marginVertical: 10,
    padding: 16,
    borderRadius: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 6,
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderBottomLeftRadius: 6,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#fff',
  },
  assistantMessageText: {
    color: '#2c3e50',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 16,
    borderRadius: 12,
    marginVertical: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 14,
    fontWeight: '500',
  },
  inputContainer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  textInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginRight: 12,
    fontSize: 16,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  sendButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginRight: 8,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  sendButtonDisabled: {
    backgroundColor: '#bdc3c7',
    shadowOpacity: 0,
    elevation: 0,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  voiceButton: {
    backgroundColor: '#27ae60',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: '#27ae60',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  voiceButtonActive: {
    backgroundColor: '#e74c3c',
    shadowColor: '#e74c3c',
  },
  voiceButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  functionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    marginHorizontal: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    minWidth: 70,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  functionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  imageQuestionButton: {
    backgroundColor: '#9b59b6',
  },
  imageQuestionButtonActive: {
    backgroundColor: '#8e44ad',
    shadowOpacity: 0.4,
  },
  refreshButton: {
    backgroundColor: '#3498db',
  },
  closeButton: {
    backgroundColor: '#e74c3c',
  },
  backButton: {
    backgroundColor: '#f39c12',
  },
  forwardButton: {
    backgroundColor: '#27ae60',
  },
  scrollRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scrollUpButton: {
    backgroundColor: '#2ecc71',
  },
  scrollDownButton: {
    backgroundColor: '#e67e22',
  },
  scanButton: {
    backgroundColor: '#9b59b6',
  },
  imageContainer: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f8f9fa',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  messageImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  loadingText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});
