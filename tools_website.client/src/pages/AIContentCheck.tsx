import { useState } from 'react';

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
}

interface UrlCheckResult {
    Found: boolean;
    TotalRecords: number;
    Crawls: Array<{ Crawl: string; Count: number }>;
    SampleRecords: CommonCrawlResult[];
}

interface TextCheckResult {
    Found: boolean;
    Results: InfiniGramResult[];
    TextSnippet: string;
}

export default function AIContentCheck() {
    const [checkType, setCheckType] = useState<'url' | 'text'>('url');
    const [urlInput, setUrlInput] = useState('');
    const [textInput, setTextInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [urlResult, setUrlResult] = useState<UrlCheckResult | null>(null);
    const [textResult, setTextResult] = useState<TextCheckResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleCheckUrl = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setUrlResult(null);

        try {
            const response = await fetch('/api/AIContentCheck/check-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ Url: urlInput })
            });

            if (!response.ok) throw new Error('Failed to check URL');
            const data = await response.json();
            setUrlResult(data);
        } catch (err) {
            setError('Error checking URL. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleCheckText = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setTextResult(null);

        try {
            const response = await fetch('/api/AIContentCheck/check-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ Text: textInput })
            });

            if (!response.ok) throw new Error('Failed to check text');
            const data = await response.json();
            setTextResult(data);
        } catch (err) {
            setError('Error checking text. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="tool-page">
            <div className="tool-header">
                <h1 className="tool-title">🤖 AI Content Training Check</h1>
                <p className="tool-description">
                    Check if your content has been crawled by Common Crawl or appears in major AI training datasets
                    including Dolma (3T tokens), RedPajama (1.4T), The Pile (380B), and C4 (200B).
                </p>
            </div>

            <div className="input-card">
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                    <button
                        className={`button ${checkType === 'url' ? 'button-primary' : ''}`}
                        onClick={() => setCheckType('url')}
                        style={{ flex: 1 }}
                    >
                        Check URL
                    </button>
                    <button
                        className={`button ${checkType === 'text' ? 'button-primary' : ''}`}
                        onClick={() => setCheckType('text')}
                        style={{ flex: 1 }}
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
                        <span className="result-icon">{urlResult.Found ? '⚠️' : '✅'}</span>
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
                        <span className="result-icon">{textResult.Found ? '⚠️' : '✅'}</span>
                        <h2 className="result-title">Training Dataset Results</h2>
                        <span className={`status-badge ${textResult.Found ? 'status-danger' : 'status-success'}`}>
                            {textResult.Found ? 'Found in Datasets' : 'Not Found'}
                        </span>
                    </div>

                    <div className="result-section">
                        <h4>Dataset Search Results</h4>
                        <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                            Searched for: "{textResult.TextSnippet.substring(0, 100)}..."
                        </p>
                        <ul className="result-list">
                            {textResult.Results.map((result, idx) => (
                                <li key={idx}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span><strong>{result.IndexName}</strong></span>
                                        <span className={`status-badge ${result.Found ? 'status-danger' : 'status-success'}`}>
                                            {result.Found ? `${result.Count} matches` : 'Not found'}
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
