# 启动页 AI 圆桌插图

- Tool: built-in `image_gen`, generation followed by image editing; no CLI fallback.
- Final asset: `../src/assets/ai-council-brands.png`, 1536×1024 PNG, original alpha preserved.
- Initial asset: `../src/assets/ai-council-illustration.png`; the final revision adds the sixth advisor and the six requested brand marks.
- Used by: `src/Login.tsx` in both service discovery and account login.

## Final editing prompt

Edit this illustration for an AI advisory council app launch page. Preserve the beautiful warm gouache/colored-pencil texture, warm ivory ceramic robots, terracotta/steel blue/sage clothing, oval wood meeting table, papers, lamp, gentle human decision maker in the near foreground, overall composition and genuinely transparent background. Change the number of AI advisors from five to EXACTLY SIX, all six faces/foreheads clearly visible. Add one extra robot by naturally redistributing the six AI advisors around the far and side edges of the table; keep exactly one human at the near edge, seven participants total. The six robots must be immediately distinguishable by a different brand mark mounted ON EACH ROBOT'S FOREHEAD, integrated like a small tasteful enamel forehead badge, not floating labels and not labels on their chest. Use these six identities once each: 1 Claude: recognizable warm-orange Claude asterisk/sunburst mark, small readable wordmark 'Claude'; 2 GPT: recognizable OpenAI interlaced knot emblem, small readable wordmark 'GPT'; 3 Gemini: recognizable four-point gradient blue/purple Gemini sparkle, small readable wordmark 'Gemini'; 4 Grok: recognizable black Grok ring/slash mark, small readable wordmark 'Grok'; 5 DeepSeek: recognizable cobalt-blue DeepSeek whale emblem, small readable wordmark 'DeepSeek'; 6 Qwen: recognizable purple Qwen interwoven multi-point emblem, small readable wordmark 'Qwen'. Give each forehead enough flat space and angle for its badge and wordmark to be plainly legible in the final artwork, no duplicate brands. This is a fictional friendly meeting of AI models, not an official endorsement. Keep the intelligent calm lively gestures, varied personalities and human-centered mood. Landscape 3:2, full table and chairs, enough margin, no cropping of heads. No other writing, no watermarks, no rectangular opaque background. Preserve transparency and soft delicate ground contact shadows.

## Verification

Inspected the generated illustration and the composited launch/login screens. Six distinct robot head marks and one human are visible. Asset is loaded locally and retains its transparent background. Checked 1440×940 and 1050×700 windows; illustration and login controls remain visible. This artwork changes the launch-page presentation, not the configured model roster.
