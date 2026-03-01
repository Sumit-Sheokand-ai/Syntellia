import { motion } from 'framer-motion';

const features = [
    {
        icon: '🎯',
        title: 'Zero API Keys Required',
        description: 'All tools use public APIs. No registration, no tokens, no limits. Just pure transparency.'
    },
    {
        icon: '🌍',
        title: 'Public Data Sources',
        description: 'Access Common Crawl, FCC complaints, FDA databases, and more official public datasets.'
    },
    {
        icon: '⚡',
        title: 'Real-Time Results',
        description: 'Get instant insights from billions of records. No waiting, no batch processing.'
    },
    {
        icon: '🔓',
        title: 'Fully Open Source',
        description: 'Inspect the code. Verify the privacy. Deploy your own instance. Complete transparency.'
    },
    {
        icon: '💰',
        title: 'Forever Free',
        description: 'No freemium model, no premium tier, no hidden costs. Always free, always will be.'
    },
    {
        icon: '🛡️',
        title: 'Privacy First',
        description: 'We don\'t store your searches. No tracking, no analytics, no data collection.'
    }
];

export default function FeaturesShowcase() {
    return (
        <section className="features-section">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="features-header"
            >
                <h2 className="section-title">Why Syntellia?</h2>
                <p className="section-subtitle">
                    Built on principles of transparency, accessibility, and user empowerment
                </p>
            </motion.div>

            <div className="features-grid">
                {features.map((feature, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-50px" }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        whileHover={{ 
                            y: -10,
                            transition: { duration: 0.2 }
                        }}
                        className="feature-card"
                    >
                        <motion.div
                            className="feature-icon"
                            whileHover={{ 
                                scale: 1.2,
                                rotate: 360,
                                transition: { duration: 0.6 }
                            }}
                        >
                            {feature.icon}
                        </motion.div>
                        <h3 className="feature-title">{feature.title}</h3>
                        <p className="feature-description">{feature.description}</p>
                    </motion.div>
                ))}
            </div>

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="features-cta"
            >
                <div className="cta-card">
                    <h3>Ready to Discover Your Digital Footprint?</h3>
                    <p>Start exploring how your data is being used across the internet</p>
                    <a href="#tools" className="button button-primary button-large">
                        Get Started Free
                        <span className="button-icon">↓</span>
                    </a>
                </div>
            </motion.div>
        </section>
    );
}
