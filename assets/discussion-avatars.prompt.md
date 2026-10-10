# 讨论头像

六个参谋头像直接在前端显示 `src/assets/ai-council-brands.png` 的对应机器人面孔，保留首页原始形象与额头标识，没有重新绘制。

主持人使用内置 image_gen 工具，以同一首页插图为风格参考生成。输出：`src/assets/moderator-avatar.png`。与模型无关，固定使用眼镜、耳麦、青绿色服装和金色罗盘徽记。

## 主持人最终提示词

Use case: identity-preserve / illustration-story. Create ONE square portrait avatar for the meeting moderator of this AI advisory council app. Input image is the style reference: preserve the same warm hand-painted gouache, ivory ceramic robot construction, brass ear joints and intelligent kind eyes. This moderator must be a NEW distinct robot character, not any of the six branded advisors. Close-up front-facing head and shoulders, entire head large and fully visible in center, fills 85% of square. A dignified warm ivory ceramic meeting-secretary robot wearing a dark teal jacket, thin round brass spectacles and a small discreet headset microphone; a small simple gold compass-diamond badge on forehead (no AI model brand, no text). Calm attentive professional expression, distinctive teal accents. Soft warm cream background, clean silhouette, readable at 56 pixels. No table, no other characters, no lettering, no watermark. Match the homepage illustration aesthetic exactly.
