import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import CalculatorApp from "../App.jsx";
import { parseEmbeddedSharePayload } from "../lib/projectData.js";

export default function EmbeddedSharePage() {
  const location = useLocation();
  const [state, setState] = useState({ loading: true, error: "", payload: null });

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(location.search);
    const payload = params.get("payload");

    async function load() {
      setState({ loading: true, error: "", payload: null });
      if (!payload) {
        setState({ loading: false, error: "分享 payload 为空。", payload: null });
        return;
      }

      try {
        const data = await parseEmbeddedSharePayload(payload);
        if (!cancelled) {
          setState({
            loading: false,
            error: "",
            payload: {
              title: data.projectName || "旧版分享链接",
              description: "这是从旧版 #share= 链接自动转过来的只读查看页。",
              data,
              updatedAt: null,
              sourceLabel: "旧版嵌入式分享链接",
            },
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            loading: false,
            error: error.message || "旧版分享链接解析失败",
            payload: null,
          });
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [location.search]);

  if (state.loading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] text-slate-900 flex items-center justify-center">
        <div className="text-sm text-slate-600 flex items-center">
          <LoaderCircle size={18} className="mr-2 animate-spin" />
          正在转换旧版分享链接...
        </div>
      </div>
    );
  }

  if (state.error || !state.payload?.data) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] text-slate-900">
        <div className="mx-auto max-w-[960px] px-4 py-10 sm:px-6 lg:px-8">
          <div className="rounded-md border border-[#D9CFB8] bg-white px-6 py-8">
            <div className="text-lg font-semibold text-slate-900">旧版分享链接没转换成功</div>
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
      initialDataVersion={`embedded:${location.search}`}
      readOnly
      sourceLabel={state.payload.sourceLabel}
    />
  );
}
