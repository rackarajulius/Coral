import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import heroImage from "@/assets/hero-workplace.jpg";

const Hero = () => {
  return (
    <section
      // Full-bleed to the right edge: a negative right margin equal to the
      // reserved scrollbar gutter (100vw − 100%) widens the section past the
      // gutter so the image reaches the true viewport edge.
      className="relative min-h-[85vh] flex items-center justify-center mr-[calc(100%_-_100vw)]"
      style={{
        backgroundImage: `url(${heroImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Dark gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/50 to-transparent" />
      
      {/* Content */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 py-32">
        <div className="max-w-3xl">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-medium tracking-tight text-white leading-tight mb-8">
            Turn Your Company into a Destination Candidates Want
          </h1>
          <p className="text-lg md:text-xl text-white/80 mb-10 max-w-2xl">
            Build your employer brand, attract top talent, and streamline your hiring process with CareerConnect's powerful platform.
          </p>
          <div className="flex flex-wrap gap-4">
            <Button
              size="lg"
              className="bg-white text-gray-900 hover:bg-white/90 font-medium px-8 rounded-full"
              asChild
            >
              <Link to="/employers/dashboard">Get started free</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white text-white bg-transparent hover:bg-white/10 font-medium px-8 rounded-full"
              asChild
            >
              <Link to="/employers/jobs/post">Post a Job</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
