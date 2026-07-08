#!/usr/bin/env node
/**
 * AI Code Reviewer — GitHub Action
 * 监听 PR → DeepSeek 审查 → 评论区返回建议
 */

const fs = require("fs");
const path = require("path");

// ============ 配置加载 ============

const CONFIG = {
  apiKey: process.env.INPUT_API_KEY || "",
  model: process.env.INPUT_MODEL || "deepseek-chat",
  baseUrl: process.env.INPUT_BASE_URL || "https://api.deepseek.com/v1",
  reviewScope: process.env.INPUT_REVIEW_SCOPE || "changed",
  language: process.env.INPUT_LANGUAGE || "zh-CN",
  maxTokens: parseInt(process.env.INPUT_MAX_TOKENS || "2000", 10),
};

const GITHUB = {
  token: process.env.GITHUB_TOKEN || "",
  repository: process.env.GITHUB_REPOSITORY || "",
  eventPath: process.env.GITHUB_EVENT_PATH || "",
  eventName: process.env.GITHUB_EVENT_NAME || "",
};

// ============ GitHub API 封装 ============

async function githubApi(endpoint, opts = {}) {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `https://api.github.com/repos/${GITHUB.repository}/${endpoint.replace(/^\//, "")}`;

  const headers = {
    Authorization: `Bearer ${GITHUB.token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "CodeReviewBot/1.0",
    ...opts.headers,
  };

  const resp = await fetch(url, { ...opts, headers });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`GitHub API ${resp.status}: ${body.slice(0, 300)}`);
  }
  return resp.json();
}

// ============ PR 信息提取 ============

function getPRFromEvent() {
  if (!GITHUB.eventPath || !fs.existsSync(GITHUB.eventPath)) {
    throw new Error("无法读取 GitHub Event: event_path 不存在");
  }
  const event = JSON.parse(fs.readFileSync(GITHUB.eventPath, "utf-8"));

  // pull_request 事件
  if (event.pull_request) {
    return {
      number: event.pull_request.number,
      title: event.pull_request.title,
      body: event.pull_request.body || "",
      base: event.pull_request.base.ref,
      head: event.pull_request.head.ref,
      url: event.pull_request._links?.html?.href || event.pull_request.html_url,
      diffUrl: event.pull_request.diff_url,
    };
  }

  // issue_comment 事件（对 PR 的评论）
  if (event.issue?.pull_request) {
    return {
      number: event.issue.number,
      title: event.issue.title,
      body: event.issue.body || "",
      url: event.issue.pull_request?.html_url || event.issue.html_url,
    };
  }

  throw new Error(`不支持的事件类型: ${GITHUB.eventName}。请在 pull_request 或 pull_request_target 事件中使用。`);
}

// ============ AI 审查核心 ============

const SYSTEM_PROMPT = `你是一个资深代码审查专家。审查以下 Pull Request 的代码变更。

## 审查规范
1. **正确性**：逻辑错误、边界条件、空值处理、异常处理
2. **安全性**：注入漏洞、敏感信息泄露、权限问题
3. **性能**：不必要的循环、内存泄漏、N+1 查询、阻塞操作
4. **可维护性**：命名规范、函数长度、重复代码、注释缺失
5. **最佳实践**：框架习惯用法、类型安全、测试覆盖

## 输出格式
请用中文输出，按以下结构组织：

### 🔴 严重问题（必须修复）
- 【位置】文件名:行号范围
- 【问题】描述
- 【建议】修复方案（含代码示例）

### 🟡 改进建议
- 【位置】文件名
- 【问题】描述
- 【建议】改进方案

### 💡 最佳实践提示
- 简短建议

### ✅ 审查总结
用一两句话总结本次审查的整体评价。

如果没有发现严重问题，请明确说"未发现严重问题"。只评论代码变更，不要评论 PR 标题或描述。`;

async function reviewDiff(diff) {
  if (!diff || diff.trim().length === 0) {
    return "无法获取代码变更内容，请检查 PR diff。";
  }

  // 截断过大的 diff（DeepSeek 上下文限制）
  const MAX_DIFF = 30000;
  const truncated = diff.length > MAX_DIFF
    ? diff.slice(0, MAX_DIFF) + "\n\n... (diff 过大，已截断，仅审查前 30KB)"
    : diff;

  const userPrompt = `请审查以下代码变更：\n\n\`\`\`diff\n${truncated}\n\`\`\``;

  const resp = await fetch(`${CONFIG.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CONFIG.apiKey}`,
    },
    body: JSON.stringify({
      model: CONFIG.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      max_tokens: CONFIG.maxTokens,
      temperature: 0.1,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`DeepSeek API ${resp.status}: ${err.slice(0, 500)}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content || "审查未生成有效输出";
}

// ============ 发布评论 ============

async function postPRComment(prNumber, body) {
  const endpoint = `/issues/${prNumber}/comments`;
  return githubApi(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      body: `🤖 **AI 代码审查报告** — CodeReviewBot\n\n${body}\n\n---\n<sub>由 DeepSeek 驱动 | 审查范围: ${CONFIG.reviewScope}</sub>`,
    }),
  });
}

// ============ 主流程 ============

async function main() {
  // 1. 校验配置
  if (!CONFIG.apiKey) {
    throw new Error("缺少 API Key! 请在 Action 中设置 api_key 参数或 DEEPSEEK_API_KEY secret。");
  }
  if (!GITHUB.token) {
    throw new Error("缺少 GITHUB_TOKEN! 请在 workflow 中设置 permissions.contents: read 和 permissions.pull-requests: write。");
  }

  console.log("🤖 CodeReviewBot 启动...");
  console.log(`  模型: ${CONFIG.model}`);
  console.log(`  范围: ${CONFIG.reviewScope}`);

  // 2. 获取 PR 信息
  const pr = getPRFromEvent();
  console.log(`  PR: #${pr.number} — ${pr.title}`);
  console.log(`  分支: ${pr.base} ← ${pr.head}`);

  // 3. 获取 diff
  let diff;
  if (pr.diffUrl) {
    console.log(`  获取 diff: ${pr.diffUrl}`);
    const resp = await fetch(pr.diffUrl, {
      headers: { Authorization: `Bearer ${GITHUB.token}`, Accept: "application/vnd.github.diff" },
    });
    diff = resp.ok ? await resp.text() : "";
  } else {
    // 没有直接 diff_url，用 compare API
    const compareData = await githubApi(`/compare/${pr.base}...${pr.head}`);
    diff = compareData.diff || compareData.files?.map(f => f.patch).join("\n") || "";
  }
  console.log(`  diff 大小: ${diff.length} 字符`);

  // 4. AI 审查
  console.log("  AI 审查中...");
  const review = await reviewDiff(diff);
  console.log(`  审查完成 (${review.length} 字)`);

  // 5. 发布评论
  await postPRComment(pr.number, review);
  console.log("✅ 审查评论已发布到 PR");
}

main().catch((err) => {
  console.error(`❌ 审查失败: ${err.message}`);
  process.exit(1);
});
