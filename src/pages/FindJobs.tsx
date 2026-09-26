import Header from "@/components/Header";
import JobListings from "@/components/jobs/JobListings";

const FindJobs = () => {
  return (
    <div className="min-h-screen bg-card">
      <Header />
      <main className="pt-16">
        <JobListings />
      </main>
      {/* No global footer - internal footer is inside left panel only */}
    </div>
  );
};

export default FindJobs;
