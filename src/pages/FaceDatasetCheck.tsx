import { useState, useEffect } from 'react';
import { apiUrl } from '../lib/api';

interface UrlCheckResult {
    ImageUrl: string;
    CheckedDatasets: string[];
    Found: boolean;
    Confidence: string;
    Message: string;
    Disclaimer: string;
    Resources: Array<{
        Name: string;
        Url: string;
    }>;
    Evidence?: Array<{
        Crawl: string;
        Timestamp: string;
        Status: string;
        Url: string;
    }>;
}

interface UploadCheckResult {
    ImageName: string;
    ImageSize: number;
    CheckedDatasets: string[];
    Found: boolean;
    Similarity: number;
    Confidence: string;
    Message: string;
    Disclaimer: string;
    TechnicalDetails: {
        EmbeddingModel: string;
        IndexSize: string;
        SearchMethod: string;
        ProcessingTime: string;
        ImageHashSha256?: string;
    };
    CandidateUrlsDetected?: string[];
    Evidence?: Array<{
        Url: string;
        TotalMatches: number;
        Crawls: Array<{ Crawl: string; Count: number }>;
    }>;
}

export default function FaceDatasetCheck() {
    const [checkType, setCheckType] = useState<'url' | 'upload'>('url');
    const [imageUrl, setImageUrl] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [urlResult, setUrlResult] = useState<UrlCheckResult | null>(null);
    const [uploadResult, setUploadResult] = useState<UploadCheckResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => { document.title = 'Face Dataset Check — Syntellia'; }, []);

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

    const handleUrlCheck = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedUrl = imageUrl.trim();
        if (!/^https?:\/\//i.test(trimmedUrl)) {
            setError('Please enter a valid image URL starting with http:// or https://.');
            return;
        }
        setLoading(true);
        setError(null);
        setUrlResult(null);

        try {
            const response = await fetch(apiUrl('/api/FaceDatasetCheck/check-url'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ImageUrl: imageUrl })
            });
            const data = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(data?.Error || 'Failed to check image URL');
            }
            setUrlResult({
                ImageUrl: data?.ImageUrl ?? imageUrl,
                CheckedDatasets: Array.isArray(data?.CheckedDatasets) ? data.CheckedDatasets : [],
                Found: Boolean(data?.Found),
                Confidence: data?.Confidence ?? 'N/A',
                Message: data?.Message ?? 'No result details available.',
                Disclaimer: data?.Disclaimer ?? '',
                Resources: Array.isArray(data?.Resources) ? data.Resources : [],
                Evidence: Array.isArray(data?.Evidence) ? data.Evidence : []
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error checking image URL. Please verify the URL and try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleUploadCheck = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFile) {
            setError('Please select an image file');
            return;
        }
        if (selectedFile.size > 10 * 1024 * 1024) {
            setError('Selected image is too large. Maximum size is 10MB.');
            return;
        }
        if (!/^image\/(jpeg|jpg|png|webp)$/i.test(selectedFile.type)) {
            setError('Unsupported image format. Please upload JPEG, PNG, or WebP.');
            return;
        }

        setLoading(true);
        setError(null);
        setUploadResult(null);

        try {
            const formData = new FormData();
            formData.append('image', selectedFile);

            const response = await fetch(apiUrl('/api/FaceDatasetCheck/check-upload'), {
                method: 'POST',
                body: formData
            });
            const data = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(data?.Error || 'Failed to check image');
            }

            setUploadResult({
                ImageName: data?.ImageName ?? selectedFile.name,
                ImageSize: Number(data?.ImageSize ?? selectedFile.size),
                CheckedDatasets: Array.isArray(data?.CheckedDatasets) ? data.CheckedDatasets : [],
                Found: Boolean(data?.Found),
                Similarity: Number(data?.Similarity ?? 0),
                Confidence: data?.Confidence ?? 'N/A',
                Message: data?.Message ?? 'No result details available.',
                Disclaimer: data?.Disclaimer ?? '',
                TechnicalDetails: {
                    EmbeddingModel: data?.TechnicalDetails?.EmbeddingModel ?? 'N/A',
                    IndexSize: data?.TechnicalDetails?.IndexSize ?? 'N/A',
                    SearchMethod: data?.TechnicalDetails?.SearchMethod ?? 'N/A',
                    ProcessingTime: data?.TechnicalDetails?.ProcessingTime ?? 'N/A',
                    ImageHashSha256: data?.TechnicalDetails?.ImageHashSha256
                },
                CandidateUrlsDetected: Array.isArray(data?.CandidateUrlsDetected) ? data.CandidateUrlsDetected : [],
                Evidence: Array.isArray(data?.Evidence) ? data.Evidence : []
            });
        } catch (err: any) {
            setError(err.message || 'Error checking image. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    return (
        <div className="tool-page">
            <div className="tool-header">
                <h1 className="tool-title">Face Dataset Check</h1>
                <p className="tool-description">
                    Check whether your image URL appears in public crawl indexes that commonly feed
                    downstream large-scale AI datasets.
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
                        className={`button segmented-toggle-btn ${checkType === 'upload' ? 'is-active' : ''}`}
                        onClick={() => setCheckType('upload')}
                        type="button"
                    >
                        Upload Image
                    </button>
                </div>

                {checkType === 'url' ? (
                    <form onSubmit={handleUrlCheck}>
                        <div className="input-group">
                            <label className="input-label">Image URL</label>
                            <input
                                type="url"
                                className="input-field"
                                placeholder="https://example.com/photo.jpg"
                                value={imageUrl}
                                onChange={(e) => setImageUrl(e.target.value)}
                                required
                            />
                            <small className="helper-text">Use a direct image URL (for example from your portfolio or profile page).</small>
                        </div>
                        <button type="submit" className="button button-primary" disabled={loading}>
                            {loading ? 'Checking...' : 'Check Crawl Evidence'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleUploadCheck}>
                        <div className="input-group">
                            <label className="input-label">Select Image File</label>
                            <input
                                type="file"
                                className="input-field"
                                accept="image/jpeg,image/png,image/jpg,image/webp"
                                onChange={handleFileChange}
                                required
                            />
                            <small className="helper-text">Supported formats: JPEG, PNG, WebP (max 10MB).</small>
                            {selectedFile && (
                                <div className="helper-text">
                                    Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                                </div>
                            )}
                        </div>
                        <button type="submit" className="button button-primary" disabled={loading}>
                            {loading ? 'Processing...' : 'Analyze Image'}
                        </button>
                    </form>
                )}
            </div>

            {loading && (
                <div className="loading">
                    <div className="spinner"></div>
                    <p>{checkType === 'upload' ? 'Extracting metadata and checking crawl evidence...' : 'Searching crawl indexes...'}</p>
                </div>
            )}

            {error && <div className="error-message">{error}</div>}

            {urlResult && (
                <div className="results-card">
                    <div className="result-header">
                        <span className={`result-icon ${urlResult.Found ? 'icon-warning' : 'icon-success'}`} />
                        <h2 className="result-title">URL Check Results</h2>
                        <span className={`status-badge ${urlResult.Found ? 'status-danger' : 'status-success'}`}>
                            {urlResult.Found ? 'Evidence Found' : 'No Evidence'}
                        </span>
                    </div>

                    <div className="result-section">
                        <h4>Checked Datasets</h4>
                        <div className="pill-row">
                            {urlResult.CheckedDatasets.map((dataset, idx) => (
                                <span key={idx} className="status-badge status-info">
                                    {dataset}
                                </span>
                            ))}
                        </div>
                    </div>


                    <div className="result-section">
                        <div className={`result-panel ${urlResult.Found ? 'panel-danger' : 'panel-success'}`}>
                            <div className="result-line">
                                <strong>Confidence:</strong> {urlResult.Confidence}
                            </div>
                            <div>
                                {urlResult.Message}
                            </div>
                        </div>
                    </div>

                    {urlResult.Evidence && urlResult.Evidence.length > 0 && (
                        <div className="result-section">
                            <h4>Crawl Evidence</h4>
                            <ul className="result-list">
                                {urlResult.Evidence.map((entry, idx) => (
                                    <li key={idx}>
                                        <div><strong>Crawl:</strong> {entry.Crawl}</div>
                                        <div><strong>Captured:</strong> {formatTimestamp(entry.Timestamp)}</div>
                                        <div><strong>Status:</strong> {entry.Status || 'Unknown'}</div>
                                        {entry.Url && (
                                            <div>
                                                <strong>URL:</strong>{' '}
                                                <a
                                                    href={entry.Url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="result-inline-link"
                                                >
                                                    {entry.Url}
                                                </a>
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {urlResult.Resources && urlResult.Resources.length > 0 && (
                        <div className="result-section">
                            <h4>Additional Resources</h4>
                            <ul className="result-list">
                                {urlResult.Resources.map((resource, idx) => (
                                    <li key={idx}>
                                        <a 
                                            href={resource.Url} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="result-inline-link"
                                        >
                                            {resource.Name} →
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="disclaimer">
                        <strong>Important:</strong> {urlResult.Disclaimer}
                    </div>
                </div>
            )}

            {uploadResult && (
                <div className="results-card">
                    <div className="result-header">
                        <span className={`result-icon ${uploadResult.Found ? 'icon-warning' : 'icon-success'}`} />
                        <h2 className="result-title">Upload Evidence Results</h2>
                        <span className={`status-badge ${uploadResult.Found ? 'status-warning' : 'status-success'}`}>
                            {uploadResult.Found ? 'Evidence Found' : 'No Evidence'}
                        </span>
                    </div>

                    <div className="result-section">
                        <div className="stat-grid">
                            <div className="stat-card">
                                <span className="stat-value">{(uploadResult.ImageSize / 1024).toFixed(1)} KB</span>
                                <span className="stat-label">Image Size</span>
                            </div>
                            {uploadResult.Found && (
                                <div className="stat-card">
                                    <span className="stat-value">{(uploadResult.Similarity * 100).toFixed(1)}%</span>
                                    <span className="stat-label">Evidence Score</span>
                                </div>
                            )}
                            <div className="stat-card">
                                <span className="stat-value">{uploadResult.Confidence}</span>
                                <span className="stat-label">Confidence</span>
                            </div>
                        </div>
                    </div>

                    <div className="result-section">
                        <h4>Checked Datasets</h4>
                        <div className="pill-row">
                            {uploadResult.CheckedDatasets.map((dataset, idx) => (
                                <span key={idx} className="status-badge status-info">
                                    {dataset}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="result-section">
                        <div className={`result-panel ${uploadResult.Found ? 'panel-warning' : 'panel-success'}`}>
                            {uploadResult.Message}
                        </div>
                    </div>

                    <div className="result-section">
                        <h4>Technical Details</h4>
                        <div className="result-panel">
                            <div className="result-line">
                                <strong>Embedding Model:</strong> {uploadResult.TechnicalDetails.EmbeddingModel}
                            </div>
                            <div className="result-line">
                                <strong>Index Size:</strong> {uploadResult.TechnicalDetails.IndexSize}
                            </div>
                            <div className="result-line">
                                <strong>Search Method:</strong> {uploadResult.TechnicalDetails.SearchMethod}
                            </div>
                            <div className="result-line">
                                <strong>Processing Time:</strong> {uploadResult.TechnicalDetails.ProcessingTime}
                            </div>
                            {uploadResult.TechnicalDetails.ImageHashSha256 && (
                                <div className="result-line" style={{ wordBreak: 'break-all' }}>
                                    <strong>Image Hash (SHA-256):</strong> {uploadResult.TechnicalDetails.ImageHashSha256}
                                </div>
                            )}
                        </div>
                    </div>

                    {uploadResult.CandidateUrlsDetected && uploadResult.CandidateUrlsDetected.length > 0 && (
                        <div className="result-section">
                            <h4>Detected Source URLs</h4>
                            <ul className="result-list">
                                {uploadResult.CandidateUrlsDetected.map((url, idx) => (
                                    <li key={idx}>
                                        <a
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="result-inline-link"
                                        >
                                            {url}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {uploadResult.Evidence && uploadResult.Evidence.length > 0 && (
                        <div className="result-section">
                            <h4>Evidence Summary</h4>
                            <ul className="result-list">
                                {uploadResult.Evidence.map((item, idx) => (
                                    <li key={idx}>
                                        <div><strong>Source URL:</strong> {item.Url}</div>
                                        <div><strong>Total Matches:</strong> {item.TotalMatches}</div>
                                        <div style={{ marginTop: '0.5rem' }}>
                                            <strong>Crawl Coverage:</strong>
                                            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem' }}>
                                                {item.Crawls.map((crawl, crawlIdx) => (
                                                    <li key={crawlIdx}>{crawl.Crawl}: {crawl.Count} record(s)</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="disclaimer">
                        <strong>Important:</strong> {uploadResult.Disclaimer}
                    </div>
                </div>
            )}

            {!loading && !urlResult && !uploadResult && !error && (
                <div className="info-block">
                    <h4>How It Works</h4>
                    <p>
                        <strong>URL Check:</strong> Performs deterministic exact-URL lookups against Common Crawl indexes.<br/>
                        <strong>Image Upload:</strong> Extracts metadata/source URLs and checks them against crawl indexes.
                    </p>
                    <p>
                        This approach provides transparent evidence for web-crawl exposure, which is often a proxy signal
                        for inclusion in downstream large-scale AI datasets.
                    </p>
                </div>
            )}
        </div>
    );
}
