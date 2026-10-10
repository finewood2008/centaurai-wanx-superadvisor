import { familyNames, modelFamily } from "./modelIdentity";

const council = new URL("./assets/ai-council-brands.png", import.meta.url).href;
const host = new URL("./assets/moderator-avatar.png", import.meta.url).href;
// Viewports into the original illustration preserve the exact homepage characters.
const portraits = {
  claude: "96 158 184 184",
  gpt: "326 10 184 184",
  gemini: "658 22 184 184",
  grok: "1022 76 184 184",
  deepseek: "1232 150 184 184",
  qwen: "1324 298 184 184",
};

export default function AdvisorAvatar({ model, moderator = false }: {
  model?: string | null;
  moderator?: boolean;
}) {
  const family = modelFamily(model);
  const label = moderator ? "主持人 · 会议秘书" : family ? `${familyNames[family]} 机器人` : "AI 参谋";
  return (
    <span className={`advisor-avatar${moderator ? " moderator-avatar" : ""}`}
      data-model-family={moderator ? "moderator" : family ?? "unknown"}
      role="img" aria-label={label} title={moderator ? label : model || "模型未注明"}>
      {moderator ? <img src={host} alt="" /> : family ? (
        <svg viewBox={portraits[family]} aria-hidden="true" focusable="false">
          <image href={council} width="1536" height="1024" />
        </svg>
      ) : <span className="avatar-neutral" aria-hidden="true">AI</span>}
    </span>
  );
}
