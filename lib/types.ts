export type AnalysisMode = 'rank-only' | 'full';
export type ActiveStatus = 'active' | 'inactive';

export interface AnalyzeRequest {
    competitorPageUrls: string[];
    maxCompetitorAds: number;
    topVideoAdsToAnalyze: number;
    activeStatus: ActiveStatus;
    analysisMode: AnalysisMode;
}

export interface Report {
    type: 'competitor-meta-ad-analysis-report';
    scrapedAds: number;
    analyzedVideoAds: number;
    summary: string;
    topAds: TopAd[];
    patterns: {
        hooks: string[];
        visualStyle: string[];
        offers: string[];
        proofMechanisms: string[];
        ctas: string[];
    };
    opportunities: string[];
    caveats: string[];
}

export interface TopAd {
    adId: string;
    score: number;
    signals: {
        activeDays: number;
        isActive: boolean;
        impressionIndex: number;
        reachEstimate: number;
        variantCount: number;
        placementCount: number;
    };
    landingPage?: string | null;
    hook: string;
    offer: string;
    summary?: string;
    targetAudience?: string;
    problemFraming?: string;
    proofMechanisms?: string[];
    cta?: string;
    pacing?: string;
    scenes?: Scene[];
    reusablePatterns?: string[];
    whyItLikelyWorks: string[];
    weaknesses: string[];
    videoUrls: string[];
    previewImageUrls: string[];
    twelveLabsIndexId?: string;
    twelveLabsVideoId?: string;
}

export interface Scene {
    startSeconds: number;
    endSeconds: number;
    visual: string;
    voiceover: string;
    overlayText: string;
    purpose: string;
}

export interface AnalyzeResponse {
    report: Report;
    runId: string;
    consoleUrl: string;
}

export interface RunStartResponse {
    runId: string;
    consoleUrl: string;
}

export type ApifyRunStatus =
    | 'READY'
    | 'RUNNING'
    | 'SUCCEEDED'
    | 'FAILED'
    | 'TIMING-OUT'
    | 'TIMED-OUT'
    | 'ABORTING'
    | 'ABORTED';

export type RunStatusResponse =
    | { status: 'SUCCEEDED'; report: Report }
    | { status: Exclude<ApifyRunStatus, 'SUCCEEDED'>; error?: string };
