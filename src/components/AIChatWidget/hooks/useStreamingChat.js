import { useState, useCallback, useRef } from 'react';

export function useStreamingChat() {
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef(null);

  const sendStreamingMessage = useCallback(async (conversationId, content, onEvent) => {
    if (isStreaming) return;

    setIsStreaming(true);
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`/api/ai/chat/${conversationId}/messages/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (!data) continue;

            try {
              const event = JSON.parse(data);
              onEvent(event);
            } catch (e) {
              console.error('Parse error:', data);
            }
          }
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        onEvent({ type: 'error', error: error.message });
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [isStreaming]);

  return { isStreaming, sendStreamingMessage };
}
