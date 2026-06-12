import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/authClient.jsx";

export default function RequireAuth({ children }) {
  const auth = useAuth();
  const location = useLocation();

  if (auth.loading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] text-slate-900 flex items-center justify-center">
        <div className="text-sm text-slate-600">正在检查登录状态...</div>
      </div>
    );
  }

  if (!auth.session) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}${location.hash}` }} />;
  }

  return children;
}
