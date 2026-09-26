
import featureAI from "@/assets/feature-ai.jpg";
import featureAnalytics from "@/assets/feature-analytics.jpg";
import featureBranding from "@/assets/feature-branding.jpg";
import featurePerformance from "@/assets/feature-performance.jpg";
import FeatureCard from "./FeatureCard";
import { Link } from "react-router-dom";
import path from "path";

const features = [
  {
    image: featureAI,
    title: "AI-Powered Hiring",
    description: "Let machine learning match you with the best candidates faster than ever before.",
    path: '/employers/ai-hiring' // Link to the AI hiring landing page
  },
  {
    image: featureAnalytics,
    title: "Advanced Analytics",
    description: "Track your hiring metrics and optimize your recruitment pipeline with real-time data.",
    path: '/employers/advanced-analytics' // Link to the advanced analytics landing page
  },
  {
    image: featureBranding,
    title: "Employer Branding Hub",
    description: "Build and showcase your company culture to attract top talent.",
    path: '/employers/branding' // Link to the employer branding landing page
  },
  {
    image: featurePerformance,
    title: "Performance Boost",
    description: "Accelerate your hiring process with streamlined workflows and automation.",
    path: '/employers/performance' // Link to the performance landing page
  
  },
];

const FeatureGrid = () => {
  return (
    <section className="container mx-auto px-4 md:px-12 lg:px-24 py-20">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Everything you need to hire better
        </h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
       {features.map((feature) => (
          <Link key={feature.title} to={feature.path}>
               <FeatureCard {...feature} />
              </Link>
          ))}
      </div>
    </section>
  );
};

export default FeatureGrid;
