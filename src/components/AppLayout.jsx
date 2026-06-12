import { Link, NavLink, useNavigate } from "react-router-dom";
import { FolderKanban, Globe2, LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "../lib/authClient.jsx";

function navClass({ isActive }) {
  return [
    "px-3 py-2 text-sm rounded-md transition-colors",
    isActive ? "bg-[#5C1A1B] text-white" : "text-slate-700 hover:bg-white",
  ].join(" ");
}

export default function AppLayout({ title, subtitle, actions, children }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const displayName = auth.user?.user_metadata?.display_name || auth.user?.email || auth.user?.username || "未登录成员";

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-slate-900">
      <header className="border-b border-[#D9CFB8] bg-[#F7F1E8]">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <Link to="/app/projects" className="inline-flex items-center gap-2 text-[#5C1A1B]">
                <ShieldCheck size={18} />
                <span className="text-sm font-medium">俄罗斯项目损益测算系统</span>
              </Link>
              <div>
                <h1 className="text-2xl font-semibold tracking-normal">{title}</h1>
                {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {actions}
              <div className="flex items-center gap-2 rounded-md border border-[#D9CFB8] bg-white px-3 py-2 text-sm text-slate-700">
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                <span>{displayName}</span>
                <span className="text-slate-400">/</span>
                <span>{auth.workspaceRole}</span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await auth.signOut();
                  navigate("/login", { replace: true });
                }}
                className="inline-flex items-center gap-2 rounded-md border border-[#D9CFB8] bg-white px-3 py-2 text-sm text-slate-700 hover:bg-[#F2EDE3]"
              >
                <LogOut size={16} />
                退出
              </button>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-2">
            <NavLink to="/app/projects" end className={navClass}>
              <span className="inline-flex items-center gap-2">
                <FolderKanban size={16} />
                项目库
              </span>
            </NavLink>
            <NavLink to="/p/xiongwei-chuanqi" className={navClass}>
              <span className="inline-flex items-center gap-2">
                <Globe2 size={16} />
                公开示例页
              </span>
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
