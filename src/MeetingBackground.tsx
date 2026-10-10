import { useState } from "react";
import type { BrainstormSession } from "./bridge";
import AdvisorAvatar from "./AdvisorAvatar";

export function MeetingBackground({
  session,
}: {
  session?: BrainstormSession;
}) {
  if (!session)
    return (
      <section className="meeting-background">
        <h3>从你的问题开始</h3>
        <p>
          不需要提前准备个人档案。告诉主持人你想解决什么，再一起聊清目标、现状和条件。
        </p>
        <p className="quiet">
          本场沟通会保存在会议中。知君是可选来源，不影响直接开会。
        </p>
      </section>
    );
  return (
    <section className="meeting-background" aria-label="本场会议背景">
      <span
        className={`background-status ${
          session.agenda_confirmed ? "confirmed" : ""
        }`}
      >
        {session.agenda_confirmed
          ? "你已确认 · 本场使用"
          : "正在整理 · 待你确认"}
      </span>
      <h3>这次想解决什么</h3>
      <p>{session.goal || session.title}</p>
      <h3>条件与边界</h3>
      {session.constraints.length ? (
        <ul>
          {session.constraints.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      ) : (
        <p className="quiet">
          尚未提供。你可以补充时间、人手、预算或不想做的事。
        </p>
      )}
      <h3>准备怎么讨论</h3>
      <p>
        {session.agenda ||
          "主持人会先了解情况，再整理讨论范围，等你确认后邀请参谋。"}
      </p>
      {!session.agenda_confirmed && (
        <p className="background-note">
          这是主持人的理解，尚不是你确认的事实。遗漏或理解不对的地方，都可以更正。
        </p>
      )}
      <details className="background-originals">
        <summary>你在本场说过的话 · 查看原文</summary>
        <blockquote>{session.title}</blockquote>
        {session.judgments.map((j, i) => (
          <div key={i}>
            <small>{j.question}</small>
            <blockquote>{j.answer}</blockquote>
          </div>
        ))}
      </details>
    </section>
  );
}

export function BackgroundReview({
  session,
  busy,
  error,
  onClose,
  onConfirm,
  onCorrect,
  onSources,
}: {
  session: BrainstormSession;
  busy: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => void;
  onCorrect: (text: string) => void;
  onSources: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [goal, setGoal] = useState(session.goal || session.title);
  const [conditions, setConditions] = useState(session.constraints.join("\n"));
  const [agenda, setAgenda] = useState(session.agenda);
  return (
    <div className="modal-backdrop" onClick={() => !busy && onClose()}>
      <section
        className="modal background-review"
        role="dialog"
        aria-modal="true"
        aria-labelledby="background-review-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="close"
          aria-label="暂时收起背景确认"
          disabled={busy}
          onClick={onClose}
        >
          ×
        </button>
        <div className="background-secretary">
          <AdvisorAvatar moderator />
          <span>主持人 · 会前整理</span>
        </div>
        <h2 id="background-review-title">先确认，这是你想开的会</h2>
        <p className="quiet">
          确认后，参谋会围绕这些目标与条件展开。你随时可以调整。
        </p>
        <div className="background-review-body">
          {editing ? (
            <div className="background-editor">
              <label>
                这次想解决什么
                <textarea
                  aria-label="修改会议目标"
                  value={goal}
                  maxLength={2000}
                  onChange={(e) => setGoal(e.target.value)}
                />
              </label>
              <label>
                现状、条件与边界
                <textarea
                  aria-label="修改会议条件"
                  value={conditions}
                  maxLength={4000}
                  onChange={(e) => setConditions(e.target.value)}
                  placeholder="比如：只有两个人、每周能投入两天；还不确定的可以直接说明。"
                />
              </label>
              <label>
                希望怎么讨论
                <textarea
                  aria-label="修改讨论范围"
                  value={agenda}
                  maxLength={2000}
                  onChange={(e) => setAgenda(e.target.value)}
                />
              </label>
              <p className="quiet">
                主持人会根据你的更正重新整理，再请你确认。
              </p>
            </div>
          ) : (
            <MeetingBackground session={session} />
          )}
          <div className="background-source-summary">
            <b>本场资料范围</b>
            <p>
              {session.context_enabled
                ? `你在本场提供的信息，以及你启用的知君资料（当前 ${
                    session.context.sources.filter(
                      (s) => !session.excluded_source_ids.includes(s.id),
                    ).length
                  } 条）。`
                : "仅使用你在本场提供的信息，未启用知君资料。"}
            </p>
          </div>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <footer className="background-review-actions">
          {editing ? (
            <>
              <button disabled={busy} onClick={() => setEditing(false)}>
                取消修改
              </button>
              <button
                className="primary"
                disabled={busy || !goal.trim() || !agenda.trim()}
                onClick={() =>
                  onCorrect(
                    `请按我下面的更正重新整理会议背景，等我确认后再开始讨论。\n\n本场目标：${goal.trim()}\n\n现状、条件与边界：${
                      conditions.trim() || "暂未提供，请不要自行补充。"
                    }\n\n讨论范围：${agenda.trim()}`,
                  )
                }
              >
                交给主持人重新整理
              </button>
            </>
          ) : (
            <>
              <button disabled={busy} onClick={() => setEditing(true)}>
                我改一下
              </button>
              <button disabled={busy} onClick={onSources}>
                补充背景 / 选择资料
              </button>
              <button
                className="primary"
                disabled={busy || !session.agenda.trim()}
                onClick={onConfirm}
              >
                {busy ? "正在处理…" : "理解准确，开始讨论 →"}
              </button>
            </>
          )}
        </footer>
      </section>
    </div>
  );
}
