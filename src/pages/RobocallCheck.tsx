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
}

export default function RobocallCheck() {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<RobocallResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => { document.title = 'Robocall Spoofing Check — Syntellia'; }, []);

    const handleCheck = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const response = await fetch(apiUrl(`/api/RobocallCheck/check/${encodeURIComponent(phoneNumber)}`));
            if (!response.ok) throw new Error('Failed to check phone number');
            
            const data = await response.json();
            setResult(data);
        } catch (err) {
            setError('Error checking phone number. Please verify the number and try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="tool-page">
            <div className="tool-header">
                <h1 className="tool-title">Robocall Spoofing Check</h1>
                <p className="tool-description">
                    Check if your phone number has been reported as the source of unwanted robocalls.
                    Data from FCC Consumer Complaints database—if complaints exist, your number was likely spoofed.
                </p>
            </div>

            <div className="input-card">
                <form onSubmit={handleCheck}>
                    <div className="input-group">
                        <label className="input-label">Phone Number</label>
                        <input
                            type="tel"
                            className="input-field"
                            placeholder="(555) 123-4567 or 5551234567"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            required
                        />
                        <small style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', display: 'block' }}>
                            Enter your phone number in any format. US numbers only.
                        </small>
                    </div>
                    <button type="submit" className="button button-primary" disabled={loading}>
                        {loading ? 'Checking...' : 'Check FCC Database'}
                    </button>
                </form>
            </div>

            {loading && (
                <div className="loading">
                    <div className="spinner"></div>
                    <p>Searching FCC complaints...</p>
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
                                <span className="stat-label">States Affected</span>
                            </div>
                        </div>
                    </div>

                    {result.TotalComplaints > 0 && (
                        <>
                            <div className="result-section">
                                <h4>Complaint Types</h4>
                                <ul className="result-list">
                                    {result.ComplaintTypes.map((type, idx) => (
                                        <li key={idx}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span><strong>{type.Type}</strong></span>
                                                <span className="status-badge status-info">{type.Count}</span>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {result.StateDistribution.length > 0 && (
                                <div className="result-section">
                                    <h4>State Distribution (Top 10)</h4>
                                    <ul className="result-list">
                                        {result.StateDistribution.map((state, idx) => (
                                            <li key={idx}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
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
                        </>
                    )}

                    <div className="disclaimer">
                        <strong>What this means:</strong> {result.Spoofed 
                            ? 'Your number has been reported as the source of unwanted calls. This almost always means scammers are spoofing your number—they don\'t actually have access to your phone. You can file a complaint at fcc.gov/complaints.'
                            : 'No FCC complaints found for this number. This is a good sign—your number hasn\'t been publicly reported as a source of unwanted calls.'
                        }
                    </div>
                </div>
            )}
        </div>
    );
}
