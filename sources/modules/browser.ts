import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000';

// 工具：打开URL
export async function toolBrowserOpenUrl(url: string): Promise<string> {
    try {
        const response = await axios.post(`${API_BASE_URL}/open-url`, { url });
        return response.data.message;
    } catch (e: any) {
        const errorMsg = e.response?.data?.error || e.message;
        return `打开网址失败: ${errorMsg}`;
    }
}

// 工具：获取当前页面内容
export async function toolBrowserGetContent(): Promise<string> {
    try {
        const response = await axios.get(`${API_BASE_URL}/get-content`);
        return response.data.content;
    } catch (e: any) {
        const errorMsg = e.response?.data?.error || e.message;
        return `获取页面内容失败: ${errorMsg}`;
    }
}

// 新工具：扫描并标记页面上的可交互元素
export async function toolBrowserLabelElements(): Promise<string> {
    try {
        const response = await axios.get(`${API_BASE_URL}/label-elements`);
        const elements = response.data.elements;
        if (!elements || elements.length === 0) {
            return "当前页面可视区域内没有发现可以交互的元素。可以尝试滚动页面后再扫描。";
        }
        const formattedElements = elements.map((e: any) => `ID ${e.id}: [${e.tagName}] "${e.text}"`).join('\n');
        return `发现以下可以交互的元素:\n${formattedElements}`;
    } catch (e: any) {
        const errorMsg = e.response?.data?.error || e.message;
        return `扫描页面元素失败: ${errorMsg}`;
    }
}

// 修改工具：根据ID点击元素
export async function toolBrowserClickElement(id: number): Promise<string> {
    try {
        const response = await axios.post(`${API_BASE_URL}/click-element`, { id });
        return response.data.message;
    } catch (e: any) {
        const errorMsg = e.response?.data?.error || e.message;
        return `点击元素失败: ${errorMsg}`;
    }
}

// 修改工具：在指定ID的元素中输入文本
export async function toolBrowserTypeInElement(id: number, text: string): Promise<string> {
    try {
        const response = await axios.post(`${API_BASE_URL}/type-in-element`, { id, text });
        return response.data.message;
    } catch (e: any) {
        const errorMsg = e.response?.data?.error || e.message;
        return `输入文本失败: ${errorMsg}`;
    }
}

// 新工具：滚动页面
export async function toolBrowserScroll(direction: 'up' | 'down'): Promise<string> {
    try {
        const response = await axios.post(`${API_BASE_URL}/scroll`, { direction });
        return response.data.message;
    } catch (e: any) {
        const errorMsg = e.response?.data?.error || e.message;
        return `滚动页面失败: ${errorMsg}`;
    }
}

// 新工具：返回上一页
export async function toolBrowserGoBack(): Promise<string> {
    try {
        const response = await axios.get(`${API_BASE_URL}/go-back`);
        return response.data.message;
    } catch (e: any) {
        const errorMsg = e.response?.data?.error || e.message;
        return `返回上一页失败: ${errorMsg}`;
    }
}

// 新工具：前进到下一页
export async function toolBrowserGoForward(): Promise<string> {
    try {
        const response = await axios.get(`${API_BASE_URL}/go-forward`);
        return response.data.message;
    } catch (e: any) {
        const errorMsg = e.response?.data?.error || e.message;
        return `前进失败: ${errorMsg}`;
    }
}

// 新工具：刷新当前页面
export async function toolBrowserRefreshPage(): Promise<string> {
    try {
        const response = await axios.get(`${API_BASE_URL}/refresh-page`);
        return response.data.message;
    } catch (e: any) {
        const errorMsg = e.response?.data?.error || e.message;
        return `刷新页面失败: ${errorMsg}`;
    }
}

// 新工具：关闭当前页面
export async function toolBrowserClosePage(): Promise<string> {
    try {
        const response = await axios.get(`${API_BASE_URL}/close-page`);
        return response.data.message;
    } catch (e: any) {
        const errorMsg = e.response?.data?.error || e.message;
        return `关闭页面失败: ${errorMsg}`;
    }
}

// 这个函数不再需要，因为浏览器由独立的服务器管理
export async function closeBrowser() {
    // No-op
} 