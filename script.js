const DEEPSEEK_API_KEY = 'sk-98d07b0e47974995a597176a3d9ac765'; // 替换为你的 API Key
const CHAT_HISTORY_KEY = 'deepseek_chat_history';
const HISTORY_EXPIRE_DAYS = 3; // 历史记录保存天数

// 加载历史记录
let conversationHistory = loadChatHistory();

// 初始化页面
function init() {
    const chatBox = document.getElementById('chatBox');
    chatBox.innerHTML = ''; // 清空当前内容

    // 加载历史记录到页面
    conversationHistory.forEach(msg => {
        appendMessage(msg.content, msg.role === 'user' ? 'user' : 'bot');
    });

    // 绑定回车键发送
    document.getElementById('input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // 阻止默认换行
            sendMessage();
        }
    });
}

// 发送消息
async function sendMessage() {
    const input = document.getElementById('input');
    const message = input.value.trim();
    if (!message) return;

    // 添加用户消息
    appendMessage(message, 'user');
    conversationHistory.push({ role: 'user', content: message, timestamp: Date.now() });
    saveChatHistory();
    input.value = '';

    try {
        // 调用 DeepSeek API
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', { // 请确保 URL 正确
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: conversationHistory.map(msg => ({ role: msg.role, content: msg.content })),
                temperature: 0.7,
                stream: true // 启用流式响应
            })
        });

        if (!response.ok) throw new Error(`HTTP 错误 ${response.status}`);

        // 流式读取响应
        const reader = response.body.getReader();
        let botMessage = { role: 'assistant', content: '', timestamp: Date.now() };
        appendMessage('', 'bot'); // 初始化空消息

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = new TextDecoder().decode(value);
            console.log('响应数据块：', text); // 调试日志
            const lines = text.split('\n').filter(line => line.trim());

            for (const line of lines) {
                if (line.trim() === '[DONE]') {
                    console.log('检测到 [DONE] 标记，跳过此行');
                    continue; // 跳过 [DONE] 行
                }

                let data;
                try {
                    data = JSON.parse(line.replace('data: ', '')); // 解析 JSON 响应
                } catch (parseError) {
                    console.error('解析 JSON 数据时出错：', parseError);
                    console.log('原始数据行：', line);
                    continue; // 如果解析失败，跳过此行
                }

                if (data.choices && data.choices[0].delta.content) {
                    botMessage.content += data.choices[0].delta.content;
                    updateLastMessage(botMessage.content);
                }
            }
        }

        // 保存 AI 回复
        conversationHistory.push(botMessage);
        saveChatHistory();

    } catch (error) {
        appendMessage(`请求失败：${error.message}`, 'error');
    }
}

// 添加消息到聊天框
function appendMessage(content, type) {
    const chatBox = document.getElementById('chatBox');
    const messageDiv = document.createElement('div');

    messageDiv.className = `message ${type}-message`;
    messageDiv.textContent = content;

    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight; // 自动滚动到底部
}

// 更新最后一条消息（用于流式响应）
function updateLastMessage(content) {
    const chatBox = document.getElementById('chatBox');
    const lastMessage = chatBox.lastChild;
    if (lastMessage) lastMessage.textContent = content;
}

// 加载历史记录
function loadChatHistory() {
    const history = JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY)) || [];
    const now = Date.now();
    return history.filter(msg => now - msg.timestamp < HISTORY_EXPIRE_DAYS * 24 * 60 * 60 * 1000);
}

// 保存历史记录
function saveChatHistory() {
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(conversationHistory));
}

// 初始化页面
init();