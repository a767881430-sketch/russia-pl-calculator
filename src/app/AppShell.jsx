import { Route, Routes } from "react-router-dom";
import RequireAuth from "../components/RequireAuth.jsx";
import EmbeddedSharePage from "../pages/EmbeddedSharePage.jsx";
import LegacyStandalonePage from "../pages/LegacyStandalonePage.jsx";
import LoginPage from "../pages/LoginPage.jsx";
import ProjectEditorPage from "../pages/ProjectEditorPage.jsx";
import ProjectsPage from "../pages/ProjectsPage.jsx";
import PublicProjectPage from "../pages/PublicProjectPage.jsx";
import RootEntryPage from "../pages/RootEntryPage.jsx";
import ShareSnapshotPage from "../pages/ShareSnapshotPage.jsx";

export default function AppShell() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/legacy" element={<LegacyStandalonePage />} />
      <Route path="/p/:slug" element={<PublicProjectPage />} />
      <Route path="/share/embedded" element={<EmbeddedSharePage />} />
      <Route path="/share/:token" element={<ShareSnapshotPage />} />
      <Route
        path="/app/projects"
        element={(
          <RequireAuth>
            <ProjectsPage />
          </RequireAuth>
        )}
      />
      <Route
        path="/app/projects/:projectId"
        element={(
          <RequireAuth>
            <ProjectEditorPage />
          </RequireAuth>
        )}
      />
      <Route path="*" element={<RootEntryPage />} />
    </Routes>
  );
}
