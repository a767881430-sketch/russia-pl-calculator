import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/authClient.jsx";
import { findProjectByLegacyFile } from "../lib/cloudProjects.js";
import { findLegacyPublicProjectByFile } from "../lib/legacyProjects.js";

function normalizeRedirectTarget(target = "/") {
  if (!target) return "/";
  if (!target.startsWith("/")) return `/${target}`;
  return target;
}

export default function RootEntryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();

  useEffect(() => {
    if (auth.loading) return;

    const searchParams = new URLSearchParams(location.search);
    const redirectTarget = searchParams.get("redirect");
    if (redirectTarget) {
      navigate(normalizeRedirectTarget(decodeURIComponent(redirectTarget)), { replace: true });
      return;
    }

    if (location.hash?.startsWith("#share=")) {
      navigate(`/share/embedded?payload=${encodeURIComponent(location.hash.slice(7))}`, { replace: true });
      return;
    }

    const legacyProjectFile = searchParams.get("project");
    if (legacyProjectFile) {
      if (auth.session && auth.workspaceId) {
        findProjectByLegacyFile(auth.workspaceId, legacyProjectFile)
          .then((cloudProject) => {
            if (cloudProject?.id) {
              navigate(`/app/projects/${cloudProject.id}`, { replace: true });
              return;
            }

            const legacyMeta = findLegacyPublicProjectByFile(legacyProjectFile);
            if (legacyMeta?.slug) {
              navigate(`/p/${legacyMeta.slug}`, { replace: true });
            } else {
              navigate(`/legacy?project=${encodeURIComponent(legacyProjectFile)}`, { replace: true });
            }
          })
          .catch(() => {
            const legacyMeta = findLegacyPublicProjectByFile(legacyProjectFile);
            if (legacyMeta?.slug) {
              navigate(`/p/${legacyMeta.slug}`, { replace: true });
            } else {
              navigate(`/legacy?project=${encodeURIComponent(legacyProjectFile)}`, { replace: true });
            }
          });
        return;
      }

      const legacyMeta = findLegacyPublicProjectByFile(legacyProjectFile);
      if (legacyMeta?.slug) {
        navigate(`/p/${legacyMeta.slug}`, { replace: true });
      } else {
        navigate(`/legacy?project=${encodeURIComponent(legacyProjectFile)}`, { replace: true });
      }
      return;
    }

    navigate(auth.session ? "/app/projects" : "/login", { replace: true });
  }, [auth.loading, auth.session, location.hash, location.search, navigate]);

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-slate-900 flex items-center justify-center">
      <div className="text-sm text-slate-600">正在跳转到正确入口...</div>
    </div>
  );
}
