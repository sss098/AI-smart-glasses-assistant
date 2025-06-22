export const keys = {
  // Get your Groq API key from https://console.groq.com/keys
  groq:
    process.env.EXPO_PUBLIC_GROQ_API_KEY ??
    "YOUR_GROQ_API_KEY_HERE",
  // The default local ollama URL. Update if you have a different URL
  ollama:
    process.env.EXPO_PUBLIC_OLLAMA_API_URL ?? "http://localhost:11434/api/chat",
  // Get your OpenAI API key from https://platform.openai.com/api-keys
  openai:
    process.env.EXPO_PUBLIC_OPENAI_API_KEY ??
    "YOUR_OPENAI_API_KEY_HERE",
};
