import { motion } from 'framer-motion';

const stories = [
    {
        chapter: '01',
        title: 'Your Data is Everywhere',
        description: 'Every day, your personal information—from blog posts to phone numbers—is collected, analyzed, and used in ways you never imagined.',
        visual: '🌐',
        stats: ['3 trillion tokens', '5 billion images', '1 million complaints']
    },
    {
        chapter: '02',
        title: 'AI Models Learn From You',
        description: 'Large language models like GPT and Claude were trained on massive datasets that may include your content without your knowledge.',
        visual: '🧠',
        stats: ['Common Crawl', 'The Pile', 'LAION-5B']
    },
    {
        chapter: '03',
        title: 'Your Phone Gets Spoofed',
        description: 'Scammers use real phone numbers as caller IDs for robocalls. Your number could be showing up on thousands of phones.',
        visual: '☎️',
        stats: ['50K+ daily calls', '23 complaints/day', 'FCC tracked']
    },
    {
        chapter: '04',
        title: 'Housing Records Are Public',
        description: 'Every housing court case, violation, and lawsuit is publicly searchable. Know your landlord\'s history before signing.',
        visual: '🏘️',
        stats: ['500K+ records', 'NYC courts', 'Real-time updates']
    },
    {
        chapter: '05',
        title: 'AI Screens Your Resume',
        description: 'Companies use AI-powered ATS to filter candidates. Your resume might be rejected by algorithms before humans see it.',
        visual: '🎯',
        stats: ['20+ ATS vendors', '95% of F500', 'Auto-rejection']
    },
    {
        chapter: '06',
        title: 'Take Back Control',
        description: 'Our tools empower you to discover, understand, and take action on how your personal data is being used.',
        visual: '⚡',
        stats: ['100% free', 'No API keys', 'Open source']
    }
];

export default function StorySection() {
    return (
        <section className="story-section">
            <div className="story-intro">
                <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="story-title"
                >
                    The Story of Your Digital Footprint
                </motion.h2>
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 }}
                    className="story-subtitle"
                >
                    A journey through six critical privacy concerns in the modern digital age
                </motion.p>
            </div>

            <div className="story-timeline">
                {stories.map((story, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 0.8, delay: index * 0.1 }}
                        className={`story-card ${index % 2 === 0 ? 'story-left' : 'story-right'}`}
                    >
                        <div className="story-chapter">{story.chapter}</div>
                        
                        <div className="story-content">
                            <div className="story-visual">{story.visual}</div>
                            
                            <h3 className="story-card-title">{story.title}</h3>
                            <p className="story-description">{story.description}</p>
                            
                            <div className="story-stats">
                                {story.stats.map((stat, idx) => (
                                    <div key={idx} className="story-stat-pill">
                                        {stat}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="story-connector"></div>
                    </motion.div>
                ))}
            </div>
        </section>
    );
}
