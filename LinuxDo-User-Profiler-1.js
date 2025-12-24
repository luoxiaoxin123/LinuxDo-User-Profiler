// ==UserScript==
// @name         LINUX DO 用户画像生成器
// @name:zh-CN   LINUX DO 用户画像生成器
// @name:en      LINUX DO User Profiler
// @namespace    https://linux.do/
// @version      1.2
// @description  自动爬取 LINUX DO 用户的回帖导出 Markdown/CSV、生成符合 LINUX DO 生态的 AI 分析指令。
// @description:en  Automatically crawl LINUX DO users' posts, export them as Markdown/CSV, and generate AI analysis commands that comply with the LINUX DO ecosystem.
// @author       Antigravity
// @match        https://linux.do/u/*
// @icon         https://linux.do/uploads/default/optimized/3X/9/d/9d455c357996c560249c5e5331498686d1d78298_2_32x32.png
// @grant        GM_setClipboard
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    // --- 配置区域 ---
    const CONFIG = {
        API_CONCURRENCY: 1,   // Discourse API 较严格，建议单并发
        API_DELAY: 1000,      // API 请求间隔 (ms)
        PER_PAGE_COUNT: 30    // Discourse 默认分页数
    };

    // 状态管理
    let state = {
        isRunning: false,
        processedPages: 0,
        maxPage: 10,
        totalItems: 0,
        username: ''
    };
    let allReplies = [];

    // --- 1. 样式注入 ---
    function injectStyles() {
        const style = document.createElement('style');
        style.innerHTML = `
            :root {
                --ld-bg: rgba(255, 255, 255, 0.95);
                --ld-border: rgba(0, 0, 0, 0.1);
                --ld-shadow: 0 15px 35px rgba(0, 0, 0, 0.1);
                --ld-primary: #33a654; /* LINUX DO 绿色风格 */
                --ld-success: #28a745;
                --ld-orange: #fd7e14;
                --ld-purple: #6f42c1;
                --ld-danger: #dc3545;
            }
            .ld-panel {
                position: fixed; top: 80px; right: 20px; width: 300px;
                background: var(--ld-bg); backdrop-filter: blur(10px);
                border: 1px solid var(--ld-border); border-radius: 16px;
                box-shadow: var(--ld-shadow); font-family: -apple-system, system-ui, sans-serif;
                padding: 20px; z-index: 10001; animation: ld-pop 0.3s ease-out;
            }
            @keyframes ld-pop { from { opacity:0; transform: translateY(10px); } to { opacity:1; transform: translateY(0); } }

            .ld-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
            .ld-title { font-size: 16px; font-weight: bold; color: #222; }
            .ld-close { cursor: pointer; opacity: 0.5; font-size: 18px; }

            .ld-input-wrap { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
            .ld-input { width: 60px; padding: 4px; border: 1px solid #ddd; border-radius: 4px; text-align: center; }

            .ld-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px; }
            .ld-stat { background: #f8f9fa; padding: 10px; border-radius: 8px; text-align: center; }
            .ld-stat-label { font-size: 12px; color: #666; }
            .ld-stat-val { font-size: 14px; font-weight: bold; }

            .ld-progress-track { height: 6px; background: #eee; border-radius: 3px; overflow: hidden; margin-bottom: 15px; }
            .ld-progress-fill { height: 100%; background: var(--ld-primary); width: 0%; transition: width 0.3s; }

            .ld-btn { width: 100%; border: none; padding: 10px; border-radius: 8px; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; margin-bottom: 8px; }
            .ld-btn-start { background: var(--ld-primary); }
            .ld-btn-stop { background: var(--ld-danger); }
            .ld-btn-md { background: var(--ld-orange); }
            .ld-btn-copy { background: #007bff; }
            .ld-btn-csv { background: var(--ld-purple); }
            .ld-btn-clear { background: #6c757d; font-size: 12px; }

            .ld-toast { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #333; color: #fff; padding: 10px 20px; border-radius: 20px; z-index: 10002; font-size: 14px; }
        `;
        document.head.appendChild(style);
    }

    // --- 2. 生命周期与 UI 注入 ---
    window.addEventListener('load', () => {
        setTimeout(() => {
            injectStyles();
            initBtn();
        }, 1500);
    });

    function initBtn() {
        if (document.getElementById('ld-entry-btn')) return;
        const btn = document.createElement('div');
        btn.id = 'ld-entry-btn';
        btn.innerHTML = '🐧';
        btn.style.cssText = `
            position: fixed; bottom: 85px; right: 25px; width: 50px; height: 50px;
            background: #33a654; color: white; border-radius: 50%; text-align: center;
            line-height: 50px; cursor: pointer; z-index: 10000; box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            font-size: 24px; transition: transform 0.2s;
        `;
        btn.onclick = createControlPanel;
        document.body.appendChild(btn);
    }

    function createControlPanel() {
        if (document.getElementById('ld-panel')) return;

        // 解析用户名
        const urlMatch = window.location.pathname.match(/\/u\/([^\/]+)/);
        if (!urlMatch) {
            alert('需在用户主页使用（URL 包含 /u/用户名）');
            return;
        }
        state.username = urlMatch[1];

        const panel = document.createElement('div');
        panel.id = 'ld-panel';
        panel.className = 'ld-panel';
        panel.innerHTML = `
            <div class="ld-header">
                <div class="ld-title">LINUX DO 洞察者</div>
                <div class="ld-close" id="ld-close">✕</div>
            </div>
            <div class="ld-input-wrap">
                <span>采集条数 (≈条)</span>
                <input type="number" id="ld-pages" class="ld-input" value="100" step="30" min="30">
            </div>
            <div class="ld-grid">
                <div class="ld-stat">
                    <div class="ld-stat-label">当前进度</div>
                    <div class="ld-stat-val" id="ld-page-txt">就绪</div>
                </div>
                <div class="ld-stat">
                    <div class="ld-stat-label">已抓取</div>
                    <div class="ld-stat-val" id="ld-count">0</div>
                </div>
            </div>
            <div class="ld-progress-track">
                <div class="ld-progress-fill" id="ld-bar"></div>
            </div>
            <div id="ld-btn-start-area">
                <button class="ld-btn ld-btn-start" id="ld-start">开始抓取</button>
            </div>
            <div id="ld-btn-stop-area" style="display:none">
                <button class="ld-btn ld-btn-stop" id="ld-stop">停止抓取</button>
            </div>
            <div class="ld-actions">
                <button class="ld-btn ld-btn-md" id="ld-md">导出 Markdown</button>
                <button class="ld-btn ld-btn-copy" id="ld-copy">复制分析指令</button>
                <button class="ld-btn ld-btn-csv" id="ld-csv">导出 CSV</button>
            </div>
            <button class="ld-btn ld-btn-clear" id="ld-clear">清空数据</button>
        `;
        document.body.appendChild(panel);

        document.getElementById('ld-close').onclick = () => panel.remove();
        document.getElementById('ld-start').onclick = startExtraction;
        document.getElementById('ld-stop').onclick = () => { state.isRunning = false; toggleUI(false); };
        document.getElementById('ld-md').onclick = exportToMarkdown;
        document.getElementById('ld-csv').onclick = exportToCSV;
        document.getElementById('ld-copy').onclick = copyToClipboard;
        document.getElementById('ld-clear').onclick = () => { allReplies = []; updateUI(); };
    }

    // --- 3. 抓取逻辑 (Discourse API) ---
    async function startExtraction() {
        const limitCount = parseInt(document.getElementById('ld-pages').value) || 100;
        state.isRunning = true;
        state.totalItems = 0;
        allReplies = [];
        toggleUI(true);

        let offset = 0;
        while (state.isRunning && allReplies.length < limitCount) {
            updateStatus(`正在请求偏移量: ${offset}...`);
            try {
                const res = await fetch(`/user_actions.json?username=${state.username}&filter=5&offset=${offset}`);
                const data = await res.json();

                if (!data.user_actions || data.user_actions.length === 0) {
                    updateStatus("抓取完毕（没有更多回帖）");
                    break;
                }

                data.user_actions.forEach(action => {
                    if (allReplies.length < limitCount) {
                        allReplies.push({
                            title: action.title || '无标题',
                            content: action.excerpt || '内容较短或无法解析',
                            topic_id: action.topic_id,
                            post_number: action.post_number,
                            url: `https://linux.do/t/${action.topic_id}/${action.post_number}`
                        });
                    }
                });

                updateUI(offset, limitCount);
                offset += CONFIG.PER_PAGE_COUNT;
                await new Promise(r => setTimeout(r, CONFIG.API_DELAY));

            } catch (e) {
                console.error(e);
                updateStatus("抓取出错，请检查网络");
                break;
            }
        }
        finish();
    }

    // --- 4. 导出与 AI 指令生成 ---
    function generatePrompt() {
        const date = new Date().toLocaleString();
        let md = `# LINUX DO 终极佬友深度洞察任务 (万字级长篇报告模式)\n\n`;
        md += `## 📋 顶级分析指令\n你是一位深谙 **LINUX DO (https://linux.do/)** 社区精髓的顶级行为分析专家。该社区口号是 **“Where possible begins”**，愿景是 **“新的理想型社区”**。用户的核心文化是 **“真诚、友善、团结、专业”**。社区内用户互称为 **“佬友”**。\n\n`;
        md += `> **[🚨 核心约束：拒绝简短回复]**\n`;
        md += `> 请不要给出泛泛而谈的结论。每一项评分、每一个标签、每一段总结都必须基于下方提供的【原始回帖记录】进行**逻辑链推演**。你必须表现得像一个心理学家、人类学家和高级数据分析师的结合体。请输出一份详尽、深入、且富有洞察力的长篇报告。报告总字数建议控制在 800-1500 字之间。\n\n`;
        md += `## 👤 深度分析对象\n- **佬友 ID**: ${state.username}\n- **社区背景**: LINUX DO (秉承“始皇”潘多拉精神的高质量共同体)\n- **数据样本数**: ${allReplies.length} 条回帖记录\n- **分析时间**: ${date}\n\n`;
        md += `## 💬 原始回帖证据矩阵 (RAW DATA)\n\n`;

        allReplies.forEach((r, i) => {
            md += `### [证据编号 ${i + 1}] 主题: ${r.title}\n> **内容原文**: ${r.content}\n🔗 [溯源链接](${r.url})\n\n---\n`;
        });

        md += `
## 🎯 第一阶段：多维深度量化评分 (基于证据推演)

请对以下维度进行精密评分 (1-10分)，并为每一个分值提供 **[深度理由]** 和 **[证据引证]**：

### 1. 社区文化灵魂契合度
- **真诚度与互助精神 (Sincerity)**: 佬友是否表现出无私分享？在讨论“C语言/白嫖”时，其态度是“精致利己”还是“真诚共建”？
- **友善度与包容性 (Friendliness)**: 面对低质量提问或争议时，该佬友是“降维打击”还是“如沐春风”？

### 2. 佬友生态定位 (基于分区轨迹分析)
请结合 **LINUX DO** 分区截图信息，分析该佬友在各板块的行为逻辑：
- **【开发调优 / 国产替代】专精**: 识别其是否具备底层架构师或硬核开发者的潜质。分析其解决问题的逻辑思路。
- **【资源荟萃 / 搞七捻三】社交性**: 识别其在社区中的“情绪价值”贡献。是社区的“冷面技术咖”还是“热心老大哥”？
- **【前沿快讯 / 福利羊毛】敏锐度**: 识别其对信息获取的触觉。其分享内容是否具备时效性和高可用性？

### 3. 技术影响力与专业深度
- **核心专业领域**: (AI/LLM、Linux、后端工程等) 请基于回帖内容判断其技术栈的深度和广度。
- **成长与探索力**: 是否体现了“Where possible begins”的精神？是否在尝试攻克新技术或解决社区共性难题？

---

## 📊 第二阶段：终极画像总结 (详细、深刻、长篇)

请输出以下项，严禁使用套话：

### 💡 1. 佬友全貌深度侧写 (不少于 500 字)
[请从“行为心理”、“技术风格”、“社区声望”、“社交倾向”四个维度，撰写一段极具深度的文字。描述该位佬友在 LINUX DO 理想型社区中的真实地位和独特生命力。]

### 🏷️ 2. 核心特征标签 (3-5个，需带简短解释)
- 例如：\`#真诚分享佬\` (理由：多次在资源荟萃版块发布高质量自建 API...)
- 例如：\`#搞七捻三哲学家\` (理由：在生活帖中体现出极其深厚的文学功底...)

### 🛡️ 3. 互动与共建建议
- **如果你是小白**: 该如何向这位佬友请教才能获得最佳回应？
- **如果你是开发者**: 双方在哪些技术点上可能有共同话题？
- **风险提示**: 该位佬友是否存在过度“白嫖”或发言过于犀利的特征？

---

> **[⚠️ 重要声明]**：本分析报告每一句结论都必须能回溯到上方的【证据矩阵】。严禁凭空想象。
`;
        return md;
    }

    // --- 辅助函数 ---
    function updateUI(offset, total) {
        document.getElementById('ld-count').innerText = allReplies.length;
        const pct = Math.min(100, (allReplies.length / (total || 1)) * 100);
        document.getElementById('ld-bar').style.width = `${pct}%`;
        document.getElementById('ld-page-txt').innerText = `已走 ${offset}`;
    }

    function toggleUI(running) {
        document.getElementById('ld-btn-start-area').style.display = running ? 'none' : 'block';
        document.getElementById('ld-btn-stop-area').style.display = running ? 'block' : 'none';
        document.getElementById('ld-start').disabled = running;
    }

    function updateStatus(txt) {
        document.getElementById('ld-page-txt').innerText = txt;
    }

    function finish() {
        state.isRunning = false;
        toggleUI(false);
        showToast("抓取完成！");
    }

    function showToast(msg) {
        const t = document.createElement('div');
        t.className = 'ld-toast';
        t.innerText = msg;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 2000);
    }

    function download(content, filename, type) {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
    }

    function exportToMarkdown() { download(generatePrompt(), `ld_analysis_${state.username}.md`, 'text/markdown'); }
    function exportToCSV() {
        let csv = '\uFEFF标题,内容,链接\n';
        allReplies.forEach(r => csv += `"${r.title.replace(/"/g, '""')}","${r.content.replace(/"/g, '""')}","${r.url}"\n`);
        download(csv, `ld_replies_${state.username}.csv`, 'text/csv');
    }
    async function copyToClipboard() {
        await navigator.clipboard.writeText(generatePrompt());
        showToast("指令已复制");
    }

})();
