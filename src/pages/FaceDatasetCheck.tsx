import { useState } from 'react';
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
    };
}

export default function FaceDatasetCheck() {
    const [checkType, setCheckType] = useState<'url' | 'upload'>('url');
    const [imageUrl, setImageUrl] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [urlResult, setUrlResult] = useState<UrlCheckResult | null>(null);
    const [uploadResult, setUploadResult] = useState<UploadCheckResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleUrlCheck = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setUrlResult(null);

        try {
            const response = await fetch(apiUrl('/api/FaceDatasetCheck/check-url'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ImageUrl: imageUrl })
            });

            if (!response.ok) throw new Error('Failed to check image URL');
            const data = await response.json();
            setUrlResult(data);
        } catch (err) {
            setError('Error checking image URL. Please verify the URL and try again.');
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

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.Error || 'Failed to check image');
            }
            
            const data = await response.json();
            setUploadResult(data);
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
                <h1 className="tool-title">📸 Face Dataset Check</h1>
                <p className="tool-description">
                    Check if your photo appears in AI training datasets like LAION-5B. Search by URL or
                    upload an image for visual similarity matching using CLIP embeddings.
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
                        className={`button ${checkType === 'upload' ? 'button-primary' : ''}`}
                        onClick={() => setCheckType('upload')}
                        style={{ flex: 1 }}
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
                            <small style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', display: 'block' }}>
                                Enter a direct link to your photo (from social media, portfolio, etc.)
                            </small>
                        </div>
                        <button type="submit" className="button button-primary" disabled={loading}>
                            {loading ? 'Checking...' : 'Check LAION Database'}
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
                            <small style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', display: 'block' }}>
                                Supported formats: JPEG, PNG, WebP (max 10MB)
                            </small>
                            {selectedFile && (
                                <div style={{ marginTop: '0.5rem', color: 'var(--primary-color)' }}>
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
                    <p>{checkType === 'upload' ? 'Generating embeddings and searching...' : 'Searching dataset index...'}</p>
                </div>
            )}

            {error && <div className="error-message">{error}</div>}

            {urlResult && (
                <div className="results-card">
                    <div className="result-header">
                        <span className="result-icon">{urlResult.Found ? '⚠️' : '✅'}</span>
                        <h2 className="result-title">URL Check Results</h2>
                        <span className={`status-badge ${urlResult.Found ? 'status-danger' : 'status-success'}`}>
                            {urlResult.Found ? 'Found in Dataset' : 'Not Found'}
                        </span>
                    </div>

                    <div className="result-section">
                        <h4>Checked Datasets</h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {urlResult.CheckedDatasets.map((dataset, idx) => (
                                <span key={idx} className="status-badge status-info">
                                    {dataset}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="result-section">
                        <div style={{ 
                            background: 'var(--bg-secondary)', 
                            padding: '1rem', 
                            borderRadius: '8px',
                            borderLeft: `3px solid ${urlResult.Found ? 'var(--danger-color)' : 'var(--success-color)'}`
                        }}>
                            <div style={{ marginBottom: '0.5rem' }}>
                                <strong>Confidence:</strong> {urlResult.Confidence}
                            </div>
                            <div>
                                {urlResult.Message}
                            </div>
                        </div>
                    </div>

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
                                            style={{ color: 'var(--primary-color)', textDecoration: 'none' }}
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
                        <span className="result-icon">{uploadResult.Found ? '⚠️' : '✅'}</span>
                        <h2 className="result-title">Visual Similarity Results</h2>
                        <span className={`status-badge ${uploadResult.Found ? 'status-warning' : 'status-success'}`}>
                            {uploadResult.Found ? 'Similar Images Found' : 'No Matches'}
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
                                    <span className="stat-label">Similarity Score</span>
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
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {uploadResult.CheckedDatasets.map((dataset, idx) => (
                                <span key={idx} className="status-badge status-info">
                                    {dataset}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="result-section">
                        <div style={{ 
                            background: 'var(--bg-secondary)', 
                            padding: '1rem', 
                            borderRadius: '8px',
                            borderLeft: `3px solid ${uploadResult.Found ? 'var(--warning-color)' : 'var(--success-color)'}`
                        }}>
                            {uploadResult.Message}
                        </div>
                    </div>

                    <div className="result-section">
                        <h4>Technical Details</h4>
                        <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px' }}>
                            <div style={{ marginBottom: '0.5rem' }}>
                                <strong>Embedding Model:</strong> {uploadResult.TechnicalDetails.EmbeddingModel}
                            </div>
                            <div style={{ marginBottom: '0.5rem' }}>
                                <strong>Index Size:</strong> {uploadResult.TechnicalDetails.IndexSize}
                            </div>
                            <div style={{ marginBottom: '0.5rem' }}>
                                <strong>Search Method:</strong> {uploadResult.TechnicalDetails.SearchMethod}
                            </div>
                            <div>
                                <strong>Processing Time:</strong> {uploadResult.TechnicalDetails.ProcessingTime}
                            </div>
                        </div>
                    </div>

                    <div className="disclaimer">
                        <strong>Important:</strong> {uploadResult.Disclaimer}
                    </div>
                </div>
            )}

            {!loading && !urlResult && !uploadResult && !error && (
                <div className="result-section" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <h4>How It Works</h4>
                    <p style={{ marginTop: '1rem', lineHeight: '1.6' }}>
                        <strong>URL Check:</strong> Searches pre-processed LAION-5B metadata for exact URL matches.<br/>
                        <strong>Image Upload:</strong> Generates CLIP embeddings and performs visual similarity search
                        against a representative subset of LAION images.
                    </p>
                    <p style={{ marginTop: '1rem', lineHeight: '1.6' }}>
                        Note: Full 5-billion-image search is computationally infeasible for static hosting.
                        This tool provides probabilistic coverage of high-risk subsets.
                    </p>
                </div>
            )}
        </div>
    );
}
