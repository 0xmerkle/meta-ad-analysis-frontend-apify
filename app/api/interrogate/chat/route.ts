import { createInterrogateStream } from '@/lib/agent';

export async function POST(req: Request): Promise<Response> {
    const { messages, indexId, videoId } = (await req.json()) as {
        messages: Array<{ role: 'user' | 'assistant'; content: string }>;
        indexId: string;
        videoId: string;
    };

    const result = createInterrogateStream(messages, indexId, videoId);
    return result.toUIMessageStreamResponse();
}
