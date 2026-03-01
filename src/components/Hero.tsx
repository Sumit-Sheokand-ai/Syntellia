import { motion } from 'framer-motion';

export default function Hero() {
    return (
        <section className="hero">
            <div className="hero-content">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="hero-badge"
                >
                    <span className="badge-icon">🔐</span>
                    <span>Your Privacy Intelligence Platform</span>
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="hero-title"
                >
                    Discover How Your Data
                    <span className="gradient-text"> Powers the Digital World</span>
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                    className="hero-description"
                >
                    Six powerful privacy checks to see if your personal information is being used in AI training,
                    telemarketing, housing records, and more. All powered by free, public APIs.
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.6 }}
                    className="hero-cta"
                >
                    <a href="/signup" className="button button-primary button-large">
                        Sign Up to Get Started
                        <span className="button-icon">→</span>
                    </a>
                    <a href="/login" className="button button-secondary button-large">
                        Login
                    </a>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1, delay: 0.8 }}
                    className="hero-info-box"
                >
                    <span className="info-icon">🔐</span>
                    <p>Create a free account to access all Syntellia privacy checks</p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1, delay: 0.8 }}
                    className="hero-stats"
                >
                    <div className="stat-item">
                        <div className="stat-value">6</div>
                        <div className="stat-label">Privacy Checks</div>
                    </div>
                    <div className="stat-divider"></div>
                    <div className="stat-item">
                        <div className="stat-value">100%</div>
                        <div className="stat-label">Free & Open</div>
                    </div>
                    <div className="stat-divider"></div>
                    <div className="stat-item">
                        <div className="stat-value">0</div>
                        <div className="stat-label">API Keys Needed</div>
                    </div>
                </motion.div>
            </div>

            <div className="hero-visual">
                <motion.div
                    animate={{
                        scale: [1, 1.05, 1],
                        rotate: [0, 5, 0],
                    }}
                    transition={{
                        duration: 8,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                    className="floating-card"
                >
                    <div className="visual-grid">
                        {[...Array(36)].map((_, i) => (
                            <motion.div
                                key={i}
                                className="grid-cell"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: [0.2, 0.8, 0.2] }}
                                transition={{
                                    duration: 3,
                                    repeat: Infinity,
                                    delay: i * 0.1,
                                }}
                            />
                        ))}
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
