import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const tools = [
    {
        id: 'ai-content',
        icon: '🤖',
        title: 'AI Training Data',
        subtitle: 'Content Discovery',
        description: 'Discover if your website, blog posts, or articles were used to train large language models like GPT, Claude, or Llama.',
        features: ['Common Crawl', 'infini-gram', '3T+ tokens', 'Real-time'],
        path: '/ai-content',
        color: '#4a90e2',
        stats: { datasets: '4', coverage: '3T tokens' }
    },
    {
        id: 'robocall',
        icon: '📞',
        title: 'Robocall Spoofing',
        subtitle: 'Phone Protection',
        description: 'Check if scammers are using your phone number as caller ID for robocalls and telemarketing fraud.',
        features: ['FCC Database', 'Real complaints', 'US Coverage', 'Updated daily'],
        path: '/robocall',
        color: '#e24a4a',
        stats: { complaints: '1M+', sources: 'FCC' }
    },
    {
        id: 'medication',
        icon: '💊',
        title: 'Medication Changes',
        subtitle: 'Formula Tracking',
        description: 'Track FDA-approved medication formula changes over time. Know if inactive ingredients changed between refills.',
        features: ['FDA Database', 'Formula history', 'All medications', 'Batch tracking'],
        path: '/medication',
        color: '#4ae2a8',
        stats: { drugs: '100K+', updates: 'Real-time' }
    },
    {
        id: 'job-screening',
        icon: '💼',
        title: 'Job AI Screening',
        subtitle: 'ATS Detection',
        description: 'Detect if companies use AI-powered applicant tracking systems to screen resumes and optimize your applications.',
        features: ['ATS Detection', '20+ vendors', 'URL analysis', 'Instant check'],
        path: '/job-screening',
        color: '#e2a84a',
        stats: { vendors: '20+', accuracy: '95%' }
    },
    {
        id: 'landlord',
        icon: '🏠',
        title: 'Landlord Records',
        subtitle: 'Housing Justice',
        description: 'Search NYC housing court records for violations and litigation history before signing a lease.',
        features: ['NYC HPD', 'Court records', 'Violations', 'Litigation'],
        path: '/landlord',
        color: '#a84ae2',
        stats: { records: '500K+', cities: 'NYC' }
    },
    {
        id: 'face-dataset',
        icon: '📸',
        title: 'Face Recognition',
        subtitle: 'Image Privacy',
        description: 'Check if your photos appear in AI training datasets like LAION-5B used for face recognition and generation.',
        features: ['LAION-5B', 'CLIP search', 'Visual matching', '5B images'],
        path: '/face-dataset',
        color: '#e24aa8',
        stats: { dataset: '5B images', method: 'CLIP' }
    }
];

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.6
        }
    }
};

export default function ToolsGrid() {
    const { user } = useAuth();

    return (
        <section id="tools" className="tools-section">
            <div className="section-header">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                >
                    <h2 className="section-title">Syntellia</h2>
                    <p className="section-subtitle">
                        Six specialized privacy checks to discover how your personal data is being used across the internet
                    </p>
                    {!user && (
                        <div className="auth-required-notice">
                            <span className="lock-icon">🔒</span>
                            <p>Sign up free to access all checks</p>
                        </div>
                    )}
                </motion.div>
            </div>

            <motion.div
                className="tools-modern-grid"
                variants={containerVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
            >
                {tools.map((tool) => {
                    // User must be logged in to access tools
                    const linkTo = user ? tool.path : '/signup';

                    return (
                        <motion.div
                            key={tool.id}
                            variants={itemVariants}
                            whileHover={{ 
                                scale: 1.02,
                                transition: { duration: 0.2 }
                            }}
                            className="tool-modern-card"
                            style={{ '--tool-color': tool.color } as React.CSSProperties}
                        >
                            <Link to={linkTo} className="tool-card-link">
                            <div className="tool-card-header">
                                <div className="tool-icon-wrapper">
                                    <span className="tool-icon-large">{tool.icon}</span>
                                    <div className="icon-glow"></div>
                                </div>
                                <div className="tool-badge">
                                    <span className="badge-dot"></span>
                                    Active
                                </div>
                            </div>

                            <div className="tool-card-content">
                                <div className="tool-subtitle">{tool.subtitle}</div>
                                <h3 className="tool-card-title">{tool.title}</h3>
                                <p className="tool-card-description">{tool.description}</p>

                                <div className="tool-features">
                                    {tool.features.map((feature, idx) => (
                                        <span key={idx} className="feature-tag">
                                            {feature}
                                        </span>
                                    ))}
                                </div>

                                <div className="tool-stats-inline">
                                    {Object.entries(tool.stats).map(([key, value]) => (
                                        <div key={key} className="stat-inline">
                                            <span className="stat-inline-label">{key}</span>
                                            <span className="stat-inline-value">{value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="tool-card-footer">
                                <span className="tool-cta">
                                    {user ? 'Check Now' : 'Sign Up to Access'}
                                    <span className="arrow">→</span>
                                </span>
                            </div>
                        </Link>
                    </motion.div>
                    );
                })}
            </motion.div>
        </section>
    );
}
