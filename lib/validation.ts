import type { AnalyzeRequest } from './types';

export function parseAnalyzeRequest(value: unknown): AnalyzeRequest {
    const input = value as Partial<AnalyzeRequest>;
    if (!input || typeof input !== 'object') throw new Error('Request body must be a JSON object.');
    if (!Array.isArray(input.competitorPageUrls) || input.competitorPageUrls.length === 0) {
        throw new Error('At least one competitor page URL is required.');
    }

    return {
        competitorPageUrls: input.competitorPageUrls
            .filter((url): url is string => typeof url === 'string')
            .map((url) => url.trim())
            .filter(Boolean),
        maxCompetitorAds: clampNumber(input.maxCompetitorAds, 1, 500, 100),
        topVideoAdsToAnalyze: clampNumber(input.topVideoAdsToAnalyze, 1, 20, 3),
        activeStatus: input.activeStatus === 'inactive' ? 'inactive' : 'active',
        analysisMode: input.analysisMode === 'sample' || input.analysisMode === 'rank-only' ? input.analysisMode : 'full',
    };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(parsed)));
}
