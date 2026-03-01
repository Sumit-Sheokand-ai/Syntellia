import { useState, useEffect } from 'react';
import { apiUrl } from '../lib/api';

interface RobocallResult {
    PhoneNumber: string;
    TotalComplaints: number;
    Spoofed: boolean;
    ComplaintTypes: Array<{ Type: string; Count: number }>;
    StateDistribution: Array<{ State: string; Count: number }>;
    RecentComplaints: Array<{
        Date: string;
        Type: string;
        State: string;
        Subject: string;
    }>;
    QueryVariants?: string[];
    QueryDiagnostics?: {
        SuccessfulQueries: number;
        FailedQueries: Array<{ Variant: string; Error: string }>;
    };
    DataSource?: string;
}

export default function RobocallCheck() {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<RobocallResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const numericLength = phoneNumber.replace(/\D/g, '').length;

    useEffect(() => { document.title = 'Robocall Spoofing Check — Syntellia'; }, []);

    const handleCheck = async (e: React.FormEvent) => {
        e.preventDefault();
        if (numericLength < 6 || numericLength > 15) {
            setError('Please enter a valid phone number between 6 and 15 digits.');
            return;
        }
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const response = await fetch(apiUrl(`/api/RobocallCheck/check/${encodeURIComponent(phoneNumber)}`));
            const data = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(data?.Error || 'Failed to check phone number');
            }

            setResult({
                PhoneNumber: data?.PhoneNumber ?? phoneNumber,
                TotalComplaints: Number(data?.TotalComplaints ?? 0),
                Spoofed: Boolean(data?.Spoofed),
                ComplaintTypes: Array.isArray(data?.ComplaintTypes) ? data.ComplaintTypes : [],
                StateDistribution: Array.isArray(data?.StateDistribution) ? data.StateDistribution : [],
                RecentComplaints: Array.isArray(data?.RecentComplaints) ? data.RecentComplaints : [],
                QueryVariants: Array.isArray(data?.QueryVariants) ? data.QueryVariants : [],
                QueryDiagnostics: data?.QueryDiagnostics,
                DataSource: typeof data?.DataSource === 'string' ? data.DataSource : undefined
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error checking phone number. Please verify the number and try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="tool-page">
            <div className="tool-header">
                <h1 className="tool-title">Robocall Spoofing Check</h1>
                <p className="tool-description">
                    Check whether your phone number appears in public robocall complaint records.
                    International formats are supported (for example, +44, +91, +61, +1).
                </p>
            </div>

            <div className="input-card">
                <form onSubmit={handleCheck}>
                    <div className="input-group">
                        <label className="input-label">Phone Number</label>
                        <input
                            type="tel"
                            className="input-field"
                            placeholder="+44 20 7946 0958 or +1 555 123 4567"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            required
                        />
                        <small className="helper-text">
                            Enter a phone number in any international format (E.164 or local formatting).
                        </small>
                        <small className="helper-text compact">
                            Digits detected: {numericLength}/15
                        </small>
                    </div>
                    <button type="submit" className="button button-primary" disabled={loading || numericLength < 6 || numericLength > 15}>
                        {loading ? 'Checking...' : 'Check Robocall Records'}
                    </button>
                </form>
            </div>

            {loading && (
                <div className="loading">
                    <div className="spinner"></div>
                    <p>Searching complaint records...</p>
                </div>
            )}

            {error && <div className="error-message">{error}</div>}

            {result && (
                <div className="results-card">
                    <div className="result-header">
                        <span className={`result-icon ${result.Spoofed ? 'icon-warning' : 'icon-success'}`} />
                        <h2 className="result-title">Complaint Analysis</h2>
                        <span className={`status-badge ${result.Spoofed ? 'status-danger' : 'status-success'}`}>
                            {result.Spoofed ? 'Complaints Found' : 'No Complaints'}
                        </span>
                    </div>

                    <div className="result-section">
                        <div className="stat-grid">
                            <div className="stat-card">
                                <span className="stat-value">{result.TotalComplaints}</span>
                                <span className="stat-label">Total Complaints</span>
                            </div>
                            <div className="stat-card">
                                <span className="stat-value">{result.ComplaintTypes.length}</span>
                                <span className="stat-label">Complaint Types</span>
                            </div>
                            <div className="stat-card">
                                <span className="stat-value">{result.StateDistribution.length}</span>
                                <span className="stat-label">Locations Affected</span>
                            </div>
                        </div>
                    </div>

                    {result.DataSource && (
                        <div className="result-section">
                            <p className="helper-text" style={{ marginTop: 0 }}>
                                <strong>Data source:</strong> {result.DataSource}
                            </p>
                        </div>
                    )}

                    {result.TotalComplaints > 0 && (
                        <>
                            <div className="result-section">
                                <h4>Complaint Types</h4>
                                <ul className="result-list">
                                    {result.ComplaintTypes.map((type, idx) => (
                                        <li key={idx}>
                                            <div className="split-row">
                                                <span><strong>{type.Type}</strong></span>
                                                <span className="status-badge status-info">{type.Count}</span>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {result.StateDistribution.length > 0 && (
                                <div className="result-section">
                                    <h4>Location Distribution (Top 10)</h4>
                                    <ul className="result-list">
                                        {result.StateDistribution.map((state, idx) => (
                                            <li key={idx}>
                                                <div className="split-row">
                                                    <span><strong>{state.State}</strong></span>
                                                    <span className="status-badge status-info">{state.Count}</span>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {result.RecentComplaints.length > 0 && (
                                <div className="result-section">
                                    <h4>Recent Complaints</h4>
                                    <ul className="result-list">
                                        {result.RecentComplaints.map((complaint, idx) => (
                                            <li key={idx}>
                                                <div><strong>Date:</strong> {complaint.Date}</div>
                                                <div><strong>Type:</strong> {complaint.Type}</div>
                                                <div><strong>State:</strong> {complaint.State}</div>
                                                {complaint.Subject && <div><strong>Subject:</strong> {complaint.Subject}</div>}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {result.QueryDiagnostics && (
                                <div className="result-section">
                                    <h4>Query Diagnostics</h4>
                                    <p className="helper-text" style={{ marginTop: 0 }}>
                                        Successful variant lookups: {result.QueryDiagnostics.SuccessfulQueries}
                                    </p>
                                    {result.QueryVariants && result.QueryVariants.length > 0 && (
                                        <div className="helper-text" style={{ marginTop: 0 }}>
                                            <strong>Checked variants:</strong> {result.QueryVariants.join(', ')}
                                        </div>
                                    )}
                                    {result.QueryDiagnostics.FailedQueries?.length > 0 && (
                                        <ul className="result-list">
                                            {result.QueryDiagnostics.FailedQueries.map((entry, idx) => (
                                                <li key={idx}>
                                                    <strong>{entry.Variant}</strong>: {entry.Error}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    <div className="disclaimer">
                        <strong>What this means:</strong> {result.Spoofed 
                            ? 'This number appears in complaint records linked to unwanted calls. In many cases this indicates caller ID spoofing rather than direct compromise of your device.'
                            : 'No complaint matches were found for this number in the queried public records.'
                        }
                    </div>
                </div>
            )}
        </div>
    );
}
