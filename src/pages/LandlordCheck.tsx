import { useState } from 'react';
import { apiUrl } from '../lib/api';

interface LandlordResult {
    Found: boolean;
    Query: string;
    City: string;
    Summary: {
        TotalViolations: number;
        TotalLitigations: number;
        RiskLevel: string;
    };
    RecentCases: Array<{
        Type: string;
        CaseType?: string;
        CaseOpenDate?: string;
        Status?: string;
    }>;
    Message: string;
    Disclaimer: string;
    SupportedCities?: string[];
}

export default function LandlordCheck() {
    const [query, setQuery] = useState('');
    const [city, setCity] = useState('nyc');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<LandlordResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleCheck = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const params = new URLSearchParams({ query, city });
            const response = await fetch(apiUrl(`/api/LandlordCheck/check?${params}`));
            
            if (!response.ok) throw new Error('Failed to check landlord');
            const data = await response.json();
            setResult(data);
        } catch (err) {
            setError('Error checking landlord records. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const getRiskColor = (riskLevel: string) => {
        switch (riskLevel.toLowerCase()) {
            case 'very high': return 'var(--danger-color)';
            case 'high': return 'var(--danger-color)';
            case 'moderate': return 'var(--warning-color)';
            case 'low': return 'var(--success-color)';
            default: return 'var(--text-secondary)';
        }
    };

    return (
        <div className="tool-page">
            <div className="tool-header">
                <h1 className="tool-title">🏠 Landlord Court Record Check</h1>
                <p className="tool-description">
                    Search housing court records for violations and litigation. Check if your landlord has a
                    history of housing code violations or has been taken to court by tenants.
                </p>
            </div>

            <div className="input-card">
                <form onSubmit={handleCheck}>
                    <div className="input-group">
                        <label className="input-label">Landlord Name or Address</label>
                        <input
                            type="text"
                            className="input-field"
                            placeholder="e.g., John Smith, ABC Realty, or 123 Main Street"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            required
                        />
                        <small style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', display: 'block' }}>
                            Search by landlord name, company name, or property address
                        </small>
                    </div>
                    <div className="input-group">
                        <label className="input-label">City</label>
                        <select 
                            className="input-field" 
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                        >
                            <option value="nyc">New York City</option>
                            <option value="chicago" disabled>Chicago (Coming Soon)</option>
                            <option value="boston" disabled>Boston (Coming Soon)</option>
                        </select>
                        <small style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', display: 'block' }}>
                            Currently only NYC data is available
                        </small>
                    </div>
                    <button type="submit" className="button button-primary" disabled={loading}>
                        {loading ? 'Searching...' : 'Check Housing Records'}
                    </button>
                </form>
            </div>

            {loading && (
                <div className="loading">
                    <div className="spinner"></div>
                    <p>Searching housing court records...</p>
                </div>
            )}

            {error && <div className="error-message">{error}</div>}

            {result && result.SupportedCities && (
                <div className="results-card">
                    <div className="result-header">
                        <span className="result-icon">ℹ️</span>
                        <h2 className="result-title">Limited Coverage</h2>
                        <span className="status-badge status-info">NYC Only</span>
                    </div>
                    <p>{result.Message}</p>
                    <div style={{ marginTop: '1rem' }}>
                        <strong>Supported Cities:</strong>
                        <ul style={{ marginTop: '0.5rem' }}>
                            {result.SupportedCities.map((c, idx) => (
                                <li key={idx}>{c}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            {result && !result.SupportedCities && (
                <div className="results-card">
                    <div className="result-header">
                        <span className="result-icon">{result.Found ? '⚠️' : '✅'}</span>
                        <h2 className="result-title">Housing Record Search</h2>
                        <span className={`status-badge ${result.Found ? 'status-danger' : 'status-success'}`}>
                            {result.Found ? 'Records Found' : 'No Records'}
                        </span>
                    </div>

                    <div className="result-section">
                        <div className="stat-grid">
                            <div className="stat-card">
                                <span className="stat-value">{result.Summary.TotalViolations}</span>
                                <span className="stat-label">Housing Violations</span>
                            </div>
                            <div className="stat-card">
                                <span className="stat-value">{result.Summary.TotalLitigations}</span>
                                <span className="stat-label">Court Cases</span>
                            </div>
                            <div className="stat-card">
                                <span 
                                    className="stat-value" 
                                    style={{ color: getRiskColor(result.Summary.RiskLevel) }}
                                >
                                    {result.Summary.RiskLevel}
                                </span>
                                <span className="stat-label">Risk Level</span>
                            </div>
                        </div>
                    </div>

                    {result.Found && result.RecentCases.length > 0 && (
                        <div className="result-section">
                            <h4>Recent Cases</h4>
                            <ul className="result-list">
                                {result.RecentCases.map((case_, idx) => (
                                    <li key={idx}>
                                        <div><strong>Type:</strong> {case_.Type}</div>
                                        {case_.CaseType && <div><strong>Case Type:</strong> {case_.CaseType}</div>}
                                        {case_.CaseOpenDate && <div><strong>Date:</strong> {case_.CaseOpenDate}</div>}
                                        {case_.Status && <div><strong>Status:</strong> {case_.Status}</div>}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="result-section">
                        <h4>Interpretation Guide</h4>
                        <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px' }}>
                            <div style={{ marginBottom: '0.5rem' }}>
                                <strong style={{ color: 'var(--success-color)' }}>No Records / Low:</strong> No significant issues found
                            </div>
                            <div style={{ marginBottom: '0.5rem' }}>
                                <strong style={{ color: 'var(--warning-color)' }}>Moderate:</strong> Some violations, worth investigating
                            </div>
                            <div style={{ marginBottom: '0.5rem' }}>
                                <strong style={{ color: 'var(--danger-color)' }}>High / Very High:</strong> Significant history of violations or litigation
                            </div>
                        </div>
                    </div>

                    <div className="disclaimer">
                        <strong>Important:</strong> {result.Disclaimer}
                        <br/><br/>
                        For NYC tenants: Visit <a href="https://www1.nyc.gov/site/hpd/index.page" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color)' }}>NYC HPD</a> for more information about tenant rights and how to file complaints.
                    </div>
                </div>
            )}
        </div>
    );
}
