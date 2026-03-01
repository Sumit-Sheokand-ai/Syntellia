import ThreeBackground from '../components/ThreeBackground';
import Hero from '../components/Hero';
import ToolsGrid from '../components/ToolsGrid';
import StorySection from '../components/StorySection';
import FeaturesShowcase from '../components/FeaturesShowcase';

export default function Home() {
    return (
        <>
            <ThreeBackground />
            <div className="home-container">
                <Hero />
                <StorySection />
                <ToolsGrid />
                <FeaturesShowcase />
            </div>
        </>
    );
}
