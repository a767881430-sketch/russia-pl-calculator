import { useEffect, useState } from "react";
import { BookOpen, LockKeyhole, LogIn } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/authClient.jsx";
import { withBase } from "../lib/appUrls.js";

export default function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("change-this-password");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (auth.loading) return;
    if (auth.session) {
      const target = location.state?.from || "/app/projects";
      navigate(target, { replace: true });
    }
  }, [auth.loading, auth.session, location.state, navigate]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const { error: signInError } = await auth.signInWithPassword({
      email: username,
      password,
    });

    if (signInError) {
      setError(signInError.message || "登录失败，请检查账号或密码。");
      setSubmitting(false);
      return;
    }

    const target = location.state?.from || "/app/projects";
    navigate(target, { replace: true });
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-slate-900">
      <div className="mx-auto grid min-h-screen max-w-[1280px] gap-0 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="flex items-center border-b border-[#D9CFB8] px-6 py-10 lg:border-b-0 lg:border-r lg:px-10">
          <div className="max-w-[620px] space-y-8">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm text-[#5C1A1B] ring-1 ring-[#D9CFB8]">
                <LockKeyhole size={16} />
                独立客户版
              </div>
              <h1 className="text-4xl font-semibold tracking-normal text-slate-900 sm:text-5xl">
                俄罗斯项目损益测算系统
              </h1>
              <p className="max-w-[560px] text-base leading-8 text-slate-600">
                后台用于维护项目、保存测算、发布客户只读链接。客户老板和供应商打开公开链接时，只需要输入访问码即可查看完整测算，不能编辑或保存。
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-md border border-[#D9CFB8] bg-white px-4 py-4">
                <div className="text-sm font-medium text-slate-900">给老板</div>
                <div className="mt-2 text-sm leading-6 text-slate-600">看回本、利润、现金流和关键风险。</div>
              </div>
              <div className="rounded-md border border-[#D9CFB8] bg-white px-4 py-4">
                <div className="text-sm font-medium text-slate-900">给供应商</div>
                <div className="mt-2 text-sm leading-6 text-slate-600">看统一报价口径、销售单位和申报价。</div>
              </div>
              <div className="rounded-md border border-[#D9CFB8] bg-white px-4 py-4">
                <div className="text-sm font-medium text-slate-900">给运营新人</div>
                <div className="mt-2 text-sm leading-6 text-slate-600">从排期、扣费和现金流理解项目。</div>
              </div>
            </div>

            <div className="rounded-md border border-[#D9CFB8] bg-[#FFFDF9] px-5 py-4 text-sm leading-7 text-slate-600">
              <p>
                正式部署时，网页、后端和数据库都在你的阿里云体系内运行。上线前请把 `.env` 里的管理员密码和 `JWT_SECRET` 改成强密码。
              </p>
            </div>
          </div>
        </section>

        <section className="flex items-center px-6 py-10 lg:px-10">
          <div className="w-full max-w-[460px] rounded-md border border-[#D9CFB8] bg-white px-6 py-6 shadow-sm">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-normal">后台登录</h2>
              <p className="text-sm leading-6 text-slate-600">
                登录后可以进入项目库，新建、保存、发布项目，并设置客户访问码。
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">账号</span>
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="w-full rounded-md border border-[#D9CFB8] bg-[#FFFDF9] px-3 py-3 text-sm text-slate-900 outline-none focus:border-[#5C1A1B]"
                  placeholder="admin"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">密码</span>
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-md border border-[#D9CFB8] bg-[#FFFDF9] px-3 py-3 text-sm text-slate-900 outline-none focus:border-[#5C1A1B]"
                  placeholder="请输入密码"
                  type="password"
                />
              </label>

              {error ? <div className="rounded-md bg-[#FDF2F2] px-3 py-3 text-sm text-[#A4193D]">{error}</div> : null}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#5C1A1B] px-4 py-3 text-sm font-medium text-white hover:bg-[#6F2425] disabled:opacity-60"
              >
                <LogIn size={16} />
                {submitting ? "正在登录..." : "进入项目后台"}
              </button>
            </form>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={withBase("/usage-guide.html")}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-md border border-[#D9CFB8] px-3 py-2 text-sm text-slate-700 hover:bg-[#F7F1E8]"
              >
                <BookOpen size={16} />
                查看使用说明
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
