import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import '../styles/home-premium.css';

const trustedBy = [
    'Security Operations',
    'Compliance Teams',
    'Privacy Researchers',
    'Policy Analysts',
    'Product Trust',
    'Risk & Governance'
];

const checks = [
    {
        title: 'AI Content Exposure',
        summary: 'See whether your published text appears in large-scale training corpora and crawl indexes.',
        path: '/ai-content',
        metric: 'Common Crawl + Infini-gram'
    },
    {
        title: 'Robocall Spoofing',
        summary: 'Check if your phone number appears in public complaint records linked to spoofed call activity.',
        path: '/robocall',
        metric: 'Public complaint data'
    },
    {
        title: 'Medication Formula Tracking',
        summary: 'Track inactive-ingredient changes across historical medication label records for your medication.',
        path: '/medication',
        metric: 'Medication label records'
    },
    {
        title: 'Face Dataset Trace',
        summary: 'Run deterministic URL evidence checks against public crawl indexes for image exposure.',
        path: '/face-dataset',
        metric: 'Common Crawl index lookup'
    }
];

const capabilityPillars = [
    {
        title: 'Source-verified results',
        description: 'Every check is tied to a concrete public dataset or index endpoint.'
    },
    {
        title: 'Focused privacy workflow',
        description: 'A single place to run high-value checks without noisy dashboards.'
    },
    {
        title: 'Production-grade security',
        description: 'JWT-protected endpoints, hardened headers, rate limits, and CORS controls.'
    }
];

export default function Home() {
    useEffect(() => {
        document.title = 'Syntellia — Privacy Intelligence Suite';
        document.body.classList.add('home-premium-page');
        return () => {
            document.body.classList.remove('home-premium-page');
        };
    }, []);
    return (
        <div className="home-premium">
            <section className="premium-hero" id="top">
                <motion.div
                    className="premium-hero-copy"
                    initial={{ opacity: 0, y: 22 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                >
                    <span className="premium-badge">Syntellia · Privacy Intelligence Suite</span>
                    <h1 className="premium-title">
                        Understand your digital exposure with
                        <span> absolute clarity</span>
                    </h1>
                    <p className="premium-subtitle">
                        Run focused checks for AI training exposure, robocall complaint signals, medication label history,
                        and face-dataset trace evidence—grounded in public sources.
                    </p>
                    <div className="premium-hero-actions">
                        <Link to="/signup" className="premium-btn premium-btn-primary">
                            Start Assessment
                        </Link>
                        <a href="#checks" className="premium-btn premium-btn-secondary">
                            View Workflows
                        </a>
                    </div>
                </motion.div>

                <motion.div
                    className="premium-hero-panel"
                    initial={{ opacity: 0, y: 28, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.8, delay: 0.15, ease: 'easeOut' }}
                >
                    <div className="panel-topbar">
                        <span className="dot red"></span>
                        <span className="dot yellow"></span>
                        <span className="dot green"></span>
                    </div>
                    <div className="panel-content">
                        <aside className="panel-sidebar">
                            <div className="line line-lg"></div>
                            <div className="line"></div>
                            <div className="line"></div>
                            <div className="line line-sm"></div>
                        </aside>
                        <main className="panel-main">
                            <div className="panel-metric-card">
                                <div className="line line-lg"></div>
                                <div className="bars">
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                </div>
                            </div>
                            <div className="panel-grid">
                                <div className="panel-block"></div>
                                <div className="panel-block"></div>
                            </div>
                        </main>
                        <aside className="panel-aside">
                            <div className="line line-lg"></div>
                            <div className="line"></div>
                            <div className="line"></div>
                            <div className="line line-sm"></div>
                        </aside>
                    </div>
                </motion.div>
            </section>

            <section className="premium-trust">
                <p>Built for modern privacy and trust teams</p>
                <div className="brand-row">
                    {trustedBy.map((brand) => (
                        <span key={brand}>{brand}</span>
                    ))}
                </div>
            </section>

            <section className="premium-pillars">
                <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-120px' }}
                    transition={{ duration: 0.55 }}
                >
                    Precision tools for modern privacy operations
                </motion.h2>
                <div className="pillar-grid">
                    {capabilityPillars.map((pillar, index) => (
                        <motion.article
                            key={pillar.title}
                            className="pillar-card"
                            initial={{ opacity: 0, y: 26 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: '-120px' }}
                            transition={{ duration: 0.5, delay: index * 0.08 }}
                        >
                            <h3>{pillar.title}</h3>
                            <p>{pillar.description}</p>
                        </motion.article>
                    ))}
                </div>
            </section>

            <section className="premium-checks" id="checks">
                <div className="checks-header">
                    <h2>Syntellia Checks</h2>
                    <p>Select a focused workflow based on the risk signal you need to validate.</p>
                </div>
                <div className="checks-grid">
                    {checks.map((check, index) => (
                        <motion.article
                            key={check.path}
                            className="check-card"
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: '-100px' }}
                            transition={{ duration: 0.5, delay: index * 0.06 }}
                        >
                            <Link to={check.path} className="check-card-link" aria-label={`Open ${check.title}`}>
                                <h3>{check.title}</h3>
                                <p>{check.summary}</p>
                                <div className="check-metric">{check.metric}</div>
                            </Link>
                        </motion.article>
                    ))}
                </div>
            </section>

            <section className="premium-workflow">
                <motion.div
                    className="workflow-preview"
                    initial={{ opacity: 0, x: -28 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: '-120px' }}
                    transition={{ duration: 0.55 }}
                >
                    <div className="workflow-card">
                        <div className="workflow-title">Signal Review</div>
                        <div className="workflow-table">
                            <div className="workflow-row"></div>
                            <div className="workflow-row"></div>
                            <div className="workflow-row"></div>
                            <div className="workflow-row"></div>
                        </div>
                    </div>
                </motion.div>
                <motion.div
                    className="workflow-copy"
                    initial={{ opacity: 0, x: 28 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: '-120px' }}
                    transition={{ duration: 0.55 }}
                >
                    <h2>Clarity without visual noise</h2>
                    <p>
                        Syntellia is intentionally minimal: focused checks, source-backed output, and restrained interaction.
                        It is designed for teams that need confidence, not noise.
                    </p>
                    <ul>
                        <li>Structured output for fast decision-making</li>
                        <li>Subtle motion and smooth scroll behavior</li>
                        <li>Consistent premium visual hierarchy</li>
                    </ul>
                </motion.div>
            </section>

            <section className="premium-cta">
                <h2>Ready to run your first assessment?</h2>
                <p>Create an account to access all current Syntellia workflows.</p>
                <div className="premium-hero-actions">
                    <Link to="/signup" className="premium-btn premium-btn-primary">
                        Create Account
                    </Link>
                    <Link to="/login" className="premium-btn premium-btn-secondary">
                        Log In
                    </Link>
                </div>
            </section>
        </div>
    );
}
