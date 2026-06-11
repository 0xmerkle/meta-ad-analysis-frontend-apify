import { anthropic } from '@ai-sdk/anthropic';
import { stepCountIs, streamText, tool } from 'ai';
import { z } from 'zod';

interface Clip {
    start: number;
    end: number;
    score: number;
    text?: string; // transcription text found at this moment, if any
}

interface TLDataItem {
    start: number;
    end: number;
    score?: number;
    transcription?: string;
}

interface TwelveLabsSearchResponse {
    data?: TLDataItem[];
    error?: string;
    message?: string;
}

function extractClips(data: TLDataItem[]): Clip[] {
    return data.map((c) => ({
        start: c.start,
        end: c.end,
        score: typeof c.score === 'number' ? Math.round(c.score * 100) / 100 : 0,
        text: c.transcription,
    }));
}

function buildSystem(indexId: string, videoId: string): string {
    return `You are a video creative analyst. You have a specific competitor Meta ad video loaded — index ID: ${indexId}, video ID: ${videoId}.

You CANNOT watch the video directly. Use searchVideo to find moments by natural language query. Each clip result may include a "text" field with the actual transcription of what was said at that moment.

Rules — follow these exactly:
1. For ANY question about video content, call searchVideo immediately. Never ask for clarification before searching.
2. After searchVideo returns clips, describe what ACTUALLY happens at each timestamp. If a clip has "text" content, quote it directly — that is the real spoken word or audio at that moment. Do not invent descriptions or use generic ad-structure language. Report what you found.
3. Reference each timestamp inline in your answer (e.g. "At 4.5–9 seconds, ...").
4. STOP after your description. Do NOT ask follow-up questions. Do NOT offer to search for more. Just answer and stop.
5. If searchVideo returns no clips, say "Nothing found for that query." and stop.`;
}

export function createInterrogateStream(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    indexId: string,
    videoId: string,
) {
    console.log('[interrogate] stream start — indexId=%s videoId=%s messages=%d', indexId, videoId, messages.length);

    const system = buildSystem(indexId, videoId);

    return streamText({
        model: anthropic('claude-sonnet-4-6'),
        system,
        messages,
        tools: {
            searchVideo: tool({
                description:
                    'Search for a specific moment, element, or concept in the video by natural language. Returns clip timestamps and any transcription text found at those moments.',
                inputSchema: z.object({
                    query: z.string().describe('Natural language description of what to find in the video'),
                }),
                execute: async ({ query }: { query: string }): Promise<{ clips: Clip[] }> => {
                    console.log('[interrogate] searchVideo query="%s"', query);

                    // TwelveLabs search requires multipart/form-data — arrays as repeated fields.
                    // Do NOT set Content-Type manually; fetch sets it with the boundary automatically.
                    const form = new FormData();
                    form.append('index_id', indexId);
                    form.append('query_text', query);
                    form.append('search_options', 'visual');
                    form.append('search_options', 'audio');
                    form.append('search_options', 'transcription');
                    form.append('transcription_options', 'semantic');
                    form.append('transcription_options', 'lexical');
                    form.append('filter', JSON.stringify({ id: [videoId] }));
                    form.append('page_limit', '5');

                    const res = await fetch('https://api.twelvelabs.io/v1.3/search', {
                        method: 'POST',
                        headers: { 'x-api-key': process.env.TWELVELABS_API_KEY ?? '' },
                        body: form,
                    });

                    console.log('[interrogate] TwelveLabs status: %d', res.status);

                    const raw = await res.json() as TwelveLabsSearchResponse;
                    console.log("Raw response", raw)

                    if (!res.ok) {
                        console.error('[interrogate] TwelveLabs error: %s', JSON.stringify(raw));
                        return { clips: [] };
                    }

                    console.log('[interrogate] TwelveLabs raw data (first item): %s', JSON.stringify(raw.data?.[0]));

                    const clips = extractClips(raw.data ?? []).slice(0, 5);

                    console.log(
                        '[interrogate] extracted %d clips: %s',
                        clips.length,
                        clips
                            .map((c) => `${c.start.toFixed(1)}s–${c.end.toFixed(1)}s text="${c.text ?? ''}"`)
                            .join(' | '),
                    );

                    return { clips };
                },
            }),
        },
        onStepFinish(step) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const s = step as any;
            const toolCalls = s.toolCalls ?? [];
            const toolResults = s.toolResults ?? [];
            console.log('[interrogate] step — toolCalls=%d text=%d chars', toolCalls.length, s.text?.length ?? 0);
            if (toolCalls.length) {
                console.log('[interrogate] tool calls: %s', JSON.stringify(toolCalls.map((t: any) => ({ tool: t.toolName, input: t.input }))));
            }
            if (toolResults.length) {
                console.log('[interrogate] tool results: %s', JSON.stringify(toolResults.map((r: any) => r.output ?? r.result)));
            }
        },
        stopWhen: stepCountIs(5),
    });
}
