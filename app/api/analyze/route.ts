import { NextResponse } from 'next/server';

import type { RunStartResponse } from '@/lib/types';
import { parseAnalyzeRequest } from '@/lib/validation';

const APIFY_API_BASE = 'https://api.apify.com/v2';

function getEnv(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    return value;
}

function actorPath(actorId: string): string {
    return actorId.trim().replaceAll('/', '~');
}

function apifyUrl(path: string): string {
    const url = new URL(`${APIFY_API_BASE}${path}`);
    url.searchParams.set('token', getEnv('APIFY_TOKEN'));
    return url.toString();
}

export async function POST(request: Request) {
    try {
        const input = parseAnalyzeRequest(await request.json());
        const actorId = actorPath(getEnv('APIFY_ACTOR_ID'));

        const res = await fetch(apifyUrl(`/acts/${actorId}/runs`), {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(input),
        });

        if (!res.ok) {
            const body = await res.text();
            throw new Error(`Failed to start actor run (${res.status}): ${body}`);
        }

        const { data } = (await res.json()) as { data: { id: string } };
        const body: RunStartResponse = {
            runId: data.id,
            consoleUrl: `https://console.apify.com/actors/runs/${data.id}`,
        };
        return NextResponse.json(body);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error.';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
