import { useState, useEffect } from 'react';
import { apiUrl } from '../lib/api';

interface FormulaChange {
    FromDate: string;
    ToDate: string;
    Changed: boolean;
    Summary: string;
}

interface MedicationResult {
    Found: boolean;
    DrugName: string;
    TotalLabels: number;
    HasFormulaChanges: boolean;
    Changes: FormulaChange[];
    CurrentLabel: {
        EffectiveDate: string;
        Manufacturer: string;
        InactiveIngredients: string;
    } | null;
    HistoricalLabels: Array<{
        EffectiveDate: string;
        Manufacturer: string;
    }>;
    Message?: string;
}

export default function MedicationCheck() {
    const [drugName, setDrugName] = useState('');
    const [manufacturer, setManufacturer] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<MedicationResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => { document.title = 'Medication Formula Check — Syntellia'; }, []);

    const handleCheck = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const params = new URLSearchParams({ drugName });
            if (manufacturer) params.append('manufacturer', manufacturer);

            const response = await fetch(apiUrl(`/api/MedicationCheck/check?${params}`));
            if (!response.ok) throw new Error('Failed to check medication');
            
            const data = await response.json();
            setResult(data);
        } catch (err) {
            setError('Error checking medication. Please verify the drug name and try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="tool-page">
            <div className="tool-header">
                <h1 className="tool-title">Medication Formula Check</h1>
                <p className="tool-description">
                    Track FDA-approved medication formula changes over time. Compare ingredient lists across
                    different label versions to see if your medication has been reformulated.
                </p>
            </div>

            <div className="input-card">
                <form onSubmit={handleCheck}>
                    <div className="input-group">
                        <label className="input-label">Drug Name (Brand Name)</label>
                        <input
                            type="text"
                            className="input-field"
                            placeholder="e.g., Tylenol, Advil, Lipitor"
                            value={drugName}
                            onChange={(e) => setDrugName(e.target.value)}
                            required
                        />
                    </div>
                    <div className="input-group">
                        <label className="input-label">Manufacturer (Optional)</label>
                        <input
                            type="text"
                            className="input-field"
                            placeholder="e.g., Pfizer, Johnson & Johnson"
                            value={manufacturer}
                            onChange={(e) => setManufacturer(e.target.value)}
                        />
                        <small style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', display: 'block' }}>
                            Narrow results to a specific manufacturer
                        </small>
                    </div>
                    <button type="submit" className="button button-primary" disabled={loading}>
                        {loading ? 'Checking...' : 'Check FDA Database'}
                    </button>
                </form>
            </div>

            {loading && (
                <div className="loading">
                    <div className="spinner"></div>
                    <p>Searching FDA drug labels...</p>
                </div>
            )}

            {error && <div className="error-message">{error}</div>}

            {result && !result.Found && (
                <div className="results-card">
                    <div className="result-header">
                        <span className="result-icon icon-info" />
                        <h2 className="result-title">No Records Found</h2>
                        <span className="status-badge status-info">Not Found</span>
                    </div>
                    <p>{result.Message || 'No FDA records found for this medication.'}</p>
                </div>
            )}

            {result && result.Found && (
                <div className="results-card">
                    <div className="result-header">
                        <span className={`result-icon ${result.HasFormulaChanges ? 'icon-warning' : 'icon-success'}`} />
                        <h2 className="result-title">FDA Label Analysis</h2>
                        <span className={`status-badge ${result.HasFormulaChanges ? 'status-warning' : 'status-success'}`}>
                            {result.HasFormulaChanges ? 'Formula Changed' : 'No Changes Detected'}
                        </span>
                    </div>

                    <div className="result-section">
                        <div className="stat-grid">
                            <div className="stat-card">
                                <span className="stat-value">{result.TotalLabels}</span>
                                <span className="stat-label">FDA Label Versions</span>
                            </div>
                            <div className="stat-card">
                                <span className="stat-value">{result.Changes.length}</span>
                                <span className="stat-label">Formula Changes</span>
                            </div>
                        </div>
                    </div>

                    {result.CurrentLabel && (
                        <div className="result-section">
                            <h4>Current Label</h4>
                            <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px' }}>
                                <div style={{ marginBottom: '0.5rem' }}>
                                    <strong>Effective Date:</strong> {result.CurrentLabel.EffectiveDate}
                                </div>
                                <div style={{ marginBottom: '0.5rem' }}>
                                    <strong>Manufacturer:</strong> {result.CurrentLabel.Manufacturer || 'Not specified'}
                                </div>
                                {result.CurrentLabel.InactiveIngredients && (
                                    <div>
                                        <strong>Inactive Ingredients:</strong>
                                        <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                            {result.CurrentLabel.InactiveIngredients.substring(0, 500)}...
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {result.HasFormulaChanges && result.Changes.length > 0 && (
                        <div className="result-section">
                            <h4>Detected Formula Changes</h4>
                            <ul className="result-list">
                                {result.Changes.map((change, idx) => (
                                    <li key={idx}>
                                        <div><strong>Period:</strong> {change.FromDate} → {change.ToDate}</div>
                                        <div><strong>Change:</strong> {change.Summary}</div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {result.HistoricalLabels.length > 0 && (
                        <div className="result-section">
                            <h4>Label History</h4>
                            <ul className="result-list">
                                {result.HistoricalLabels.map((label, idx) => (
                                    <li key={idx}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span><strong>{label.EffectiveDate}</strong></span>
                                            <span style={{ color: 'var(--text-secondary)' }}>
                                                {label.Manufacturer || 'Not specified'}
                                            </span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="disclaimer">
                        <strong>What this means:</strong> This tool compares FDA drug label versions over time.
                        Changes in inactive ingredients can affect how a medication works for some people, though
                        the active ingredient remains the same. Consult your healthcare provider if you notice
                        changes after switching manufacturers or refilling a prescription.
                    </div>
                </div>
            )}
        </div>
    );
}
