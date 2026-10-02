import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Settings from "./Settings";
import { MeetingOverview, SourceCards } from "./MeetingInsights";
import { readableReferences } from "./insightContent";
import { useSpeechPlayback } from "./useSpeechPlayback";
import { isHuman } from "./speechPlayback";
import {
  call,
  type BrainstormProfile,
  type BrainstormSession,
  type BrainstormSource,
  type BrainstormControl,
} from "./bridge";
const brandMark = new URL("./assets/centaurai-mark.png", import.meta.url).href;
const states = {
  running: "正在探索",
  waiting: "等待你的判断",
  paused: "已暂停",
  ended: "已结束",
  interrupted: "等待恢复",
};
const phases = {
  intake: "会前沟通",
  agenda: "议程待你确认",
  deliberation: "参谋议事",
  decision: "请你判断",
  closed: "会议简报",
};
const Markdown = ({ text }: { text: string }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      a: ({ children }) => <span>{children}</span>,
      img: () => null,
    }}
  >
    {text}
  </ReactMarkdown>
);
export default function App() {
  const [user, setUser] = useState("");
  const [profile, setProfile] = useState<BrainstormProfile>();
  const [expertIds, setExpertIds] = useState<string[]>([]);
  useEffect(() => {
    setExpertIds(profile?.members.map((m) => m.expert_id) ?? []);
  }, [profile]);
  const [sessions, setSessions] = useState<BrainstormSession[]>([]);
  const [current, setCurrent] = useState<BrainstormSession>();
  const {
    entries,
    active,
    version,
    history: ingestHistory,
    token: speechToken,
    done: finishSpeech,
    human: humanSpeech,
    reset: resetSpeech,
    reveal: revealSpeech,
  } = useSpeechPlayback();
  const [sources, setSources] = useState<BrainstormSource[]>([]);
  const [tab, setTab] = useState<"ideas" | "sources">("ideas");
  const [topic, setTopic] = useState("");
  const [reply, setReply] = useState("");
  const [context, setContext] = useState(true);
  const [url, setUrl] = useState("http://127.0.0.1:8088");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [exportNotice, setExportNotice] = useState("");
  const currentRef = useRef(current);
  currentRef.current = current;
  const historyExtended = useRef(false);
  const historyCursor = useRef<string>();
  const [hasMore, setHasMore] = useState(false);
  const feed = useRef<HTMLDivElement>(null);
  const [connected, setConnected] = useState(false);
  const report = (error: unknown) =>
    setError(error instanceof Error ? error.message : "操作暂时未完成。");
  async function work<T>(task: () => Promise<T>) {
    setError("");
    setBusy(true);
    try {
      return await task();
    } catch (e) {
      report(e);
    } finally {
      setBusy(false);
    }
  }
  const refresh = useCallback(
    async (id: string) => {
      const state = currentRef.current;
      if (!state || state.thread_id !== id) return;
      const [next, history] = await Promise.all([
        call("get", id),
        call("history", state.team_id, id),
      ]);
      if (currentRef.current?.thread_id !== id) return;
      if (next.revision < (currentRef.current?.revision ?? 0)) return;
      const nearBottom = feed.current
        ? feed.current.scrollHeight -
            feed.current.scrollTop -
            feed.current.clientHeight <
          100
        : true;
      setCurrent(next);
      ingestHistory(
        history.messages
          .filter((m) => ["user", "assistant", "ai", "human"].includes(m.role))
          .map((m) => ({
            ...m,
            agent_id: isHuman(m) ? m.agent_id : m.agent_id || state.team_id,
          })),
      );
      if (!historyExtended.current) {
        historyCursor.current = history.next_cursor;
        setHasMore(history.has_more);
      }
      setSources((old) => [
        ...old.filter((s) => !next.context.sources.some((n) => n.id === s.id)),
        ...next.context.sources,
      ]);
      setSessions((old) => old.map((s) => (s.thread_id === id ? next : s)));
      if (nearBottom)
        requestAnimationFrame(
          () =>
            feed.current?.scrollTo({
              top: feed.current.scrollHeight,
              behavior: "smooth",
            }),
        );
    },
    [ingestHistory],
  );
  useEffect(() => {
    if (
      feed.current &&
      feed.current.scrollHeight -
        feed.current.scrollTop -
        feed.current.clientHeight <
        140
    )
      requestAnimationFrame(
        () => feed.current?.scrollTo({ top: feed.current.scrollHeight }),
      );
  }, [version]);
  useEffect(() => {
    const id = current?.thread_id;
    if (!id) return;
    let stopped = false;
    const tick = () =>
      refresh(id).catch((e) => {
        if (!stopped) report(e);
      });
    const timer = setInterval(tick, 2000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [current?.thread_id, refresh]);
  useEffect(
    () =>
      window.advisory?.onFrame(({ thread_id, frame }) => {
        const state = currentRef.current;
        if (state?.thread_id !== thread_id) return;
        const agent = frame.agent_id || frame.speaker_agent_id || state.team_id;
        if (frame.type === "token") {
          speechToken(agent, frame.content ?? "");
        } else if (frame.type === "done") {
          finishSpeech(agent);
          void refresh(thread_id).catch(report);
        } else if (frame.type === "connection_lost") {
          finishSpeech();
          setConnected(false);
          setError(frame.message ?? "实时连接已断开。");
        } else if (frame.type === "error") {
          finishSpeech(agent);
          setError(frame.message || frame.content || "本轮执行出错。");
        } else if (frame.type === "turn_status") {
          setConnected(true);
        }
      }),
    [refresh, speechToken, finishSpeech],
  );
  async function select(state: BrainstormSession) {
    historyExtended.current = false;
    historyCursor.current = undefined;
    setHasMore(false);
    currentRef.current = state;
    setCurrent(state);
    setShowReport(state.status === "ended" && !!state.report);
    setExportNotice("");
    resetSpeech();
    setSources([...state.context.sources]);
    setConnected(false);
    await refresh(state.thread_id);
    await call("watch", state.team_id, state.thread_id);
    setConnected(true);
  }
  async function older() {
    if (!current || !historyCursor.current) return;
    await work(async () => {
      const history = await call(
        "history",
        current.team_id,
        current.thread_id,
        historyCursor.current,
      );
      historyExtended.current = true;
      historyCursor.current = history.next_cursor;
      setHasMore(history.has_more);
      ingestHistory(
        history.messages
          .filter((m) => ["user", "assistant", "ai", "human"].includes(m.role))
          .map((m) => ({
            ...m,
            agent_id: isHuman(m) ? m.agent_id : m.agent_id || current.team_id,
          })),
        true,
      );
    });
  }
  async function login(event: FormEvent) {
    event.preventDefault();
    await work(async () => {
      const result = await call("login", { url, username, password });
      setPassword("");
      const [p, list] = await Promise.all([call("profile"), call("list")]);
      setUser(result.username);
      setProfile(p);
      setSessions(list);
      if (!p.team_id) setSettings(true);
      else if (list[0]) await select(list[0]);
    });
  }
  async function create(event: FormEvent) {
    event.preventDefault();
    if (!topic.trim()) return;
    await work(async () => {
      const state = await call("create", {
        topic: topic.trim(),
        context_enabled: context,
        expert_ids: expertIds,
      });
      setSessions((old) => [state, ...old]);
      setTopic("");
      await select(state);
    });
  }
  async function control(action: "pause" | "resume" | "end" | "summarize") {
    if (!current) return;
    await work(async () => {
      const next = await call("control", current.thread_id, { action });
      currentRef.current = next;
      setCurrent(next);
      if (next.status === "ended") setShowReport(true);
      setSessions((old) =>
        old.map((s) => (s.thread_id === next.thread_id ? next : s)),
      );
    });
  }
  async function respond(body: BrainstormControl) {
    if (!current) return;
    await work(async () => {
      const option =
        body.option_index !== undefined
          ? current.decision?.options[body.option_index]
          : undefined;
      const text =
        body.text ||
        (option
          ? option.label + (option.detail ? `：${option.detail}` : "")
          : "");
      finishSpeech();
      const next = await call("control", current.thread_id, {
        ...body,
        revision: current.revision,
      });
      currentRef.current = next;
      setCurrent(next);
      if (next.status === "ended") setShowReport(true);
      setSessions((old) =>
        old.map((s) => (s.thread_id === next.thread_id ? next : s)),
      );
      if (text) humanSpeech(text);
      setReply("");
    });
  }
  async function viewReport() {
    if (!current) return;
    await work(async () => {
      const id = current.thread_id;
      const meetingReport = await call("report", id);
      if (currentRef.current?.thread_id !== id) return;
      setCurrent((state) => state && { ...state, report: meetingReport });
      setShowReport(true);
      feed.current?.scrollTo({ top: 0 });
    });
  }
  async function exportReport() {
    if (!current) return;
    await work(async () => {
      setExportNotice("");
      const id = current.thread_id;
      const result = await call("exportReport", id);
      if (!result.canceled && currentRef.current?.thread_id === id)
        setExportNotice(`已保存：${result.path}`);
    });
  }
  async function sourceChange(id?: string) {
    if (!current) return;
    await work(async () => {
      const excluded = [...current.excluded_source_ids];
      if (id) {
        const index = excluded.indexOf(id);
        if (index >= 0) excluded.splice(index, 1);
        else excluded.push(id);
      }
      const next = await call("control", current.thread_id, {
        action: "sources",
        excluded_source_ids: excluded,
        context_enabled: id
          ? current.context_enabled
          : !current.context_enabled,
      });
      currentRef.current = next;
      setCurrent(next);
      setSources((old) => [
        ...old.filter((s) => !next.context.sources.some((n) => n.id === s.id)),
        ...next.context.sources,
      ]);
    });
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    if (!current || !reply.trim()) return;
    await respond({
      action: "respond",
      text: reply.trim(),
      ...(current.decision ? { decision_id: current.decision.id } : {}),
    });
  }
  function nameOf(id?: string) {
    return !id || id === profile?.team_id
      ? "主持人"
      : current?.participants?.find((m) => m.agent_id === id)?.name ??
          profile?.members.find((m) => m.agent_id === id)?.name ??
          "参谋";
  }
  if (!user)
    return (
      <div className="login-page">
        <div className="login-story">
          <span className="wordmark">
            <img src={brandMark} alt="半人马AI" />
            CENTAUR AI <i>／</i> SUPER ADVISORY
          </span>
          <div>
            <span className="eyebrow">把一个问题，打开成更多可能。</span>
            <h1>
              你提出问题。
              <br />
              参谋团一起
              <br />
              <em>拓展边界。</em>
            </h1>
            <p>
              多种模型，多种视角。让主持人持续追问，
              <br />
              让知君的个人上下文成为讨论的起点。
            </p>
          </div>
          <small>半人马AI-超级参谋团 · 0.1</small>
        </div>
        <div className="login-form">
          <span className="eyebrow">开始一场有深度的头脑风暴</span>
          <h2>和你的参谋团见面</h2>
          <p>使用与知君相同的 WANX 账号。</p>
          <form onSubmit={login}>
            <label>
              WANX 服务地址
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                type="url"
                required
                placeholder="https://你的万象服务地址"
              />
            </label>
            <label>
              账号
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <label>
              密码
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            <button className="primary" disabled={busy}>
              {busy ? "正在连接…" : "进入超级参谋团 →"}
            </button>
          </form>
          <small>
            你的讨论和个人资料属于当前账号。
            <br />
            服务需先启用「超级参谋团」应用并授权这个账号。
          </small>
        </div>
      </div>
    );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-symbol" src={brandMark} alt="半人马AI" />
          <div>
            <b>半人马AI</b>
            <span>超级参谋团</span>
          </div>
        </div>
        <button
          className="new-topic"
          disabled={busy}
          onClick={() => {
            setCurrent(undefined);
            currentRef.current = undefined;
            setError("");
          }}
        >
          ＋ 发起新讨论
        </button>
        <span className="nav-label">探索记录</span>
        <nav>
          {sessions.length === 0 ? (
            <p className="quiet">
              第一个好问题，
              <br />
              从这里开始。
            </p>
          ) : (
            sessions.map((s) => (
              <button
                key={s.thread_id}
                className={s.thread_id === current?.thread_id ? "selected" : ""}
                onClick={() => void work(() => select(s))}
              >
                <i className={`status-dot ${s.status}`} />
                <span>{s.title}</span>
              </button>
            ))
          )}
        </nav>
        <div className="sidebar-bottom">
          <button onClick={() => setSettings(true)}>⚙ 参谋团设置</button>
          <div>
            <span className="avatar">{user.slice(0, 1)}</span>
            <span>{user}</span>
            <button
              title="退出登录"
              onClick={() =>
                void work(async () => {
                  await call("logout");
                  setUser("");
                  setCurrent(undefined);
                  setSessions([]);
                })
              }
            >
              ↗
            </button>
          </div>
        </div>
      </aside>
      <main className="main-panel">
        <header>
          <div>
            <span className="eyebrow">SUPER ADVISORY</span>
            <h2>
              {current ? phases[current.phase] ?? "讨论进行室" : "开启新的探索"}
            </h2>
          </div>
          {current && (
            <span className={`status-pill ${current.status}`}>
              <i className={`status-dot ${current.status}`} />
              {current.status === "running" && current.phase === "intake"
                ? "主持人正在了解"
                : current.status === "running" && current.phase === "agenda"
                ? "正在准备议程"
                : current.status === "waiting" && current.phase === "intake"
                ? "等你补充"
                : current.status === "waiting" &&
                  current.decision?.kind === "verdict"
                ? "等待你的裁决"
                : states[current.status]}
            </span>
          )}
        </header>
        {error && (
          <div className="error global-error" role="alert">
            {error}
            <button onClick={() => setError("")}>×</button>
          </div>
        )}
        {!current ? (
          <div className="new-session">
            <span className="eyebrow">一个主题 · 多种可能</span>
            <h1>
              有什么问题，
              <br />
              值得一起<em>想得更远？</em>
            </h1>
            <p>
              主持人先跟你确认目标，再组织参谋议事、提炼观点。
              <br />
              你可以安心旁听、随时发言，最后由你裁决。
            </p>
            <form onSubmit={create}>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="比如：结合我的经历和资源，还有哪些值得探索的新业务方向？"
                required
                maxLength={12000}
              />
              <div>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={context}
                    onChange={(e) => setContext(e.target.checked)}
                  />
                  结合我的知君资料
                </label>
                <button
                  className="primary"
                  disabled={
                    busy ||
                    !profile?.team_id ||
                    !topic.trim() ||
                    expertIds.length < 2
                  }
                >
                  {busy ? "正在准备…" : "先与主持人聊聊 →"}
                </button>
              </div>
            </form>
            {profile?.members.length ? (
              <fieldset className="meeting-roster">
                <legend>
                  本次邀请谁参与？ <small>至少选择 2 位</small>
                </legend>
                <div className="expert-grid">
                  {profile.members.map((member) => (
                    <label
                      className={`expert-card ${
                        expertIds.includes(member.expert_id) ? "selected" : ""
                      }`}
                      key={member.agent_id}
                    >
                      <input
                        type="checkbox"
                        checked={expertIds.includes(member.expert_id)}
                        onChange={() =>
                          setExpertIds((old) =>
                            old.includes(member.expert_id)
                              ? old.filter((id) => id !== member.expert_id)
                              : [...old, member.expert_id],
                          )
                        }
                      />
                      <span>
                        <b>{member.name}</b>
                        <p>{member.description}</p>
                      </span>
                    </label>
                  ))}
                </div>
                <button onClick={() => setSettings(true)}>
                  从专家库挑选更多参谋 →
                </button>
              </fieldset>
            ) : null}
            {!profile?.team_id && <p>先在「参谋团设置」中组建你的团队。</p>}
          </div>
        ) : (
          <>
            <div className="topic-bar">
              <div>
                <h1>{current.title}</h1>
                <p className="participants-line">
                  参会：{current.participants?.map((m) => m.name).join(" · ")}
                </p>
              </div>
              {current.agenda && (
                <p className="meeting-focus">当前议程：{current.agenda}</p>
              )}
              <div className="actions">
                <span>
                  {current.agenda_confirmed
                    ? "围绕你确认的目标"
                    : "先了解你想解决什么"}
                </span>
                {current.status === "running" ? (
                  <button disabled={busy} onClick={() => void control("pause")}>
                    Ⅱ 暂停
                  </button>
                ) : !current.decision && current.status !== "ended" ? (
                  <button
                    disabled={busy}
                    onClick={() => void control("resume")}
                  >
                    ▷ 继续
                  </button>
                ) : null}
                {current.agenda_confirmed && current.status !== "ended" && (
                  <button
                    disabled={busy}
                    onClick={() => void control("summarize")}
                  >
                    请呈交方案
                  </button>
                )}
                {current.status === "ended" ? (
                  <>
                    <button
                      disabled={busy}
                      onClick={() =>
                        showReport ? setShowReport(false) : void viewReport()
                      }
                    >
                      {showReport ? "查看讨论记录" : "查看会议报告"}
                    </button>
                    <button disabled={busy} onClick={() => void exportReport()}>
                      导出 Word 文档
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      disabled={busy}
                      onClick={() => void respond({ action: "revise" })}
                    >
                      调整重点
                    </button>
                    <button disabled={busy} onClick={() => void control("end")}>
                      结束
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="feed" ref={feed}>
              {showReport && current.report ? (
                <article className="meeting-report">
                  <Markdown text={current.report.markdown} />
                </article>
              ) : (
                <>
                  {hasMore && (
                    <button
                      className="history-more"
                      disabled={busy}
                      onClick={() => void older()}
                    >
                      查看更早的讨论
                    </button>
                  )}
                  {entries.map((speech) => (
                    <article
                      className={
                        isHuman(speech) ? "message user-message" : "message"
                      }
                      key={speech.key}
                      data-speaking={active?.key === speech.key || undefined}
                    >
                      <div className="speaker">
                        <span
                          className={
                            isHuman(speech) ? "user-symbol" : "speaker-symbol"
                          }
                        >
                          {isHuman(speech)
                            ? "你"
                            : speech.agent_id === profile?.team_id
                            ? "◈"
                            : "✦"}
                        </span>
                        <b>
                          {isHuman(speech) ? user : nameOf(speech.agent_id)}
                        </b>
                        {active?.key === speech.key ? (
                          <small>正在发言</small>
                        ) : (
                          speech.agent_id === profile?.team_id && (
                            <small>主持 · 引导与提炼</small>
                          )
                        )}
                        {active?.key === speech.key && !speech.instant && (
                          <button
                            className="speech-reveal"
                            onClick={revealSpeech}
                          >
                            显示本条全文
                          </button>
                        )}
                      </div>
                      <Markdown
                        text={Array.from(
                          readableReferences(speech.text, sources),
                        )
                          .slice(0, speech.shown)
                          .join("")}
                      />
                      {active?.key === speech.key && (
                        <span className="typing-caret" aria-hidden="true" />
                      )}
                    </article>
                  ))}
                  {entries.length === 0 && (
                    <div className="feed-empty">
                      主持人正在了解主题，准备邀请参谋。
                    </div>
                  )}
                  {current.status === "waiting" && !current.decision && (
                    <div className="wait-note">
                      <b>主持人等你补充</b>
                      <p>
                        {current.questions.length
                          ? current.questions.join("\n")
                          : "你可以补充想法，或请主持人继续。"}
                      </p>
                    </div>
                  )}
                  {current.status === "paused" && (
                    <div className="wait-note">
                      讨论已暂停。补充想法或调整资料后，可以继续探索。
                    </div>
                  )}
                  {!connected && (
                    <button
                      className="reconnect"
                      onClick={() =>
                        void work(async () => {
                          await call(
                            "watch",
                            current.team_id,
                            current.thread_id,
                          );
                          setConnected(true);
                        })
                      }
                    >
                      重新连接实时讨论
                    </button>
                  )}
                </>
              )}
            </div>
            {current.status === "ended" ? (
              <div className="composer discussion-ended">
                <div>
                  <p>
                    {current.report
                      ? "会议报告已形成，可以查看或导出 Word 文档。"
                      : "这场讨论已结束，可以整理会议报告。"}
                  </p>
                  {exportNotice && (
                    <p className="export-notice" role="status">
                      {exportNotice}
                    </p>
                  )}
                </div>
                <button
                  disabled={busy}
                  onClick={() => {
                    setCurrent(undefined);
                    currentRef.current = undefined;
                    setError("");
                  }}
                >
                  发起新讨论 →
                </button>
              </div>
            ) : (
              <form className="composer" onSubmit={send}>
                {current.decision && !active && (
                  <div className="meeting-prompt" aria-label="主持人请你判断">
                    <span className="section-label">
                      {current.decision.kind === "intake"
                        ? "先了解你的想法"
                        : current.decision.kind === "agenda"
                        ? "请确认会议议程"
                        : current.decision.kind === "verdict"
                        ? "请你裁决"
                        : "这件事需要你的判断"}
                    </span>
                    <p>{current.decision.question}</p>
                    {current.decision.kind === "agenda" ? (
                      <>
                        <p className="agenda-preview">
                          {current.brief || current.agenda}
                        </p>
                        <div className="decision-options agenda-options">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void respond({
                                action: "start",
                                decision_id: current.decision!.id,
                              })
                            }
                          >
                            按这个议程开始 →
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void respond({
                                action: "revise",
                                decision_id: current.decision!.id,
                              })
                            }
                          >
                            调整讨论重点
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="decision-options">
                        {current.decision.options.map((option, i) => (
                          <button
                            key={i}
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void respond({
                                action: "respond",
                                decision_id: current.decision!.id,
                                option_index: i,
                              })
                            }
                          >
                            <b>{option.label}</b>
                            {option.detail && <small>{option.detail}</small>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  maxLength={12000}
                  placeholder={
                    current.phase === "intake" || current.phase === "agenda"
                      ? "告诉主持人你的想法、条件或期待…"
                      : "随时发言、纠正或调整方向…"
                  }
                />
                <div>
                  <small>
                    {active
                      ? "发言正在按顺序呈现，你可以随时插话。"
                      : current.phase === "intake"
                      ? "也可以直接打字，用你自己的方式表达。"
                      : "你可以旁听，也可以随时调整重点。"}
                  </small>
                  {current.phase === "intake" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void respond({ action: "agenda" })}
                    >
                      按现有信息准备议程
                    </button>
                  )}
                  {current.decision?.kind === "verdict" &&
                    !active &&
                    reply.trim() && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void respond({
                            action: "adopt",
                            text: reply.trim(),
                            decision_id: current.decision!.id,
                          })
                        }
                      >
                        以这段话裁决
                      </button>
                    )}
                  <button className="primary" disabled={busy || !reply.trim()}>
                    {current.phase === "intake" || current.phase === "agenda"
                      ? "告诉主持人 ↑"
                      : "发言 ↑"}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </main>
      <aside className="insights">
        <div className="insight-title">
          <span className="eyebrow">不断积累，逐渐清晰</span>
          <h2>探索成果</h2>
        </div>
        <div className="tabs">
          <button
            className={tab === "ideas" ? "active" : ""}
            onClick={() => setTab("ideas")}
          >
            会议摘要
          </button>
          <button
            className={tab === "sources" ? "active" : ""}
            onClick={() => setTab("sources")}
          >
            知君资料 {sources.length > 0 && <small>{sources.length}</small>}
          </button>
        </div>
        <div className="insight-content">
          {tab === "ideas" ? (
            <MeetingOverview session={current} sources={sources} />
          ) : (
            <>
              <label className="check context-toggle">
                <input
                  type="checkbox"
                  checked={current?.context_enabled ?? context}
                  disabled={!current || busy || current.status === "ended"}
                  onChange={() => void sourceChange()}
                />
                使用我的知君资料
              </label>
              <p className="quiet">
                按话题检索当前账号的资料。修改引用会暂停讨论，继续后使用新的资料范围。
              </p>
              {current?.context.notices.map((n, i) => (
                <p className="source-notice" key={i}>
                  {n}
                </p>
              ))}
              <SourceCards
                sources={sources}
                excluded={current?.excluded_source_ids ?? []}
                disabled={busy || current?.status === "ended"}
                onChange={(id) => void sourceChange(id)}
              />
              {current?.excluded_source_ids
                .filter((id) => !sources.some((s) => s.id === id))
                .map((id, index) => (
                  <button
                    className="restore"
                    disabled={busy || current.status === "ended"}
                    key={id}
                    onClick={() => void sourceChange(id)}
                  >
                    恢复已排除的资料 {index + 1}
                  </button>
                ))}
              {sources.length === 0 && (
                <p className="quiet">检索到的相关来源会列在这里。</p>
              )}
            </>
          )}
        </div>
        <div className="insight-footer">知君的上下文，让参谋更了解你。</div>
      </aside>
      {settings && (
        <Settings onClose={() => setSettings(false)} onSaved={setProfile} />
      )}
    </div>
  );
}
