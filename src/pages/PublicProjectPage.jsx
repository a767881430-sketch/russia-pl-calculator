import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import CalculatorApp from "../App.jsx";
import { getProjectBySlug, unlockPublicProject } from "../lib/cloudProjects.js";
import { loadLegacyProjectBySlug } from "../lib/legacyData.js";

const PUBLIC_ACCESS_PREFIX = "pl_public_access:";

function readSavedAccessCode(slug) {
  try {
    return sessionStorage.getItem(`${PUBLIC_ACCESS_PREFIX}${slug}`) || "";
  } catch {
    return "";
  }
}

function saveAccessCode(slug, code) {
  try {
    sessionStorage.setItem(`${PUBLIC_ACCESS_PREFIX}${slug}`, code);
  } catch {
    // ignore
  }
}

function AccessCodeGate({ slug, onUnlocked }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await unlockPublicProject(slug, code);
      saveAccessCode(slug, code);
      onUnlocked(code);
    } catch (unlockError) {
      setError(unlockError?.message || "访问码不正确");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[720px] items-center px-4 py-10 sm:px-6">
        <form onSubmit={submit} className="w-full rounded-md border border-[#D9CFB8] bg-white px-6 py-8 shadow-sm">
          <div className="text-lg font-semibold text-slate-900">请输入客户访问码</div>
          <p className="mt-3 text-sm leading-6 text-slate-600">这个项目是完整只读测算页。输入访问码后可以查看，不能编辑或保存。</p>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="mt-5 w-full rounded-md border border-[#D9CFB8] bg-[#FFFDF9] px-3 py-3 text-sm outline-none focus:border-[#5C1A1B]"
            placeholder="请输入访问码"
            autoFocus
          />
          {error ? <div className="mt-3 rounded-md bg-[#FDF2F2] px-3 py-3 text-sm text-[#A4193D]">{error}</div> : null}
          <button
            type="submit"
            disabled={submitting || !code.trim()}
            className="mt-5 inline-flex w-full items-center justify-center rounded-md bg-[#5C1A1B] px-4 py-3 text-sm font-medium text-white hover:bg-[#6F2425] disabled:opacity-60"
          >
            {submitting ? "正在验证..." : "进入只读项目"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function PublicProjectPage() {
  const { slug } = useParams();
  const [state, setState] = useState({ loading: true, error: "", payload: null });
  const [accessCode, setAccessCode] = useState(() => readSavedAccessCode(slug));

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState({ loading: true, error: "", payload: null });
      try {
        const project = await getProjectBySlug(slug, accessCode);
        if (project?.locked && !cancelled) {
          setState({ loading: false, error: "", payload: { locked: true } });
          return;
        }
        if (project?.publishedData && !cancelled) {
          setState({
            loading: false,
            error: "",
            payload: {
              title: project.name,
              description: project.description,
              data: project.publishedData,
              updatedAt: project.updatedAt,
              legacyFilePath: project.legacyFilePath || "",
              sourceLabel: "公开项目最新发布版",
            },
          });
          return;
        }

        const legacy = await loadLegacyProjectBySlug(slug);
        if (!cancelled) {
          setState({
            loading: false,
            error: "",
            payload: {
              title: legacy?.data?.projectName || legacy?.meta?.name || "公开项目",
              description: legacy?.meta?.desc || "",
              data: legacy?.data,
              updatedAt: null,
              cloudProjectId: "",
              legacyFilePath: legacy?.file || legacy?.meta?.file || "",
              sourceLabel: "旧静态公开项目（兼容入口）",
            },
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            loading: false,
            error: error.message || "公开项目加载失败",
            payload: null,
          });
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [slug, accessCode]);

  if (state.loading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] text-slate-900 flex items-center justify-center">
        <div className="text-sm text-slate-600 flex items-center">
          <LoaderCircle size={18} className="mr-2 animate-spin" />
          正在加载公开项目...
        </div>
      </div>
    );
  }

  if (state.payload?.locked) {
    return <AccessCodeGate slug={slug} onUnlocked={setAccessCode} />;
  }

  if (state.error || !state.payload?.data) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] text-slate-900">
        <div className="mx-auto max-w-[960px] px-4 py-10 sm:px-6 lg:px-8">
          <div className="rounded-md border border-[#D9CFB8] bg-white px-6 py-8">
            <div className="text-lg font-semibold text-slate-900">这个公开项目暂时没打开成功</div>
            <p className="mt-3 text-sm leading-6 text-slate-600">{state.error || "可能还没发布，或者 slug 写错了。"}</p>
            <Link to="/login" className="mt-5 inline-flex items-center gap-2 rounded-md bg-[#5C1A1B] px-4 py-2 text-sm text-white">
              <ArrowLeft size={16} />
              返回登录页
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <CalculatorApp
      initialData={state.payload.data}
      initialProjectName={state.payload.title}
      initialDataVersion={`${slug}:${state.payload.updatedAt || "legacy"}`}
      readOnly
      sourceLabel={state.payload.sourceLabel}
      cloudEditHref=""
      editCopyHref=""
    />
  );
}
