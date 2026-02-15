"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatTab() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setStreamingContent("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No reader available");

      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((line) => line.trim());

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.text) {
                fullContent += data.text;
                setStreamingContent(fullContent);
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }

      const assistantMessage: Message = {
        role: "assistant",
        content: fullContent,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setStreamingContent("");
    } catch (error) {
      console.error("Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Make sure Ollama is running with phi3:mini model.",
        },
      ]);
      setStreamingContent("");
    } finally {
      setIsLoading(false);
    }
  };

  const exampleQuestions = [
    "Was ist die typische Betonfestigkeit für Wohngebäude?",
    "Wie berechne ich die Durchbiegung eines Trägers?",
    "Erkläre die Bodentragfähigkeit",
    "Was sind die Eurocode-Anforderungen für Stahlträger?",
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] max-w-4xl mx-auto w-full">
      <div className="mb-4">
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Civil Engineering AI Assistant
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
          Powered by Phi-3 Mini (3.8B) - Optimized for civil engineering
        </p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 mb-4 p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-800">
        {messages.length === 0 && !streamingContent ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 dark:text-zinc-400">
            <svg
              className="w-12 h-12 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
            <p className="mb-4">Ask questions about civil engineering</p>
            <div className="grid grid-cols-1 gap-2 w-full max-w-md">
              {exampleQuestions.map((question, idx) => (
                <button
                  key={idx}
                  onClick={() => setInput(question)}
                  className="text-left px-4 py-2 text-sm bg-white dark:bg-zinc-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-600 transition-colors"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}
            {streamingContent && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg px-4 py-2 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100">
                  <p className="whitespace-pre-wrap">
                    {streamingContent}
                    <span className="inline-block w-2 h-4 ml-1 bg-blue-600 animate-pulse" />
                  </p>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about structures, materials, codes, calculations..."
          className="flex-1 px-4 py-3 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-zinc-300 disabled:cursor-not-allowed transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}
