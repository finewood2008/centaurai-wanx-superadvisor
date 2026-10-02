import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { BrainstormSession, BrainstormSource } from "./bridge";
import {
  meetingDigest,
  readableReferences,
  sourceKinds,
  sourceProvenance,
  sourceTitle,
  viewpointParts,
} from "./insightContent";

const Text = ({
  text,
  sources,
}: {
  text: string;
  sources: readonly BrainstormSource[];
}) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      a: ({ children }) => <span>{children}</span>,
      img: () => null,
    }}
  >
    {readableReferences(text, sources)}
  </ReactMarkdown>
);

export function MeetingOverview({
  session,
  sources,
}: {
  session?: BrainstormSession;
  sources: readonly BrainstormSource[];
}) {
  if (!session)
    return (
      <p className="quiet">
        开始会议后，主持人会在这里整理核心观点、分歧和下一步。只看这里，也能跟上讨论。
      </p>
    );
  const digest = meetingDigest(session);
  return (
    <div className="meeting-digest">
      <section className="digest-overview">
        <span className="section-label">目前最重要的判断</span>
        {digest.overview ? (
          <Text text={digest.overview} sources={sources} />
        ) : (
          <p className="quiet">
            主持人正在了解你的问题，形成观点后会在这里呈报。
          </p>
        )}
        <small>
          {session.ruling ? "已有你的最终裁决" : "讨论中的判断，仍可调整"}
        </small>
      </section>
      <section className="digest-section">
        <h3>
          核心观点 <small>{digest.points.length}</small>
        </h3>
        {digest.points.length ? (
          digest.points.map((point, i) => {
            const parts = viewpointParts(readableReferences(point, sources));
            return (
              <article className="viewpoint-card" key={i}>
                <span className="viewpoint-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h4>{parts.title}</h4>
                  {parts.detail && (
                    <Text
                      text={parts.detail
                        .replace(/\n+(?=(?:理由|依据|对你意味着)：)/g, "\n\n")
                        .replace(/^(理由|依据|对你意味着)：/gm, "**$1：** ")}
                      sources={sources}
                    />
                  )}
                </div>
              </article>
            );
          })
        ) : (
          <p className="quiet">还在探索，暂时没有形成具体观点。</p>
        )}
      </section>
      {!!digest.disagreements.length && (
        <section className="digest-section digest-disagreements">
          <h3>分歧与风险</h3>
          {digest.disagreements.map((point, i) => (
            <div className="digest-item" key={i}>
              <Text text={point} sources={sources} />
            </div>
          ))}
        </section>
      )}
      {!!digest.actions.length && (
        <section className="digest-section">
          <h3>建议下一步</h3>
          <p className="digest-caption">这些是参谋建议，是否执行由你决定。</p>
          <ol className="digest-actions">
            {digest.actions.map((action, i) => (
              <li key={i}>
                <Text text={action.task} sources={sources} />
                {(action.owner || action.timing) && (
                  <small>
                    {[
                      action.owner && `建议由 ${action.owner}`,
                      action.timing && `建议时间：${action.timing}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
      {(session.ruling || session.judgments.length > 0) && (
        <section className="digest-section digest-decisions">
          <h3>{session.ruling ? "你的最终裁决" : "你已表达的意见"}</h3>
          {session.ruling ? (
            <Text text={session.ruling} sources={sources} />
          ) : (
            session.judgments.slice(-5).map((judgment, i) => (
              <div className="digest-item" key={i}>
                <small>{judgment.question}</small>
                <Text text={judgment.answer} sources={sources} />
              </div>
            ))
          )}
        </section>
      )}
      {!!digest.questions.length && (
        <section className="digest-section">
          <h3>还需要确认</h3>
          <ul>
            {digest.questions.map((question, i) => (
              <li key={i}>
                <Text text={question} sources={sources} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {!!session.directions.length && (
        <details className="digest-background">
          <summary>仍可探索的方向</summary>
          <ul>
            {session.directions.map((direction, i) => (
              <li key={i}>
                <Text text={direction} sources={sources} />
              </li>
            ))}
          </ul>
        </details>
      )}
      {!!digest.pending.length && (
        <details className="digest-background">
          <summary>仍在研究，尚未形成结论</summary>
          <ul>
            {digest.pending.map((point, i) => (
              <li key={i}>
                <Text text={point} sources={sources} />
              </li>
            ))}
          </ul>
        </details>
      )}
      <details className="digest-background">
        <summary>本场目标与条件</summary>
        <Text text={session.goal || session.title} sources={sources} />
        {!!session.constraints.length && (
          <>
            <small>
              {session.agenda_confirmed ? "你确认的条件" : "待你确认的条件"}
            </small>
            <ul>
              {session.constraints.map((condition, i) => (
                <li key={i}>{condition}</li>
              ))}
            </ul>
          </>
        )}
      </details>
    </div>
  );
}

export function SourceCards({
  sources,
  excluded,
  disabled,
  onChange,
}: {
  sources: readonly BrainstormSource[];
  excluded: readonly string[];
  disabled: boolean;
  onChange: (id: string) => void;
}) {
  return (
    <>
      {sources.map((source) => (
        <article
          className={`source-card ${excluded.includes(source.id) ? "excluded" : ""}`}
          key={source.id}
        >
          <div className="source-card-header">
            <span>
              {sourceProvenance[source.provenance] || "来源性质待确认"}
            </span>
            <label className="check">
              <input
                type="checkbox"
                checked={!excluded.includes(source.id)}
                disabled={disabled}
                onChange={() => onChange(source.id)}
                aria-label={`引用${sourceTitle(source)}`}
              />
              {excluded.includes(source.id) ? "已排除" : "本场引用"}
            </label>
          </div>
          <div className="source-quote">
            {source.text ? (
              <Text text={source.text} sources={sources} />
            ) : (
              <p className="quiet">这份资料未返回可显示的内容。</p>
            )}
          </div>
          <details className="source-origin">
            <summary>查看出处 · {sourceTitle(source)}</summary>
            <dl>
              <dt>来自</dt>
              <dd>{sourceKinds[source.kind]}</dd>
              <dt>资料</dt>
              <dd>{sourceTitle(source)}</dd>
              <dt>性质</dt>
              <dd>{sourceProvenance[source.provenance] || "来源性质待确认"}</dd>
            </dl>
            {source.provenance === "assistant_reply" ||
            source.provenance === "inference" ||
            source.provenance === "model_inference" ? (
              <p>这是 AI 的回答或理解，不能直接当作你确认的事实。</p>
            ) : null}
          </details>
        </article>
      ))}
    </>
  );
}
