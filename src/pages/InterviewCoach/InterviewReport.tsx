import { Navigate, useParams } from "react-router-dom";

/**
 * The report is now a drawer on the history page. This route stays so existing
 * links keep resolving — deep links, the home activity list, and the redirect
 * after a session ends — by handing the id to history, which opens the drawer.
 */
export default function InterviewReport() {
  const { id } = useParams<{ id: string }>();

  return (
    <Navigate
      to={
        id
          ? `/interview-prep/history?report=${encodeURIComponent(id)}`
          : "/interview-prep/history"
      }
      replace
    />
  );
}
