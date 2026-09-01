from abc import ABC, abstractmethod
from typing import AsyncGenerator, Dict, Any, Optional

class VoiceTransport(ABC):
    """
    Abstract interface for real-time audio transport.
    Could be a Browser WebSocket, LiveKit, or SIP connection.
    """
    @abstractmethod
    async def receive_audio(self) -> AsyncGenerator[bytes, None]:
        pass

    @abstractmethod
    async def send_audio(self, audio_chunk: bytes):
        pass
        
    @abstractmethod
    async def close(self):
        pass

class SpeechToTextProvider(ABC):
    @abstractmethod
    async def transcribe_stream(self, audio_stream: AsyncGenerator[bytes, None]) -> AsyncGenerator[str, None]:
        pass

class TextToSpeechProvider(ABC):
    @abstractmethod
    async def synthesize(self, text: str) -> AsyncGenerator[bytes, None]:
        pass

class LLMProvider(ABC):
    @abstractmethod
    async def generate_response(self, conversation_history: list, tools: list, state: dict) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Yields either:
        {"type": "text", "content": "..."}
        {"type": "tool_call", "name": "...", "arguments": {...}}
        """
        pass
