import { useEffect, useState, type FormEvent } from "react";
import { call, type BrainstormProfile, type MarketExpert } from "./bridge";
import AdvisorAvatar from "./AdvisorAvatar";

export default function Settings({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (profile: BrainstormProfile) => void;
}) {
  const [profile, setProfile] = useState<BrainstormProfile>();
  const [selected, setSelected] = useState<string[]>([]);
  const [expertModels, setExpertModels] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<"library" | "market">("library");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<MarketExpert[]>([]);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    void call("profile")
      .then((p) => {
        if (cancelled) return;
        setProfile(p);
        setExpertModels(
          Object.fromEntries(
            p.members.map((m) => [
              m.expert_id,
              m.model || p.host_model || p.models[0] || "",
            ]),
          ),
        );
        setSelected(
          p.members.length
            ? p.members.map((m) => m.expert_id)
            : [
                "brainstorm-creative",
                "brainstorm-strategy",
                "brainstorm-practice",
                "brainstorm-challenge",
              ],
        );
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  async function work(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function toggle(id: string) {
    setSelected((old) =>
      old.includes(id) ? old.filter((i) => i !== id) : [...old, id],
    );
  }
  async function search(event?: FormEvent) {
    event?.preventDefault();
    await work(async () => {
      const result = await call("market", query.trim());
      setItems(result.items);
      setSearched(true);
    });
  }
  const modelFor = (id: string) =>
    expertModels[id] ?? profile?.host_model ?? profile?.models[0] ?? "";
  const modelsReady = selected.every(
    (id) => profile?.models.includes(modelFor(id)),
  );
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal settings-modal"
        role="dialog"
        aria-modal="true"
        aria-label="参谋团设置"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="close" onClick={onClose} aria-label="关闭设置">
          ×
        </button>
        <span className="eyebrow">各有专长 · 一起议事</span>
        <h2>参谋团设置</h2>
        <p>选择常用专家及各自使用的模型。新讨论时还可以选择本次参会成员。</p>
        <nav className="settings-tabs" aria-label="专家来源">
          <button
            className={tab === "library" ? "active" : ""}
            onClick={() => setTab("library")}
          >
            专家库
          </button>
          <button
            className={tab === "market" ? "active" : ""}
            onClick={() => {
              setTab("market");
              if (!searched) void search();
            }}
          >
            技能市场
          </button>
        </nav>
        {tab === "library" ? (
          <>
            <p className="settings-hint">
              已选 {selected.length} 位 · 选择 2–12
              位专家。主持人会根据议题邀请不同成员交替发言。
            </p>
            {profile && !profile.models.length && (
              <p className="settings-hint">
                WANX 尚无可用的对话模型，请先在 WANX 中配置并启用。
              </p>
            )}
            <div className="expert-grid">
              {profile?.experts.map((expert) => (
                <article
                  key={expert.id}
                  className={`expert-card configurable-expert ${
                    selected.includes(expert.id) ? "selected" : ""
                  }`}
                >
                  <label className="expert-choice">
                    <input
                      type="checkbox"
                      checked={selected.includes(expert.id)}
                      disabled={
                        busy ||
                        (!selected.includes(expert.id) && selected.length >= 12)
                      }
                      onChange={() => toggle(expert.id)}
                    />
                    <AdvisorAvatar model={modelFor(expert.id)} />
                    <span>
                      <b>{expert.name}</b>
                      <small>
                        {expert.recommended
                          ? "头脑风暴预设"
                          : expert.source === "skillhub"
                          ? "SkillHub 导入"
                          : "WANX 专家"}
                      </small>
                      <p>{expert.description}</p>
                    </span>
                  </label>
                  {selected.includes(expert.id) && (
                    <label className="expert-model">
                      <span>使用模型</span>
                      <select
                        aria-label={`${expert.name}使用模型`}
                        value={modelFor(expert.id)}
                        disabled={busy || !profile.models.length}
                        onChange={(e) =>
                          setExpertModels((old) => ({
                            ...old,
                            [expert.id]: e.target.value,
                          }))
                        }
                      >
                        {!profile.models.includes(modelFor(expert.id)) && (
                          <option value={modelFor(expert.id)} disabled>
                            {modelFor(expert.id)
                              ? `${modelFor(expert.id)}（已不可用）`
                              : "暂无可用模型"}
                          </option>
                        )}
                        {profile.models.map((model) => (
                          <option key={model} value={model}>
                            {model}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </article>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="settings-hint">
              从 WANX 的 SkillHub 专家市场读取。导入会保留专家的工作流和技能。
            </p>
            <form className="market-search" onSubmit={search}>
              <input
                aria-label="搜索专家"
                placeholder="搜索专家，比如营销、组织、产品…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button disabled={busy}>{busy ? "正在读取…" : "搜索"}</button>
            </form>
            <div className="expert-grid">
              {items.map((item) => {
                const imported = profile?.experts.some((e) => e.id === item.id);
                return (
                  <article className="expert-card market-card" key={item.id}>
                    <div>
                      <b>{item.label.zh || item.label.en}</b>
                      <small>SkillHub · {item.skill_count} 项技能</small>
                      <p>{item.description.zh || item.description.en}</p>
                    </div>
                    <button
                      disabled={
                        busy ||
                        selected.length >= 12 ||
                        selected.includes(item.id)
                      }
                      onClick={() =>
                        void work(async () => {
                          if (!imported) await call("importExpert", item.slug);
                          const next = await call("profile");
                          setProfile(next);
                          setSelected((old) => [...old, item.id]);
                          setNotice("已加入待选名单，保存后即可邀请参会。");
                        })
                      }
                    >
                      {selected.includes(item.id)
                        ? "已选中"
                        : imported
                        ? "选择专家"
                        : "导入并选中"}
                    </button>
                  </article>
                );
              })}
            </div>
            {searched && !busy && !items.length && !error && (
              <p>没有找到匹配专家，可以换个关键词。</p>
            )}
          </>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="settings-notice" role="status">
            {notice}
          </p>
        )}
        {profile && profile.models.length > 0 && !modelsReady && (
          <p className="settings-hint">
            有参谋的模型已不可用，请从 WANX 当前模型列表重新选择。
          </p>
        )}
        <footer className="expert-settings-footer">
          <small>
            仅可选择 WANX 已启用的对话模型。服务商与密钥在 WANX 管理。
          </small>
          <button
            className="primary"
            disabled={
              busy ||
              selected.length < 2 ||
              selected.length > 12 ||
              !profile ||
              !modelsReady
            }
            onClick={() =>
              void work(async () => {
                const next = await call("configure", {
                  expert_ids: selected,
                  expert_models: Object.fromEntries(
                    selected.map((id) => [id, modelFor(id)]),
                  ),
                });
                onSaved(next);
                onClose();
              })
            }
          >
            {busy ? "正在处理…" : "保存参谋设置"}
          </button>
        </footer>
      </section>
    </div>
  );
}
