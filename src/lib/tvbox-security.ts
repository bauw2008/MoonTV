// 用户代理池
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
];

// 请求限制器
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 800; // 基础请求间隔

// 请求计数器 - 用于防止请求过于频繁
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const MAX_REQUESTS_PER_MINUTE = 30; // 每个源每分钟最多30次请求

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// 智能延时：根据URL类型调整延时
function getSmartDelay(url: string): { min: number; max: number } {
  // 根据不同的API路径调整延时
  if (url.includes('/search') || url.includes('/wd=')) {
    return { min: 1000, max: 2000 }; // 搜索请求：1-2秒
  }
  if (url.includes('/videolist') || url.includes('/list')) {
    return { min: 500, max: 1200 }; // 列表请求：0.5-1.2秒
  }
  if (url.includes('/detail')) {
    return { min: 800, max: 1500 }; // 详情请求：0.8-1.5秒
  }
  return { min: 300, max: 800 }; // 默认：0.3-0.8秒
}

// 检查请求频率限制
function checkRateLimit(url: string): boolean {
  const domain = new URL(url).hostname;
  const now = Date.now();
  const minuteKey = `${domain}:${Math.floor(now / 60000)}`;

  const counter = requestCounts.get(minuteKey);
  if (!counter || now > counter.resetTime) {
    // 创建或重置计数器
    requestCounts.set(minuteKey, {
      count: 1,
      resetTime: now + 60000, // 1分钟后重置
    });
    return true;
  }

  if (counter.count >= MAX_REQUESTS_PER_MINUTE) {
    return false; // 超出限制
  }

  counter.count++;
  return true;
}

function smartRandomDelay(url: string): Promise<void> {
  const { min, max } = getSmartDelay(url);
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

// 随机延迟函数 - 用于防止被检测为爬虫
async function addRandomDelay(): Promise<void> {
  const delay = Math.random() * 500 + 200; // 200-700ms随机延迟
  return new Promise((resolve) => setTimeout(resolve, delay));
}

// 生成随机请求头
function generateRandomHeaders(url: string): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': getRandomUserAgent(),
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    Connection: 'keep-alive',
  };

  // 随机添加一些可选的请求头
  if (Math.random() > 0.5) {
    headers['Cache-Control'] = 'no-cache';
  }

  if (Math.random() > 0.7) {
    headers['Pragma'] = 'no-cache';
  }

  // 根据URL类型添加特定的Referer
  if (url.includes('/search') || url.includes('/wd=')) {
    headers['Referer'] = new URL(url).origin + '/';
  } else if (url.includes('/videolist') || url.includes('/list')) {
    headers['Referer'] = new URL(url).origin + '/index.html';
  }

  return headers;
}

/**
 * 安全的TVBox API请求函数
 * @param url 请求的URL
 * @param options 可选的请求选项
 * @returns Promise<Response> 返回响应对象
 */
export async function secureTvboxFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // 检查请求频率限制
  if (!checkRateLimit(url)) {
    throw new Error('请求过于频繁，请稍后再试');
  }

  // 请求限流：确保请求间隔
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest)
    );
  }
  lastRequestTime = Date.now();

  // 智能延时
  await smartRandomDelay(url);

  // 随机额外延迟
  if (Math.random() > 0.7) {
    await addRandomDelay();
  }

  // 合并请求选项
  const fetchOptions: RequestInit = {
    ...options,
    headers: {
      ...generateRandomHeaders(url),
      ...options.headers,
    },
  };

  // 添加超时控制
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时
  fetchOptions.signal = controller.signal;

  try {
    const response = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);

    if (!response.ok) {
      // 如果是429错误（太多请求），增加额外的延迟
      if (response.status === 429) {
        console.warn('收到429错误，增加延迟');
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    // 如果是网络错误或超时，记录并重抛
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('请求超时，请稍后重试');
    }

    throw error;
  }
}

/**
 * 安全的TVBox API数据获取函数
 * @param url 请求的URL
 * @returns Promise<T> 返回指定类型的数据
 */
export async function secureTvboxData<T>(url: string): Promise<T> {
  const response = await secureTvboxFetch(url);
  return await response.json();
}
