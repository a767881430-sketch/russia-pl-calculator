import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Copy, FilePlus2, FolderOpen, Globe2, KeyRound, LoaderCircle, Lock, Radio } from "lucide-react";
import AppLayout from "../components/AppLayout.jsx";
import { absoluteAppUrl } from "../lib/appUrls.js";
import { copyText } from "../lib/browserUtils.js";
import { createProject, createShareSnapshot, listProjects, seedLegacyProjects, updateProjectAccessCode } from "../lib/cloudProjects.js";
import { formatDateTime } from "../lib/formatters.js";
import { useAuth } from "../lib/authClient.jsx";

const FILTERS = [
  { id: "all", label: "全部项目" },
  { id: "mine", label: "我创建的" },
  { id: "public", label: "已公开" },
  { id: "private", label: "私有/草稿" },
  { id: "archived", label: "归档" },
];

function visibilityLabel(project) {
  if (project.status === "archived") return "已归档";
  return project.visibility === "public" ? "公开" : "私有";
}

export default function ProjectsPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [filter, setFilter] = useState("all");
  const [message, setMessage] = useState("");

  async function refreshProjects() {
    setLoading(true);
    try {
      let nextProjects = await listProjects();
      if (nextProjects.length === 0 && auth.workspaceRole !== "reader") {
        await seedLegacyProjects();
        nextProjects = await listProjects();
      }
      setProjects(nextProjects);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshProjects();
  }, [auth.workspaceRole]);

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      if (filter === "all") return true;
      if (filter === "mine") return project.createdBy === auth.user?.username || project.createdBy === auth.user?.id;
      if (filter === "public") return project.visibility === "public";
      if (filter === "private") return project.visibility !== "public" && project.status !== "archived";
      if (filter === "archived") return project.status === "archived";
      return true;
    });
  }, [auth.user?.id, auth.user?.username, filter, projects]);

  async function handleCreateProject() {
    const name = window.prompt("请输入新项目名称", `新项目 ${new Date().toLocaleDateString("zh-CN")}`);
    if (!name?.trim()) return;

    const created = await createProject({ name });
    navigate(`/app/projects/${created.id}`);
  }

  async function handleCopyPublicLink(project) {
    if (!project.slug) return;
    await copyText(absoluteAppUrl(`/p/${project.slug}`));
    setMessage(`已复制公开链接：${project.name}`);
    setTimeout(() => setMessage(""), 2400);
  }

  async function handleCopySnapshot(project) {
    setBusyId(project.id);
    try {
      const accessCode = window.prompt("请设置临时分享访问码。留空则不设置访问码。", "xhk2026");
      if (accessCode === null) return;
      const share = await createShareSnapshot({
        projectId: project.id,
        data: project.currentData,
        accessCode,
      });
      await copyText(absoluteAppUrl(`/share/${share.token}`));
      setMessage(`已复制临时快照链接：${project.name}`);
      setTimeout(() => setMessage(""), 2400);
    } finally {
      setBusyId("");
    }
  }

  async function handleResetAccessCode(project) {
    const accessCode = window.prompt("请输入新的客户访问码。留空会取消访问码，不建议公开项目这样做。", "xhk2026");
    if (accessCode === null) return;
    setBusyId(project.id);
    try {
      const updated = await updateProjectAccessCode(project.id, accessCode);
      setProjects((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      setMessage(accessCode.trim() ? `已更新访问码：${project.name}` : `已取消访问码：${project.name}`);
      setTimeout(() => setMessage(""), 2400);
    } finally {
      setBusyId("");
    }
  }

  const actions = (
    <>
      {message ? <div className="rounded-md bg-white px-3 py-2 text-sm text-[#5C1A1B] ring-1 ring-[#D9CFB8]">{message}</div> : null}
      <button
        type="button"
        onClick={handleCreateProject}
        className="inline-flex items-center gap-2 rounded-md bg-[#5C1A1B] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#6F2425]"
      >
        <FilePlus2 size={16} />
        新建项目
      </button>
    </>
  );

  return (
    <AppLayout
      title="项目库"
      subtitle="这里管理客户版项目、公开只读链接和临时分享快照。客户打开公开页时需要访问码，只能查看不能编辑。"
      actions={actions}
    >
      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-md border border-[#D9CFB8] bg-white px-5 py-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-normal">客户版项目</h2>
              <p className="mt-1 text-sm text-slate-600">
                当前保留原公式和 JSON 口径，项目数据由独立后端数据库保存。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className={`rounded-md px-3 py-2 text-sm ${
                    filter === item.id ? "bg-[#5C1A1B] text-white" : "bg-[#F7F1E8] text-slate-700"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-sm text-slate-500">
                <LoaderCircle size={18} className="mr-2 animate-spin" />
                正在加载项目库...
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="rounded-md border border-dashed border-[#D9CFB8] bg-[#FFFDF9] px-5 py-12 text-center text-sm text-slate-500">
                当前筛选下还没有项目，先新建一个项目。
              </div>
            ) : (
              filteredProjects.map((project) => (
                <article key={project.id} className="rounded-md border border-[#E9DECA] bg-[#FFFDF9] px-4 py-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold tracking-normal text-slate-900">{project.name}</h3>
                        <span className={`rounded-full px-2.5 py-1 text-xs ${
                          project.visibility === "public" ? "bg-[#E8F4EC] text-[#1F4F2E]" : "bg-[#F2EDE3] text-slate-700"
                        }`}>
                          {visibilityLabel(project)}
                        </span>
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-500 ring-1 ring-[#D9CFB8]">
                          {project.slug || "未发布 slug"}
                        </span>
                        <span className={`rounded-full px-2.5 py-1 text-xs ${
                          project.hasAccessCode ? "bg-[#EEF8F1] text-[#1F4F2E]" : "bg-[#FFF4E5] text-[#9A5A00]"
                        }`}>
                          {project.hasAccessCode ? "已设置访问码" : "未设置访问码"}
                        </span>
                      </div>
                      <p className="text-sm leading-6 text-slate-600">
                        {project.description || "还没写项目说明。建议写清楚对外说明、供应商备注和老板重点看什么。"}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span>最后修改时间：{formatDateTime(project.updatedAt)}</span>
                        <span>最后修改人：{project.updatedBy || "未记录"}</span>
                        <span>项目类型：{project.legacyFilePath ? "旧公开项目迁移" : "客户版项目"}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/app/projects/${project.id}`}
                        className="inline-flex items-center gap-2 rounded-md bg-[#5C1A1B] px-3 py-2 text-sm font-medium text-white hover:bg-[#6F2425]"
                      >
                        <FolderOpen size={16} />
                        打开项目
                      </Link>

                      {project.visibility === "public" ? (
                        <>
                          <Link
                            to={`/p/${project.slug}`}
                            className="inline-flex items-center gap-2 rounded-md border border-[#1F4F2E] px-3 py-2 text-sm text-[#1F4F2E] hover:bg-[#EEF8F1]"
                          >
                            <Globe2 size={16} />
                            查看公开页
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleCopyPublicLink(project)}
                            className="inline-flex items-center gap-2 rounded-md border border-[#D9CFB8] px-3 py-2 text-sm text-slate-700 hover:bg-white"
                          >
                            <Copy size={16} />
                            复制公开链接
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResetAccessCode(project)}
                            disabled={busyId === project.id}
                            className="inline-flex items-center gap-2 rounded-md border border-[#D9CFB8] px-3 py-2 text-sm text-slate-700 hover:bg-white disabled:opacity-60"
                          >
                            <KeyRound size={16} />
                            重置访问码
                          </button>
                        </>
                      ) : (
                        <div className="inline-flex items-center gap-2 rounded-md bg-[#F2EDE3] px-3 py-2 text-sm text-slate-600">
                          <Lock size={16} />
                          还没发布公开链接
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => handleCopySnapshot(project)}
                        disabled={busyId === project.id}
                        className="inline-flex items-center gap-2 rounded-md border border-[#D9CFB8] px-3 py-2 text-sm text-slate-700 hover:bg-white disabled:opacity-60"
                      >
                        {busyId === project.id ? <LoaderCircle size={16} className="animate-spin" /> : <Radio size={16} />}
                        复制临时快照
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <section className="rounded-md border border-[#D9CFB8] bg-white px-5 py-5">
            <h2 className="text-lg font-semibold tracking-normal">怎么给客户看</h2>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <p>1. 内部账号在这里打开项目、修改数据并保存。</p>
              <p>2. 发布后复制公开链接，客户输入访问码即可查看完整只读页。</p>
              <p>3. 临时快照适合发某个固定版本，后续草稿修改不会影响它。</p>
            </div>
          </section>

          <section className="rounded-md border border-[#D9CFB8] bg-white px-5 py-5">
            <h2 className="text-lg font-semibold tracking-normal">权限提醒</h2>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <p><strong className="text-slate-900">管理员：</strong>可以新建、保存、发布、设置访问码。</p>
              <p><strong className="text-slate-900">客户：</strong>只打开公开页或快照页，不能进入后台。</p>
              <p><strong className="text-slate-900">上线前：</strong>请修改 `.env` 里的管理员密码和 JWT_SECRET。</p>
            </div>
          </section>
        </aside>
      </section>
    </AppLayout>
  );
}
