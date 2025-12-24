# LinuxDo-User-Profiler
Linuxdo 用户画像生成器

LixuxDo链接：https://linux.do/t/topic/1358212

# 前言

看到隔壁[Nodeseek有佬发布了用户画像生成器](https://github.com/tunecc/NodeSeek-User-Profiler)，觉得咱们也得有（）。变修改成如今的Linuxdo 用户画像生成器，顺便试试反重力到底怎么样。在此感谢https://v2ex.com/t/1169590 和 https://www.nodeseek.com/post-543992-1 的无私开源！由于tunecc佬写的readme十分优秀且通俗易懂，我就不画蛇添足了，仅做些微调，再次感谢佬的开源！

# 有什么用？

它可以一键抓取目标用户的历史回复，生成一份详细的、结构化的 **AI 分析报告**（包含评分标准和分析维度），直接投喂给 GPT/Gemini 等大模型。

# 如何使用

1. 在电脑上[安装好Tampermonkey](https://www.tampermonkey.net/)，并且按Tampermonkey **提示启用开发者模式**
2. [点我下载](https://github.com/luoxiaoxin123/LinuxDo-User-Profiler/blob/main/LinuxDo-User-Profiler-1.js)
3. 进入你想分析的 用户主页。
4. 点击右下角的 🐧 悬浮球。
5.按照下图的数字修改 采集条数
 <img width="236" height="82" alt="image" src="https://github.com/user-attachments/assets/90cdcaf2-6842-4be5-8530-1dbb4b743259" />

6. 点击 “开始采集”，坐等跑完。
7. 点击 “复制 Markdown” 或 **“导出 MD”**（推荐）。
8. 把内容扔给AI，等待分析结果！
<img width="420" height="251" alt="image" src="https://github.com/user-attachments/assets/cd079c4b-cace-4f83-b70c-abed34e88ddb" />

# 更新历史

* v1.0 脚本的基本功能完善，通过API进行爬取，速度较快

# 碎碎念

如果佬们有更好的提示词，欢迎提出issues。这是我第一次接触代码，没想到反重力+Gemini3flash仅用了15分钟，5论对话就修改完毕了（包括提示词），ai真的是太好用了（bushi。并且我对GitHub的使用不是很熟练，请佬们谅解。
