import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import CalculatorApp from "../App.jsx";
import { absoluteAppUrl } from "../lib/appUrls.js";
import { copyText } from "../lib/browserUtils.js";
import { getProjectById, listProjects, publishProject, saveProjectDraft } from "../lib/cloudProjects.js";
import { slugifyProjectName } from "../lib/projectData.js";
import { useAuth } from "../lib/authClient.jsx";

function LoadingProject() {
  return (
    <div className="min-h-screen bg-[#FAF7F2] text-slate-900 flex items-center justify-center">
      <div className="text-sm text-slate-600 flex items-center">
        <LoaderCircle size={18} className="mr-2 animate-spin" />
        正在打开后台项目...
      </div>
    </div>
  );
}

function ProjectLoadError() {
  return (
    <div className="min-h-screen bg-[#FAF7F2] text-slate-900">
      <div className="mx-auto max-w-[960px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-md border border-[#D9CFB8] bg-white px-6 py-8">
          <div className="text-lg font-semibold text-slate-900">这个后台项目暂时没打开成功</div>
          <p className="mt-3 text-sm leading-6 text-slate-600">可能项目不存在，或者当前账号还没有权限。</p>
          <Link to="/app/projects" className="mt-5 inline-flex items-center gap-2 rounded-md bg-[#5C1A1B] px-4 py-2 text-sm text-white">
            <ArrowLeft size={16} />
            返回项目库
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ProjectEditorPage() {
  const { projectId } = useParams();
  const auth = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadProjectBundle() {
    setLoading(true);
    setError("");

    try {
      const [current, allProjects] = await Promise.all([
        getProjectById(projectId),
        listProjects({ workspaceId: auth.workspaceId }),
      ]);

      if (!current) {
        setProject(null);
        setError("not-found");
        return;
      }

      setProject(current);
      setProjects(allProjects);
    } catch (loadError) {
      console.error("Failed to load project:", loadError);
      setProject(null);
      setError(loadError?.message || "load-failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProjectBundle();
  }, [projectId, auth.workspaceId]);

  function updateProjectState(nextProject) {
    setProject(nextProject);
    setProjects((items) => {
      const exists = items.some((item) => item.id === nextProject.id);
      const nextItems = exists
        ? items.map((item) => (item.id === nextProject.id ? nextProject : item))
        : [nextProject, ...items];
      return nextItems.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    });
  }

  async function saveCurrentProject({ name, data }, force = false) {
    if (!project) return { message: "项目还没加载完成" };
    if (auth.workspaceRole === "reader") {
      return { message: "当前是只读成员，不能保存修改。" };
    }

    if (project.visibility === "public") {
      return publishAndCopyLink({ name, data }, force, { copyLink: false });
    }

    const result = await saveProjectDraft({
      projectId: project.id,
      workspaceId: auth.workspaceId,
      userId: auth.user?.id || "demo-user-admin",
      name,
      description: project.description,
      data,
      expectedUpdatedAt: project.updatedAt,
      force,
    });

    if (result.conflict) {
      const confirmOverwrite = window.confirm("这个项目已经被别人更新过。继续覆盖保存，就以你这次保存为准。要继续吗？");
      if (!confirmOverwrite) return { message: "已取消保存" };
      return saveCurrentProject({ name, data }, true);
    }

    updateProjectState(result.project);
    return {
      name: result.project.name,
      message: "已保存到服务器",
    };
  }

  async function publishAndCopyLink({ name, data }, force = false, options = {}) {
    if (!project) return { message: "项目还没加载完成" };
    if (auth.workspaceRole === "reader") {
      return { message: "当前是只读成员，不能发布公开链接。" };
    }

    let accessCode;
    if (!project.hasAccessCode && options.askAccessCode !== false) {
      accessCode = window.prompt("请设置客户访问码。客户打开公开链接时需要输入这个码。", "xhk2026");
      if (accessCode === null) return { message: "已取消发布" };
    }

    const result = await publishProject({
      projectId: project.id,
      workspaceId: auth.workspaceId,
      userId: auth.user?.id || "demo-user-admin",
      name,
      description: project.description,
      slug: project.slug || slugifyProjectName(name || data?.projectName || "public-project"),
      data,
      expectedUpdatedAt: project.updatedAt,
      force,
      accessCode,
    });

    if (result.conflict) {
      const confirmOverwrite = window.confirm("发布前发现项目已经被别人改过。继续发布就以你当前这份为准。还要继续吗？");
      if (!confirmOverwrite) return { message: "已取消发布" };
      return publishAndCopyLink({ name, data }, true);
    }

    updateProjectState(result.project);
    if (options.copyLink !== false) {
      await copyText(absoluteAppUrl(`/p/${result.project.slug}`));
    }

    return {
      name: result.project.name,
      message: options.copyLink === false ? "已保存并更新公开链接内容" : "公开链接已复制，别人打开就是只读版",
    };
  }

  if (loading) return <LoadingProject />;
  if (error || !project) return <ProjectLoadError />;

  return (
    <CalculatorApp
      initialData={project.currentData}
      initialProjectName={project.name || project.currentData?.projectName || "未命名项目"}
      initialDataVersion={`${project.id}:${project.updatedAt || ""}`}
      cloudMode
      cloudProjects={projects}
      currentCloudProjectId={project.id}
      onCloudProjectChange={(nextProjectId) => {
        if (nextProjectId && nextProjectId !== project.id) {
          navigate(`/app/projects/${nextProjectId}`);
        }
      }}
      onCloudSave={saveCurrentProject}
      onCloudShare={publishAndCopyLink}
      onCloudOpenLibrary={() => navigate("/app/projects")}
      sourceLabel="后台项目工作台"
    />
  );
}
