'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { InterrogateModal } from '@/app/components/InterrogateModal';
import type {
    AnalysisMode,
    AnalyzeRequest,
    ApifyRunStatus,
    Report,
    RunStartResponse,
    RunStatusResponse,
    Scene,
    TopAd,
} from '@/lib/types';

const defaultRequest: AnalyzeRequest = {
    competitorPageUrls: ['https://www.facebook.com/MyCarpe'],
    maxCompetitorAds: 100,
    topVideoAdsToAnalyze: 3,
    activeStatus: 'active',
    analysisMode: 'full',
};

const LAST_RESULT_STORAGE_KEY = 'meta-ad-analysis:last-result';

export default function Home() {
    const [competitors, setCompetitors] = useState(defaultRequest.competitorPageUrls.join('\n'));
    const [maxAds, setMaxAds] = useState(defaultRequest.maxCompetitorAds);
    const [topAds, setTopAds] = useState(defaultRequest.topVideoAdsToAnalyze);
    const [activeStatus, setActiveStatus] = useState(defaultRequest.activeStatus);
    const [analysisMode, setAnalysisMode] = useState<AnalysisMode>(defaultRequest.analysisMode);
    const [isLoading, setIsLoading] = useState(false);
    const [runStatus, setRunStatus] = useState<ApifyRunStatus | null>(null);
    const [runId, setRunId] = useState<string | null>(null);
    const [consoleUrl, setConsoleUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [report, setReport] = useState<Report | null>(null);
    const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const stored = window.localStorage.getItem(LAST_RESULT_STORAGE_KEY);
        if (!stored) return;
        try {
            const parsed = (JSON.parse(stored) as { report: Report }).report ?? null;
            setReport(parsed);
        } catch {
            window.localStorage.removeItem(LAST_RESULT_STORAGE_KEY);
        }
    }, []);

    const payload = useMemo<AnalyzeRequest>(
        () => ({
            competitorPageUrls: competitors
                .split('\n')
                .map((url) => url.trim())
                .filter(Boolean),
            maxCompetitorAds: maxAds,
            topVideoAdsToAnalyze: topAds,
            activeStatus,
            analysisMode,
        }),
        [activeStatus, analysisMode, competitors, maxAds, topAds],
    );

    const TERMINAL_STATUSES: ApifyRunStatus[] = [
        'SUCCEEDED', 'FAILED', 'TIMING-OUT', 'TIMED-OUT', 'ABORTING', 'ABORTED',
    ];

    const pollStatus = useCallback(async (id: string) => {
        try {
            const res = await fetch(`/api/analyze/status?runId=${id}`);
            const body = (await res.json()) as RunStatusResponse | { error: string };

            if (!res.ok || 'error' in body) {
                setError(('error' in body ? body.error : null) ?? 'Status check failed.');
                setIsLoading(false);
                return;
            }

            const data = body as RunStatusResponse;
            setRunStatus(data.status);

            if (!TERMINAL_STATUSES.includes(data.status)) {
                pollRef.current = setTimeout(() => pollStatus(id), 3_000);
                return;
            }

            setIsLoading(false);

            if (data.status === 'SUCCEEDED') {
                setReport(data.report);
                window.localStorage.setItem(
                    LAST_RESULT_STORAGE_KEY,
                    JSON.stringify({ report: data.report }),
                );
            } else {
                setError(
                    'error' in data && data.error
                        ? data.error
                        : `Run finished with status: ${data.status}`,
                );
            }
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Status check failed.');
            setIsLoading(false);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        return () => {
            if (pollRef.current) clearTimeout(pollRef.current);
        };
    }, []);

    async function runAnalysis(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (pollRef.current) clearTimeout(pollRef.current);
        setIsLoading(true);
        setError(null);
        setReport(null);
        setRunStatus(null);
        setRunId(null);
        setConsoleUrl(null);

        try {
            const res = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const body = (await res.json()) as RunStartResponse | { error?: string };
            if (!res.ok) throw new Error('error' in body ? body.error : 'Failed to start actor run.');
            const { runId: id, consoleUrl: url } = body as RunStartResponse;
            setRunId(id);
            setConsoleUrl(url);
            setRunStatus('READY');
            pollRef.current = setTimeout(() => pollStatus(id), 3_000);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Failed to start actor run.');
            setIsLoading(false);
        }
    }

    function exportJson() {
        if (!report) return;
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `meta-ad-analysis-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
    }

    return (
        <main>
            <section className="hero">
                <div>
                    <p className="eyebrow">Apify · Meta Ad Intelligence</p>
                    <h1>Ad Competitor Analysis</h1>
                    <p className="heroCopy">
                        Enter competitor Meta pages to generate a ranked creative intelligence report.
                    </p>
                </div>
                <div className="heroMeta">
                    <span className="heroBadge">Report + JSON</span>
                </div>
            </section>

            <section className="grid">
                <form className="panel formPanel" onSubmit={runAnalysis}>
                    <label>
                        Competitor Facebook / Meta URLs
                        <textarea
                            value={competitors}
                            onChange={(e) => setCompetitors(e.target.value)}
                            rows={4}
                        />
                    </label>

                    <div className="row">
                        <label>
                            Max ads
                            <input
                                type="number"
                                min={1}
                                max={500}
                                value={maxAds}
                                onChange={(e) => setMaxAds(Number(e.target.value))}
                            />
                        </label>
                        <label>
                            Top videos
                            <input
                                type="number"
                                min={1}
                                max={20}
                                value={topAds}
                                onChange={(e) => setTopAds(Number(e.target.value))}
                            />
                        </label>
                    </div>

                    <label>
                        Ad status
                        <select
                            value={activeStatus}
                            onChange={(e) => setActiveStatus(e.target.value as 'active' | 'inactive')}
                        >
                            <option value="active">Active ads</option>
                            <option value="inactive">Inactive ads</option>
                        </select>
                    </label>

                    <label>
                        Analysis mode
                        <select
                            value={analysisMode}
                            onChange={(e) => setAnalysisMode(e.target.value as AnalysisMode)}
                        >
                            <option value="full">Full transcript + vision</option>
                            <option value="rank-only">Rank only</option>
                            <option value="sample">Sample data</option>
                        </select>
                    </label>

                    <button type="submit" disabled={isLoading}>
                        {isLoading ? 'Running...' : 'Run analysis'}
                    </button>

                    {isLoading && runStatus ? (
                        <p className="statusLine">
                            <span className="statusDot" />
                            {runStatus}
                        </p>
                    ) : null}

                    {error ? <p className="error">{error}</p> : null}

                    {runId && consoleUrl ? (
                        <a className="runLink" href={consoleUrl} target="_blank" rel="noreferrer">
                            ↗ View run {runId}
                        </a>
                    ) : null}
                </form>

                <ReportView report={report} onExportJson={exportJson} />
            </section>
        </main>
    );
}

function ReportView({ report, onExportJson }: { report: Report | null; onExportJson: () => void }) {
    if (!report) {
        return (
            <section className="panel emptyState">
                <h2>No report yet</h2>
                <p>Run the actor to generate top ads, creative patterns, opportunities, and caveats.</p>
            </section>
        );
    }

    return (
        <section className="report">
            <div className="reportHeader">
                <div>
                    <p className="eyebrow">Summary</p>
                    <p style={{ marginBottom: 0 }}>{report.summary}</p>
                </div>
                <button className="secondaryButton" onClick={onExportJson}>
                    Export JSON
                </button>
            </div>

            <div className="overviewGrid">
                <Stat label="Scraped ads" value={report.scrapedAds} />
                <Stat label="Analyzed videos" value={report.analyzedVideoAds} />
            </div>

            <div className="stack">
                <SectionTitle eyebrow="Ranked creatives" title="Top Ads" />
                {report.topAds.map((ad, index) => (
                    <AdRow key={ad.adId} ad={ad} rank={index + 1} />
                ))}
            </div>

            <div className="insightBoard">
                <SectionTitle eyebrow="Creative system" title="Patterns & Opportunities" />
                <div className="patternGrid">
                    <ListCard title="Hook Patterns" items={report.patterns.hooks} />
                    <ListCard title="Visual Style" items={report.patterns.visualStyle} />
                    <ListCard title="Offers" items={report.patterns.offers} />
                    <ListCard title="Proof Mechanisms" items={report.patterns.proofMechanisms} />
                    <ListCard title="Opportunities" items={report.opportunities} featured />
                    <ListCard title="Caveats" items={report.caveats} muted />
                </div>
            </div>
        </section>
    );
}

function AdRow({ ad, rank }: { ad: TopAd; rank: number }) {
    const [open, setOpen] = useState(false);
    const [interrogating, setInterrogating] = useState(false);
    const previewImage = ad.previewImageUrls[0];
    const videoUrl = ad.videoUrls[0];

    return (
        <>
        <div className="adRow">
            <div
                className="adRowHeader"
                onClick={() => setOpen((v) => !v)}
                role="button"
                aria-expanded={open}
            >
                <div className="adRank">#{rank}</div>

                <div className="adScore">
                    <span className="scoreVal">{ad.score}</span>
                    <span className="scoreLabel">Score</span>
                </div>

                <div className="adSummary">
                    <strong>{ad.summary ?? ad.hook}</strong>
                    <span>
                        ID {ad.adId}
                        <span className={`inlineStatus ${ad.signals.isActive ? 'active' : ''}`}>
                            · {ad.signals.isActive ? 'Active' : 'Inactive'}
                        </span>
                    </span>
                </div>

                <div className="adSignals">
                    <div>
                        <span>Days</span>
                        <strong>{ad.signals.activeDays}</strong>
                    </div>
                    <div>
                        <span>Variants</span>
                        <strong>{ad.signals.variantCount}</strong>
                    </div>
                    <div>
                        <span>Placements</span>
                        <strong>{ad.signals.placementCount}</strong>
                    </div>
                </div>

                <div className={`adChevron ${open ? 'open' : ''}`}>▾</div>
            </div>

            <div className={`adBody ${open ? 'open' : ''}`}>
                <div className="adMediaColumn">
                    <div className={`adPreview ${previewImage ? '' : 'empty'}`}>
                        {previewImage ? (
                            <img
                                className="adPreviewImg"
                                src={previewImage}
                                alt={`Preview for ad ${ad.adId}`}
                            />
                        ) : null}
                    </div>

                    <div className="actionLinks">
                        {ad.twelveLabsVideoId ? (
                            <button
                                className="interrogateButton"
                                onClick={() => setInterrogating(true)}
                            >
                                ⬡ Interrogate
                            </button>
                        ) : null}
                        {videoUrl ? (
                            <a className="subtleLink" href={videoUrl} target="_blank" rel="noreferrer">
                                ↗ Open video
                            </a>
                        ) : null}
                        {ad.landingPage ? (
                            <a className="subtleLink" href={ad.landingPage} target="_blank" rel="noreferrer">
                                ↗ Landing page
                            </a>
                        ) : null}
                    </div>
                </div>

                <div className="adAnalysis">
                    <div className="adIdLine">
                        <span>Ad ID {ad.adId}</span>
                    </div>

                    <div className="adHeadline">
                        <p className="eyebrow">Creative read</p>
                        <h3>{ad.summary ?? ad.hook}</h3>
                    </div>

                    <div className="briefGrid">
                        <div className="callout">
                            <span>Opening hook</span>
                            <p>{ad.hook || 'Not detected'}</p>
                        </div>
                        <div className="callout warm">
                            <span>Offer</span>
                            <p>{ad.offer || 'Not detected'}</p>
                        </div>
                        <div className="detailCard">
                            <span>Audience</span>
                            <p>{ad.targetAudience || 'Audience not available'}</p>
                        </div>
                        <div className="detailCard">
                            <span>Problem</span>
                            <p>{ad.problemFraming || 'Problem framing not available'}</p>
                        </div>
                        <div className="detailCard">
                            <span>Pacing</span>
                            <p>{ad.pacing || 'Pacing not available'}</p>
                        </div>
                        <div className="detailCard">
                            <span>CTA</span>
                            <p>{ad.cta || 'CTA not available'}</p>
                        </div>
                    </div>

                    <SceneTimeline scenes={ad.scenes ?? []} />

                    <div className="analysisColumns">
                        <InsightList title="Why it works" items={ad.whyItLikelyWorks} tone="positive" />
                        <InsightList title="Weaknesses" items={ad.weaknesses} tone="risk" />
                        <InsightList title="Proof" items={ad.proofMechanisms ?? []} tone="neutral" />
                        <InsightList title="Reusable patterns" items={ad.reusablePatterns ?? []} tone="neutral" />
                    </div>
                </div>
            </div>
        </div>
        {interrogating ? (
            <InterrogateModal ad={ad} onClose={() => setInterrogating(false)} />
        ) : null}
        </>
    );
}

function SceneTimeline({ scenes }: { scenes: Scene[] }) {
    if (scenes.length === 0) {
        return (
            <div className="sceneTimeline emptyScene">
                <h4>Scene Breakdown</h4>
                <p>Run full analysis to generate scene, setting, overlay, and visual sequence details.</p>
            </div>
        );
    }

    return (
        <div className="sceneTimeline">
            <h4>Scene Breakdown</h4>
            <div className="sceneList">
                {scenes.slice(0, 5).map((scene) => (
                    <div className="sceneItem" key={`${scene.startSeconds}-${scene.endSeconds}-${scene.purpose}`}>
                        <div className="sceneTime">
                            {formatTime(scene.startSeconds)}–{formatTime(scene.endSeconds)}
                        </div>
                        <div>
                            <strong>{scene.purpose}</strong>
                            <p>{scene.visual}</p>
                            {scene.overlayText ? <small>Overlay: {scene.overlayText}</small> : null}
                            {scene.voiceover ? <small>VO: {scene.voiceover}</small> : null}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function InsightList({ title, items, tone }: { title: string; items: string[]; tone: 'positive' | 'risk' | 'neutral' }) {
    return (
        <div className={`insightList ${tone}`}>
            <h4>{title}</h4>
            <div className="pillList">
                {items.length > 0
                    ? items.map((item) => <span key={item}>{item}</span>)
                    : <span>Not available</span>}
            </div>
        </div>
    );
}

function ListCard({ title, items, muted = false, featured = false }: {
    title: string;
    items: string[];
    muted?: boolean;
    featured?: boolean;
}) {
    return (
        <div className={`listCard ${muted ? 'muted' : ''} ${featured ? 'featured' : ''}`}>
            <h3>{title}</h3>
            <div className="compactList">
                {items.map((item) => (
                    <p key={item}>{item}</p>
                ))}
            </div>
        </div>
    );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
    return (
        <div className="sectionTitle">
            <h2>{eyebrow} / {title}</h2>
        </div>
    );
}

function Stat({ label, value }: { label: string; value: number }) {
    return (
        <div className="stat">
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}

function formatTime(seconds: number): string {
    return `${Math.round(seconds)}s`;
}
