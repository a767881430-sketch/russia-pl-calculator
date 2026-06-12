import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import CalculatorApp from "../App.jsx";
import { getShareSnapshotByToken, unlockShareSnapshot } from "../lib/cloudProjects.js";

const SHARE_ACCESS_PREFIX = "pl_share_access:";

function readSavedAccessCode(token) {
  try {
    return sessionStorage.getItem(`${SHARE_ACCESS_PREFIX}${token}`) || "";
  } catch {
    return "";
  }
}

function saveAccessCode(token, code) {
  try {
    sessionStorage.setItem(`${SHARE_ACCESS_PREFIX}${token}`, code);
  } catch {
    // ignore
  }
}

function ShareAccessGate({ token, onUnlocked }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await unlockShareSnapshot(token, code);
      saveAccessCode(token, code);
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
          <div className="text-lg font-semibold text-slate-900">请输入分享访问码</div>
          <p className="mt-3 text-sm leading-6 text-slate-600">这是固定快照，只读查看。访问码正确后才能打开。</p>
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
            {submitting ? "正在验证..." : "进入分享快照"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ShareSnapshotPage() {
  const { token } = useParams();
  const [state, setState] = useState({ loading: true, error: "", payload: null });
  const [accessCode, setAccessCode] = useState(() => readSavedAccessCode(token));

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState({ loading: true, error: "", payload: null });
      try {
        const snapshot = await getShareSnapshotByToken(token, accessCode);
        if (snapshot?.locked && !cancelled) {
          setState({ loading: false, error: "", payload: { locked: true } });
          return;
        }
        if (!snapshot) {
          throw new Error("这个临时分享链接已经过期，或者 token 不存在。");
        }

        if (!cancelled) {
          setState({
            loading: false,
            error: "",
            payload: {
              title: snapshot.data.projectName || "临时快照",
              description: "这是某一个时点冻结下来的只读快照，后续草稿更新不会改变这里。",
              data: snapshot.data,
              updatedAt: snapshot.createdAt,
              sourceLabel: "临时分享快照",
            },
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            loading: false,
            error: error.message || "分享快照加载失败",
            payload: null,
          });
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token, accessCode]);

  if (state.loading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] text-slate-900 flex items-center justify-center">
        <div className="text-sm text-slate-600 flex items-center">
          <LoaderCircle size={18} className="mr-2 animate-spin" />
          正在加载临时分享快照...
        </div>
      </div>
    );
  }

  if (state.payload?.locked) {
    return <ShareAccessGate token={token} onUnlocked={setAccessCode} />;
  }

  if (state.error || !state.payload?.data) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] text-slate-900">
        <div className="mx-auto max-w-[960px] px-4 py-10 sm:px-6 lg:px-8">
          <div className="rounded-md border border-[#D9CFB8] bg-white px-6 py-8">
            <div className="text-lg font-semibold text-slate-900">临时分享链接没打开成功</div>
            <p className="mt-3 text-sm leading-6 text-slate-600">{state.error}</p>
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
      initialDataVersion={`snapshot:${token}:${state.payload.updatedAt || ""}`}
      readOnly
      sourceLabel={state.payload.sourceLabel}
    />
  );
}
