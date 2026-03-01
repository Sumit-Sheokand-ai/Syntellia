import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { useState } from 'react';
import './App.css';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import AIContentCheck from './pages/AIContentCheck';
import RobocallCheck from './pages/RobocallCheck';
import MedicationCheck from './pages/MedicationCheck';
import JobScreeningCheck from './pages/JobScreeningCheck';
import LandlordCheck from './pages/LandlordCheck';
import FaceDatasetCheck from './pages/FaceDatasetCheck';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Profile from './pages/Profile';

function UserMenu() {
    const { user, signOut, isAuthEnabled } = useAuth();
    const [dropdownOpen, setDropdownOpen] = useState(false);

    if (!isAuthEnabled) {
        return null;
    }

    if (!user) {
        return (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Link to="/login" className="nav-link">Login</Link>
                <Link to="/signup" className="button button-primary" style={{ padding: '0.5rem 1rem' }}>
                    Sign Up
                </Link>
            </div>
        );
    }

    return (
        <div className="user-menu">
            <button
                className="user-button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
            >
                <span className="user-avatar">{user.email?.charAt(0).toUpperCase()}</span>
                <span>{user.email?.split('@')[0]}</span>
            </button>

            {dropdownOpen && (
                <div className="user-dropdown">
                    <div className="user-email">{user.email}</div>
                    <Link to="/profile" onClick={() => setDropdownOpen(false)}>
                        Profile
                    </Link>
                    <button onClick={() => { signOut(); setDropdownOpen(false); }}>
                        Sign Out
                    </button>
                </div>
            )}
        </div>
    );
}

function AppContent() {
    return (
        <div className="app-container">
            <header className="header">
                <div className="header-content">
                    <Link to="/" className="logo">
                        Syntellia
                    </Link>
                    <nav className="nav">
                        <Link to="/ai-content" className="nav-link">AI Content</Link>
                        <Link to="/robocall" className="nav-link">Robocall</Link>
                        <Link to="/medication" className="nav-link">Medication</Link>
                        <Link to="/job-screening" className="nav-link">Job AI</Link>
                        <Link to="/landlord" className="nav-link">Landlord</Link>
                        <Link to="/face-dataset" className="nav-link">Face Dataset</Link>
                    </nav>
                    <UserMenu />
                </div>
            </header>

            <main className="main-content">
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />

                    {/* Protected Routes - Require Authentication */}
                    <Route path="/ai-content" element={
                        <ProtectedRoute>
                            <AIContentCheck />
                        </ProtectedRoute>
                    } />
                    <Route path="/robocall" element={
                        <ProtectedRoute>
                            <RobocallCheck />
                        </ProtectedRoute>
                    } />
                    <Route path="/medication" element={
                        <ProtectedRoute>
                            <MedicationCheck />
                        </ProtectedRoute>
                    } />
                    <Route path="/job-screening" element={
                        <ProtectedRoute>
                            <JobScreeningCheck />
                        </ProtectedRoute>
                    } />
                    <Route path="/landlord" element={
                        <ProtectedRoute>
                            <LandlordCheck />
                        </ProtectedRoute>
                    } />
                    <Route path="/face-dataset" element={
                        <ProtectedRoute>
                            <FaceDatasetCheck />
                        </ProtectedRoute>
                    } />
                    <Route path="/profile" element={
                        <ProtectedRoute>
                            <Profile />
                        </ProtectedRoute>
                    } />
                </Routes>
            </main>

            <footer className="footer">
                <p>All checks are powered by public APIs and open datasets. No proprietary dependencies.</p>
                <p>&copy; {new Date().getFullYear()} Syntellia &middot; Privacy Intelligence Suite</p>
            </footer>
        </div>
    );
}

function App() {
    return (
        <Router>
            <AuthProvider>
                <AppContent />
            </AuthProvider>
        </Router>
    );
}

export default App;
