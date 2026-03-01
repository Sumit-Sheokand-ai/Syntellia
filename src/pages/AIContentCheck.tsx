import { useState, useEffect } from 'react';
import { apiUrl } from '../lib/api';

interface CommonCrawlResult {
    Crawl: string;
    Timestamp: string;
    Url: string;
    Status: string;
}

interface InfiniGramResult {
    IndexName: string;
    Count: number;
    Found: boolean;
    Error?: string;
}

interface UrlCheckResult {
    Query?: string;
    Found: boolean;
    TotalRecords: number;
    CheckedCrawls?: number;
    AvailableCrawls?: number;
    Crawls: Array<{ Crawl: string; Count: number }>;
    SampleRecords: CommonCrawlResult[];
    CrawlStatus?: Array<{ Crawl: string; Available: boolean; Error?: string }>;
}

interface TextCheckResult {
    Found: boolean;
    Results: InfiniGramResult[];
    TextSnippet: string;
    CheckedIndexes?: number;
    AvailableIndexes?: number;
}

export default function AIContentCheck() {
    const [checkType, setCheckType] = useState<'url' | 'text'>('url');
    const [urlInput, setUrlInput] = useState('');
    const [textInput, setTextInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [urlResult, setUrlResult] = useState<UrlCheckResult | null>(null);
    const [textResult, setTextResult] = useState<TextCheckResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => { document.title = 'AI Content Check — Syntellia'; }, []);

    const formatTimestamp = (timestamp: string): string => {
        if (!timestamp || timestamp.length < 14) {
            return timestamp || 'Unknown';
        }
        const year = timestamp.slice(0, 4);
        const month = timestamp.slice(4, 6);
        const day = timestamp.slice(6, 8);
        const hour = timestamp.slice(8, 10);
        const minute = timestamp.slice(10, 12);
        return `${year}-${month}-${day} ${hour}:${minute} UTC`;
    };

    const handleCheckUrl = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setUrlResult(null);

        try {
            const response = await fetch(apiUrl('/api/AIContentCheck/check-url'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ Url: urlInput })
            });
            const data = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(data?.Error || 'Failed to check URL');
            }
            setUrlResult({
                Query: typeof data?.Query === 'string' ? data.Query : urlInput,
                Found: Boolean(data?.Found),
                TotalRecords: Number(data?.TotalRecords ?? 0),
                CheckedCrawls: Number(data?.CheckedCrawls ?? 0),
                AvailableCrawls: Number(data?.AvailableCrawls ?? 0),
                Crawls: Array.isArray(data?.Crawls) ? data.Crawls : [],
                SampleRecords: Array.isArray(data?.SampleRecords) ? data.SampleRecords : [],
                CrawlStatus: Array.isArray(data?.CrawlStatus) ? data.CrawlStatus : []
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error checking URL. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleCheckText = async (e: React.FormEvent) => {
        e.preventDefault();
        if (textInput.trim().length < 20) {
            setError('Please enter at least 20 characters for a meaningful text check.');
            return;
        }
        setLoading(true);
        setError(null);
        setTextResult(null);

        try {
            const response = await fetch(apiUrl('/api/AIContentCheck/check-text'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ Text: textInput })
            });
            const data = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(data?.Error || 'Failed to check text');
            }
            setTextResult({
                Found: Boolean(data?.Found),
                Results: Array.isArray(data?.Results) ? data.Results : [],
                TextSnippet: typeof data?.TextSnippet === 'string' ? data.TextSnippet : '',
                CheckedIndexes: Number(data?.CheckedIndexes ?? 0),
                AvailableIndexes: Number(data?.AvailableIndexes ?? 0)
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error checking text. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="tool-page">
            <div className="tool-header">
                <h1 className="tool-title">AI Content Training Check</h1>
                <p className="tool-description">
                    Verify whether your content appears in crawl archives or high-volume language-model training corpora
                    such as Dolma, RedPajama, The Pile, and C4.
                </p>
            </div>

            <div className="input-card">
                <div className="segmented-toggle">
                    <button
                        className={`button segmented-toggle-btn ${checkType === 'url' ? 'is-active' : ''}`}
                        onClick={() => setCheckType('url')}
                        type="button"
                    >
                        Check URL
                    </button>
                    <button
                        className={`button segmented-toggle-btn ${checkType === 'text' ? 'is-active' : ''}`}
                        onClick={() => setCheckType('text')}
                        type="button"
                    >
                        Check Text
                    </button>
                </div>

                {checkType === 'url' ? (
                    <form onSubmit={handleCheckUrl}>
                        <div className="input-group">
                            <label className="input-label">Website URL</label>
                            <input
                                type="url"
                                className="input-field"
                                placeholder="https://example.com"
                                value={urlInput}
                                onChange={(e) => setUrlInput(e.target.value)}
                                required
                            />
                        </div>
                        <button type="submit" className="button button-primary" disabled={loading}>
                            {loading ? 'Checking...' : 'Check Common Crawl'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleCheckText}>
                        <div className="input-group">
                            <label className="input-label">Text Content</label>
                            <textarea
                                className="input-field textarea-field"
                                placeholder="Paste your text content here..."
                                value={textInput}
                                onChange={(e) => setTextInput(e.target.value)}
                                required
                            />
                            <small className="helper-text">For reliable matching, provide at least 20 characters of original text.</small>
                        </div>
                        <button type="submit" className="button button-primary" disabled={loading}>
                            {loading ? 'Checking...' : 'Check Training Datasets'}
                        </button>
                    </form>
                )}
            </div>

            {loading && (
                <div className="loading">
                    <div className="spinner"></div>
                    <p>Querying datasets...</p>
                </div>
            )}

            {error && <div className="error-message">{error}</div>}

            {urlResult && (
                <div className="results-card">
                    <div className="result-header">
                        <span className={`result-icon ${urlResult.Found ? 'icon-warning' : 'icon-success'}`} />
                        <h2 className="result-title">Common Crawl Results</h2>
                        <span className={`status-badge ${urlResult.Found ? 'status-danger' : 'status-success'}`}>
                            {urlResult.Found ? 'Found in Archives' : 'Not Found'}
                        </span>
                    </div>

                    <div className="result-section">
                        <div className="stat-grid">
                            <div className="stat-card">
                                <span className="stat-value">{urlResult.TotalRecords}</span>
                                <span className="stat-label">Total Records</span>
                            </div>
                            <div className="stat-card">
                                <span className="stat-value">{urlResult.Crawls.length}</span>
                                <span className="stat-label">Crawls Found</span>
                            </div>
                            <div className="stat-card">
                                <span className="stat-value">{urlResult.AvailableCrawls ?? 0}/{urlResult.CheckedCrawls ?? 0}</span>
                                <span className="stat-label">Crawls Available</span>
                            </div>
                        </div>
                    </div>

                    {urlResult.Crawls.length > 0 && (
                        <div className="result-section">
                            <h4>Crawl Distribution</h4>
                            <ul className="result-list">
                                {urlResult.Crawls.map((crawl, idx) => (
                                    <li key={idx}>
                                        <strong>{crawl.Crawl}</strong>: {crawl.Count} record(s)
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {urlResult.CrawlStatus && urlResult.CrawlStatus.length > 0 && (
                        <div className="result-section">
                            <h4>Crawl Availability</h4>
                            <ul className="result-list">
                                {urlResult.CrawlStatus.map((crawl, idx) => (
                                    <li key={idx}>
                                        <div className="split-row">
                                            <span><strong>{crawl.Crawl}</strong></span>
                                            <span className={`status-badge ${crawl.Available ? 'status-success' : 'status-warning'}`}>
                                                {crawl.Available ? 'Available' : (crawl.Error || 'Unavailable')}
                                            </span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {urlResult.SampleRecords.length > 0 && (
                        <div className="result-section">
                            <h4>Sample Evidence</h4>
                            <ul className="result-list">
                                {urlResult.SampleRecords.map((record, idx) => (
                                    <li key={idx}>
                                        <div><strong>Crawl:</strong> {record.Crawl}</div>
                                        <div><strong>Captured:</strong> {formatTimestamp(record.Timestamp)}</div>
                                        <div><strong>Status:</strong> {record.Status || 'Unknown'}</div>
                                        {record.Url && (
                                            <div>
                                                <strong>URL:</strong>{' '}
                                                <a
                                                    href={record.Url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="result-inline-link"
                                                >
                                                    {record.Url}
                                                </a>
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="disclaimer">
                        <strong>What this means:</strong> Common Crawl data is widely used for AI training. If your URL
                        appears here, it has been archived and may have been used to train language models, though specific
                        model usage cannot be determined.
                    </div>
                </div>
            )}

            {textResult && (
                <div className="results-card">
                    <div className="result-header">
                        <span className={`result-icon ${textResult.Found ? 'icon-warning' : 'icon-success'}`} />
                        <h2 className="result-title">Training Dataset Results</h2>
                        <span className={`status-badge ${textResult.Found ? 'status-danger' : 'status-success'}`}>
                            {textResult.Found ? 'Found in Datasets' : 'Not Found'}
                        </span>
                    </div>

                    <div className="result-section">
                        <h4>Dataset Search Results</h4>
                        <p className="helper-text">
                            Searched snippet: "{textResult.TextSnippet.length > 100 ? `${textResult.TextSnippet.substring(0, 100)}...` : (textResult.TextSnippet || 'N/A')}"
                        </p>
                        <p className="helper-text">
                            Index availability: {textResult.AvailableIndexes ?? 0}/{textResult.CheckedIndexes ?? textResult.Results.length}
                        </p>
                        <ul className="result-list">
                            {textResult.Results.map((result, idx) => (
                                <li key={idx}>
                                    <div className="split-row">
                                        <span><strong>{result.IndexName}</strong></span>
                                        <span className={`status-badge ${result.Error ? 'status-warning' : (result.Found ? 'status-danger' : 'status-success')}`}>
                                            {result.Error ? result.Error : (result.Found ? `${result.Count} matches` : 'Not found')}
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="disclaimer">
                        <strong>What this means:</strong> Infini-gram searches exact n-gram matches in major AI training
                        datasets. Matches indicate your text (or very similar text) was likely used to train large language
                        models including GPT, LLaMA, and others.
                    </div>
                </div>
            )}
        </div>
    );
}
