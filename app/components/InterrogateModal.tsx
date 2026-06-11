'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { TopAd } from '@/lib/types';

interface Clip {
    start: number;
    end: number;
    score: number;
}

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    clips?: Clip[];
}

type SSEChunk = { type: string; delta?: string; output?: { clips?: Clip[] } };

const SUGGESTIONS = [
    'Show me the hook',
    'Where does the product appear?',
    'Find the CTA moment',
    'Show social proof',
    "What's the pacing like?",
];

let msgCounter = 0;
function nextId() {
    return String(++msgCounter);
}

function fmtTime(s: number): string {
    const m = Math.floor(s / 60);
    const sec = (s % 60).toFixed(1);
    return m > 0 ? `${m}:${sec.padStart(4, '0')}` : `${sec}s`;
}

// Parses agent text and converts timestamp mentions (e.g. "4.5–9 seconds") into clickable seek buttons.
function renderContent(text: string, onSeek: (start: number) => void): React.ReactNode {
    const clean = text.replace(/\*\*/g, ''); // strip markdown bold
    // Matches "4.5-9 seconds", "4.5–9.5 seconds", "4.5 - 9 second"
    const TIMESTAMP = /(\d+(?:\.\d+)?)\s*[–\-]\s*(\d+(?:\.\d+)?)\s*seconds?/g;
    const nodes: React.ReactNode[] = [];
    const k = { v: 0 };
    let cursor = 0;
    let m: RegExpExecArray | null;

    function pushText(chunk: string) {
        chunk.split('\n').forEach((line, i) => {
            if (i > 0) nodes.push(<br key={k.v++} />);
            if (line) nodes.push(line);
        });
    }

    while ((m = TIMESTAMP.exec(clean)) !== null) {
        if (m.index > cursor) pushText(clean.slice(cursor, m.index));
        const start = parseFloat(m[1]);
        const end = parseFloat(m[2]);
        nodes.push(
            <button key={k.v++} className="inlineTimestamp" onClick={() => onSeek(start)}>
                {fmtTime(start)}–{fmtTime(end)}
            </button>,
        );
        cursor = m.index + m[0].length;
    }
    pushText(clean.slice(cursor));
    return <>{nodes}</>;
}

export function InterrogateModal({ ad, onClose }: { ad: TopAd; onClose: () => void }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [activeClipStart, setActiveClipStart] = useState<number | null>(null);

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') onClose();
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const seekToClip = useCallback((clip: Clip) => {
        setActiveClipStart(clip.start);
        if (videoRef.current) {
            videoRef.current.currentTime = clip.start;
            videoRef.current.pause();
        }
    }, []);

    const sendMessage = useCallback(
        async (text: string) => {
            if (!text.trim() || isLoading) return;

            const userMsg: ChatMessage = { id: nextId(), role: 'user', content: text };
            const assistantId = nextId();
            const assistantMsg: ChatMessage = { id: assistantId, role: 'assistant', content: '' };

            const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));

            setMessages((prev) => [...prev, userMsg, assistantMsg]);
            setInput('');
            setIsLoading(true);

            try {
                const res = await fetch('/api/interrogate/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        messages: history,
                        indexId: ad.twelveLabsIndexId,
                        videoId: ad.twelveLabsVideoId,
                    }),
                });

                if (!res.body) throw new Error('No response body');

                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                let assistantText = '';
                let clips: Clip[] = [];

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() ?? '';

                    for (const line of lines) {
                        if (!line.startsWith('data: ')) continue;
                        const raw = line.slice(6).trim();
                        if (raw === '[DONE]') continue;

                        try {
                            const chunk = JSON.parse(raw) as SSEChunk;
                            if (chunk.type === 'text-delta' && chunk.delta) {
                                assistantText += chunk.delta;
                                setMessages((prev) => {
                                    const next = [...prev];
                                    const idx = next.findIndex((m) => m.id === assistantId);
                                    if (idx !== -1) next[idx] = { ...next[idx], content: assistantText };
                                    return next;
                                });
                            } else if (chunk.type === 'tool-output-available' && chunk.output?.clips?.length) {
                                clips = chunk.output.clips;
                            }
                        } catch {
                            // ignore malformed chunks
                        }
                    }
                }

                if (clips.length > 0) {
                    // Seek to earliest clip — hooks/first moments are at the start of the video,
                    // and TwelveLabs' relevance rank often picks a mid-video clip over the actual opening.
                    const earliest = [...clips].sort((a, b) => a.start - b.start)[0];
                    seekToClip(earliest);
                    setMessages((prev) => {
                        const next = [...prev];
                        const idx = next.findIndex((m) => m.id === assistantId);
                        if (idx !== -1) next[idx] = { ...next[idx], clips };
                        return next;
                    });
                }
            } catch {
                setMessages((prev) => {
                    const next = [...prev];
                    const idx = next.findIndex((m) => m.id === assistantId);
                    if (idx !== -1) next[idx] = { ...next[idx], content: 'Error: Could not get a response.' };
                    return next;
                });
            } finally {
                setIsLoading(false);
            }
        },
        [messages, isLoading, ad.twelveLabsIndexId, ad.twelveLabsVideoId, seekToClip],
    );

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        void sendMessage(input);
    }

    const videoUrl = ad.videoUrls[0];

    return (
        <div className="interrogateOverlay" onClick={onClose} role="dialog" aria-modal="true">
            <div className="interrogateModal" onClick={(e) => e.stopPropagation()}>
                {/* Left: Video */}
                <div className="interrogateLeft">
                    <div className="interrogateVideoHeader">
                        <span>Ad {ad.adId}</span>
                        {activeClipStart !== null && (
                            <span className="timestampBadge">
                                ▶ {fmtTime(activeClipStart)}
                            </span>
                        )}
                    </div>
                    {videoUrl ? (
                        <video ref={videoRef} src={videoUrl} controls className="interrogateVideoEl" />
                    ) : (
                        <div className="interrogateNoVideo">No video available</div>
                    )}
                </div>

                {/* Right: Chat */}
                <div className="interrogateRight">
                    <div className="interrogateChatHeader">
                        <span>Interrogate</span>
                        <button className="interrogateClose" onClick={onClose} aria-label="Close">
                            ✕
                        </button>
                    </div>

                    <div className="suggestionRow">
                        {SUGGESTIONS.map((s) => (
                            <button
                                key={s}
                                className="suggestionChip"
                                onClick={() => void sendMessage(s)}
                                disabled={isLoading}
                            >
                                {s}
                            </button>
                        ))}
                    </div>

                    <div className="chatMessages">
                        {messages.length === 0 && (
                            <p className="chatEmpty">Ask anything about this ad — moments, hooks, pacing.</p>
                        )}
                        {messages.map((msg) => (
                            <div key={msg.id} className={`chatBubble ${msg.role}`}>
                                {msg.role === 'assistant' && msg.content ? (
                                    <p>{renderContent(msg.content, (start) => {
                                        const clip = msg.clips?.find((c) => c.start === start)
                                            ?? { start, end: start + 5, score: 0 };
                                        seekToClip(clip);
                                    })}</p>
                                ) : (
                                    <p>
                                        {msg.content ||
                                            (isLoading && msg.role === 'assistant' ? (
                                                <span className="chatTyping">Thinking…</span>
                                            ) : (
                                                ''
                                            ))}
                                    </p>
                                )}
                                {msg.clips && msg.clips.length > 0 && (
                                    <div className="clipList">
                                        {[...msg.clips]
                                            .sort((a, b) => a.start - b.start)
                                            .map((clip, i) => (
                                                <button
                                                    key={i}
                                                    className={`clipSeek${activeClipStart === clip.start ? ' active' : ''}`}
                                                    onClick={() => seekToClip(clip)}
                                                >
                                                    ▶ {fmtTime(clip.start)}
                                                </button>
                                            ))}
                                    </div>
                                )}
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    <form className="chatInputRow" onSubmit={handleSubmit}>
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask about this ad…"
                            disabled={isLoading}
                            autoFocus
                        />
                        <button type="submit" disabled={isLoading || !input.trim()}>
                            {isLoading ? '…' : 'Send'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
