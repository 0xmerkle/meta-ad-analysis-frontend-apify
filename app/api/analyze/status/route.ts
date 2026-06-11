import { NextResponse } from 'next/server';

import type { ApifyRunStatus, Report, RunStatusResponse } from '@/lib/types';

const APIFY_API_BASE = 'https://api.apify.com/v2';

const TERMINAL_STATUSES = new Set<ApifyRunStatus>([
    'SUCCEEDED',
    'FAILED',
    'TIMING-OUT',
    'TIMED-OUT',
    'ABORTING',
    'ABORTED',
]);

function getEnv(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    return value;
}

function apifyUrl(path: string): string {
    const url = new URL(`${APIFY_API_BASE}${path}`);
    url.searchParams.set('token', getEnv('APIFY_TOKEN'));
    return url.toString();
}

async function apifyJson<T>(path: string): Promise<T> {
    const res = await fetch(apifyUrl(path));
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Apify request failed (${res.status}): ${body}`);
    }
    return (await res.json()) as T;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const runId = searchParams.get('runId');

    if (!runId) {
        return NextResponse.json({ error: 'runId is required.' }, { status: 400 });
    }

    try {
        const { data: run } = await apifyJson<{
            data: { id: string; status: string; defaultKeyValueStoreId?: string };
        }>(`/actor-runs/${runId}`);

        const status = run.status as ApifyRunStatus;

        if (!TERMINAL_STATUSES.has(status)) {
            return NextResponse.json({ status });
        }

        if (status !== 'SUCCEEDED') {
            const body: RunStatusResponse = {
                status,
                error: `Run finished with status: ${status}`,
            };
            return NextResponse.json(body);
        }

        if (!run.defaultKeyValueStoreId) {
            return NextResponse.json(
                { error: 'Run succeeded but no key-value store found.' },
                { status: 500 },
            );
        }

        const report = await apifyJson<Report>(
            `/key-value-stores/${run.defaultKeyValueStoreId}/records/REPORT`,
        );

        const body: RunStatusResponse = { status: 'SUCCEEDED', report };
        return NextResponse.json(body);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error.';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
