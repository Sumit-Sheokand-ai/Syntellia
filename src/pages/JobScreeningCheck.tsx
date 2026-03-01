import { useState } from 'react';
import { apiUrl } from '../lib/api';

interface JobScreeningResult {
    CompanyName: string;
    CareersUrl: string;
    ATSDetected: boolean;
    ATSVendor: string | null;
    DetectionMethod: string | null;
    LikelyUsesAI: boolean;
    Disclaimer: string;
    KnownAIVendors: string[];
    Recommendation: string;
}

export default function JobScreeningCheck() {
    const [companyName, setCompanyName] = useState('');
    const [careersUrl, setCareersUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<JobScreeningResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleCheck = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const response = await fetch(apiUrl('/api/JobScreeningCheck/check'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    CompanyName: companyName,
                    CareersUrl: careersUrl || undefined
                })
            });

            if (!response.ok) throw new Error('Failed to check company');
            const data = await response.json();
            setResult(data);
        } catch (err) {
            setError('Error checking company. Please verify the information and try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="tool-page">
            <div className="tool-header">
                <h1 className="tool-title">💼 Job AI Screening Check</h1>
                <p className="tool-description">
                    Detect if a company uses AI-powered applicant tracking systems (ATS) for resume screening.
                    Get insights on how to optimize your application for automated processing.
                </p>
            </div>

            <div className="input-card">
                <form onSubmit={handleCheck}>
                    <div className="input-group">
                        <label className="input-label">Company Name</label>
                        <input
                            type="text"
                            className="input-field"
                            placeholder="e.g., Google, Amazon, Microsoft"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            required
                        />
                    </div>
                    <div className="input-group">
                        <label className="input-label">Careers Page URL (Optional)</label>
                        <input
                            type="url"
                            className="input-field"
                            placeholder="https://company.com/careers"
                            value={careersUrl}
                            onChange={(e) => setCareersUrl(e.target.value)}
                        />
                        <small style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', display: 'block' }}>
                            Providing a careers URL improves detection accuracy
                        </small>
                    </div>
                    <button type="submit" className="button button-primary" disabled={loading}>
                        {loading ? 'Analyzing...' : 'Check ATS System'}
                    </button>
                </form>
            </div>

            {loading && (
                <div className="loading">
                    <div className="spinner"></div>
                    <p>Analyzing ATS system...</p>
                </div>
            )}

            {error && <div className="error-message">{error}</div>}

            {result && (
                <div className="results-card">
                    <div className="result-header">
                        <span className="result-icon">{result.ATSDetected ? '🤖' : 'ℹ️'}</span>
                        <h2 className="result-title">ATS Detection Results</h2>
                        <span className={`status-badge ${result.ATSDetected ? 'status-warning' : 'status-info'}`}>
                            {result.ATSDetected ? 'ATS Detected' : 'Not Detected'}
                        </span>
                    </div>

                    {result.ATSDetected && result.ATSVendor && (
                        <div className="result-section">
                            <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '8px' }}>
                                <div style={{ marginBottom: '1rem' }}>
                                    <strong style={{ fontSize: '1.2rem', color: 'var(--primary-color)' }}>
                                        Detected ATS: {result.ATSVendor}
                                    </strong>
                                </div>
                                <div style={{ color: 'var(--text-secondary)' }}>
                                    <strong>Detection Method:</strong> {result.DetectionMethod}
                                </div>
                                {result.LikelyUsesAI && (
                                    <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(255, 152, 0, 0.1)', borderRadius: '6px' }}>
                                        ⚠️ This ATS platform typically includes AI-powered resume screening features
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="result-section">
                        <h4>Recommendation</h4>
                        <div style={{ 
                            background: 'var(--bg-secondary)', 
                            padding: '1rem', 
                            borderRadius: '8px',
                            borderLeft: '3px solid var(--primary-color)'
                        }}>
                            {result.Recommendation}
                        </div>
                    </div>

                    {result.KnownAIVendors.length > 0 && (
                        <div className="result-section">
                            <h4>Known AI Screening Vendors</h4>
                            <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                                These vendors provide dedicated AI resume screening solutions:
                            </p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                {result.KnownAIVendors.map((vendor, idx) => (
                                    <span key={idx} className="status-badge status-info">
                                        {vendor}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="result-section">
                        <h4>Optimization Tips for ATS Systems</h4>
                        <ul className="result-list">
                            <li>Use standard section headings (Experience, Education, Skills)</li>
                            <li>Include keywords from the job description naturally throughout your resume</li>
                            <li>Use a simple, clean format without complex tables or graphics</li>
                            <li>Save as .docx or PDF (check job posting for preferred format)</li>
                            <li>Spell out acronyms at least once (e.g., "Search Engine Optimization (SEO)")</li>
                            <li>Use standard fonts like Arial, Calibri, or Times New Roman</li>
                        </ul>
                    </div>

                    <div className="disclaimer">
                        <strong>Important:</strong> {result.Disclaimer}
                    </div>
                </div>
            )}
        </div>
    );
}
