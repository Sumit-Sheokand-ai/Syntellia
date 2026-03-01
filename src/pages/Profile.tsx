import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

export default function Profile() {
    const { user, signOut, loading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => { document.title = 'Profile — Syntellia'; }, []);

    useEffect(() => {
        if (!loading && !user) {
            navigate('/login');
        }
    }, [user, loading, navigate]);

    const handleSignOut = async () => {
        await signOut();
        navigate('/');
    };

    if (loading) {
        return (
            <div className="loading">
                <div className="spinner"></div>
                <p>Loading profile...</p>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    return (
        <div className="tool-page">
            <div className="tool-header">
                <h1 className="tool-title">Your Profile</h1>
                <p className="tool-description">
                    Manage your account and review your Syntellia access details
                </p>
            </div>

            <div className="input-card">
                <div className="profile-section">
                    <h3>Account Information</h3>
                    <div className="profile-info">
                        <div className="profile-item">
                            <label>Email</label>
                            <p>{user.email}</p>
                        </div>
                        {user.user_metadata?.full_name && (
                            <div className="profile-item">
                                <label>Full Name</label>
                                <p>{user.user_metadata.full_name}</p>
                            </div>
                        )}
                        <div className="profile-item">
                            <label>User ID</label>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{user.id}</p>
                        </div>
                    </div>
                </div>

                <div className="profile-section">
                    <h3>Session Preferences</h3>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Session state is cached client-side for faster sign-in continuity across visits.
                    </p>
                </div>

                <div className="profile-section">
                    <h3>Privacy Settings</h3>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Your search history is private and stored securely. Only you can access your data.
                    </p>
                </div>

                <div className="profile-actions">
                    <button 
                        onClick={handleSignOut}
                        className="button button-primary"
                    >
                        Sign Out
                    </button>
                </div>
            </div>

            <div className="results-card">
                <h3>Upcoming Capabilities</h3>
                <ul className="result-list">
                    <li>Organized search history and trend analysis</li>
                    <li>Automated change alerts for monitored queries</li>
                    <li>Email digest notifications</li>
                    <li>Two-factor authentication</li>
                </ul>
            </div>
        </div>
    );
}
