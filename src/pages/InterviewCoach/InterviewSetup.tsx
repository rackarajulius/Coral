import { useEffect } from "react";
import { useInterviewSetupStore } from "@/stores/interviewSetupStore";
import CoachHome from "./CoachHome";

/**
 * The setup wizard is a modal now — this route just renders the coach home
 * with the wizard opened, so deep links to /setup keep working.
 */
export default function InterviewSetup() {
  const openModal = useInterviewSetupStore((s) => s.openModal);

  useEffect(() => {
    openModal();
  }, [openModal]);

  return <CoachHome />;
}
