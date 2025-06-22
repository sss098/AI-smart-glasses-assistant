const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');

const app = express();
const port = 3000; // 服务器将运行在3000端口

app.use(cors());
app.use(express.json());

let browser = null;

// 新函数：动态获取当前活跃的页面 (最终修复版 V2 - 仅基于焦点)
async function getActivePage() {
    // 1. 确保浏览器实例正在运行
    if (!browser || !browser.isConnected()) {
        console.log("浏览器未连接，正在启动新实例...");
        browser = await chromium.launch({ channel: 'msedge', headless: false });
        browser.on('disconnected', () => {
            console.log("浏览器已断开连接。");
            browser = null;
        });
    }

    // 2. 获取浏览器上下文
    let context = browser.contexts()[0];
    if (!context) {
        console.log("未找到现有浏览器上下文，正在创建新的上下文...");
        context = await browser.newContext();
    }

    // 3. 确保新打开的标签页能被自动聚焦
    if (context.listenerCount('page') === 0) {
        context.on('page', async newPage => {
            console.log("检测到新页面/标签页，将它置于前台。");
            try { await newPage.bringToFront(); } catch (e) { /* page might close */ }
        });
    }

    const pages = context.pages();
    if (pages.length === 0) {
        console.log("上下文中没有打开的页面，正在创建新页面...");
        return await context.newPage();
    }

    // 4. 核心逻辑：只寻找拥有焦点的页面
    const focusedPages = [];
    for (const page of pages) {
        try {
            if (await page.evaluate(() => document.hasFocus())) {
                focusedPages.push(page);
            }
        } catch (e) { /* 页面可能在迭代时关闭，忽略错误 */ }
    }

    // 5. 根据找到的聚焦页面数量做出决策
    if (focusedPages.length === 1) {
        console.log("成功找到一个拥有焦点的页面。");
        await focusedPages[0].bringToFront();
        return focusedPages[0];
    } else if (focusedPages.length === 0) {
        // 关键：如果找不到，则回退到操作最后一个打开的页面，而不是报错
        console.warn("找不到拥有焦点的页面。将回退到使用最后一个标签页。");
        const lastPage = pages[pages.length - 1];
        await lastPage.bringToFront();
        return lastPage;
    } else {
        // 理论上不可能，但作为保障
        console.warn(`找到 ${focusedPages.length} 个拥有焦点的页面, 这不符合预期。将使用最后一个。`);
        const lastPage = focusedPages[focusedPages.length - 1];
        await lastPage.bringToFront();
        return lastPage;
    }
}

// API端点：打开URL
app.post('/open-url', async (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }
    try {
        const page = await getActivePage();
        await page.goto(url);
        res.json({ message: `已成功打开网址: ${url}` });
    } catch (e) {
        res.status(500).json({ error: `操作失败: ${e.message}` });
    }
});

// API端点：获取页面内容
app.get('/get-content', async (req, res) => {
    try {
        const page = await getActivePage();
        await page.evaluate(() => {
            document.querySelectorAll('.interaction-label').forEach(el => el.remove());
        });
        const content = await page.evaluate(() => {
            const cleanBody = document.body.cloneNode(true);
            cleanBody.querySelectorAll('script, style, noscript, svg, header, footer, nav, .interaction-label').forEach(el => el.remove());
            let text = cleanBody.innerText;
            text = text.replace(/(\r\n|\n|\r){3,}/g, '\n\n').replace(/(\t| ){2,}/g, ' ');
            return text.trim().slice(0, 4000);
        });
        res.json({ content: `当前页面内容摘要:\n${content}` });
    } catch (e) {
        res.status(500).json({ error: `操作失败: ${e.message}` });
    }
});

// 新增: 扫描并标记页面上的可交互元素
app.get('/label-elements', async (req, res) => {
    try {
        const page = await getActivePage();
        const labeledElements = await page.evaluate(() => {
            document.querySelectorAll('.interaction-label').forEach(el => el.remove());
            const elements = Array.from(document.querySelectorAll(
                'a, button, input:not([type=hidden]), [role=button], textarea, select, [tabindex]:not([tabindex="-1"])'
            ));
            const visibleElements = [];
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;
            for (const el of elements) {
                const rect = el.getBoundingClientRect();
                if (rect.top >= 0 && rect.left >= 0 && rect.bottom <= viewportHeight && rect.right <= viewportWidth && rect.width > 0 && rect.height > 0 && el.checkVisibility()) {
                    visibleElements.push(el);
                }
            }
            const elementInfos = [];
            visibleElements.forEach((el, index) => {
                const id = index + 1;
                el.setAttribute('data-interaction-id', id);
                const label = document.createElement('div');
                label.textContent = id;
                label.className = 'interaction-label';
                const rect = el.getBoundingClientRect();
                Object.assign(label.style, {
                    position: 'absolute',
                    top: `${window.scrollY + rect.top}px`, left: `${window.scrollX + rect.left}px`,
                    padding: '2px 4px', backgroundColor: 'rgba(255, 165, 0, 0.9)', color: 'black',
                    fontSize: '12px', fontWeight: 'bold', borderRadius: '4px', zIndex: '2147483647',
                    pointerEvents: 'none',
                });
                document.body.appendChild(label);
                let text = el.innerText || el.value || el.placeholder || el.ariaLabel || el.name;
                elementInfos.push({ id, text: text ? text.trim().slice(0, 100) : "", tagName: el.tagName.toLowerCase() });
            });
            return elementInfos;
        });
        res.json({ elements: labeledElements });
    } catch (e) {
        res.status(500).json({ error: `操作失败: ${e.message}` });
    }
});

// 修改: 根据交互ID点击元素
app.post('/click-element', async (req, res) => {
    const { id } = req.body;
    if (id === undefined) { return res.status(400).json({ error: '缺少目标元素的ID' }); }
    try {
        const page = await getActivePage();
        const selector = `[data-interaction-id="${id}"]`;
        await page.locator(selector).first().click({ timeout: 5000 });
        res.json({ message: `已成功点击ID为 "${id}" 的元素` });
    } catch (e) {
        res.status(500).json({ error: `操作失败: ${e.message}` });
    }
});

// 修改: 在指定ID的元素中输入文本
app.post('/type-in-element', async (req, res) => {
    const { id, text } = req.body;
    if (id === undefined || text === undefined) { return res.status(400).json({ error: '缺少ID或文本' }); }
    try {
        const page = await getActivePage();
        const selector = `[data-interaction-id="${id}"]`;
        const locator = page.locator(selector).first();
        await locator.click({ timeout: 5000 });
        await locator.clear({ timeout: 5000 });
        await locator.type(text, { timeout: 5000, delay: 50 });
        res.json({ message: `已在ID为 "${id}" 的元素中输入文本` });
    } catch (e) {
        res.status(500).json({ error: `操作失败: ${e.message}` });
    }
});

// 新增: 滚动页面
app.post('/scroll', async (req, res) => {
    const { direction } = req.body;
    if (!direction) { return res.status(400).json({ error: '缺少滚动方向' }); }
    try {
        const page = await getActivePage();
        await page.evaluate((dir) => {
            const scrollAmount = window.innerHeight * 0.8;
            window.scrollBy(0, dir === 'down' ? scrollAmount : -scrollAmount);
        }, direction);
        res.json({ message: `已向${direction === 'down' ? '下' : '上'}滚动页面` });
    } catch (e) {
        res.status(500).json({ error: `操作失败: ${e.message}` });
    }
});

// 新增: 返回上一页
app.get('/go-back', async (req, res) => {
    try {
        const page = await getActivePage();
        await page.goBack();
        res.json({ message: '已返回上一页。' });
    } catch (e) {
        res.status(500).json({ error: `操作失败: ${e.message}` });
    }
});

// 新增: 前进到下一页
app.get('/go-forward', async (req, res) => {
    try {
        const page = await getActivePage();
        await page.goForward();
        res.json({ message: '已前进到下一页。' });
    } catch (e) {
        res.status(500).json({ error: `操作失败: ${e.message}` });
    }
});

// 新增: 刷新当前页面
app.get('/refresh-page', async (req, res) => {
    try {
        const page = await getActivePage();
        await page.reload();
        res.json({ message: '已刷新当前页面。' });
    } catch (e) {
        res.status(500).json({ error: `操作失败: ${e.message}` });
    }
});

// 新增: 关闭当前页面
app.get('/close-page', async (req, res) => {
    try {
        const page = await getActivePage();
        await page.close();
        res.json({ message: '已关闭当前页面。' });
    } catch (e) {
        res.status(500).json({ error: `操作失败: ${e.message}` });
    }
});

app.listen(port, () => {
    console.log(`[Browser Control Server] Listening on http://localhost:${port}`);
    console.log('这个服务器负责接收指令并控制Edge浏览器。');
    console.log('请不要关闭这个窗口，让它在后台运行。');
}); 