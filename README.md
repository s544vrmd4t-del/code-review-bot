# 🤖 CodeReviewBot

PR 提交后自动 AI 代码审查 — DeepSeek 驱动，结果直接评论到 PR。

## 快速使用

```yaml
# .github/workflows/ai-review.yml
name: AI Code Review

on:
  pull_request:
    types: [opened, synchronize]

permissions:
  contents: read
  pull-requests: write

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: code-review-bot/review@v1
        with:
          api_key: ${{ secrets.DEEPSEEK_API_KEY }}
```

## 效果

PR 提交后机器人自动在评论区回复审查报告：

```
🤖 AI 代码审查报告 — CodeReviewBot

### 🔴 严重问题
- 【位置】auth.js:45-52 密码明文存储...

### 🟡 改进建议
- ...

### ✅ 审查总结
本次 PR 整体质量良好...
```

## 配置项

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `api_key` | (必填) | DeepSeek API Key |
| `model` | `deepseek-chat` | 模型名称 |
| `review_scope` | `changed` | 审查范围 |
| `language` | `zh-CN` | 输出语言 |

## 定价

| 方案 | 价格 |
|------|------|
| 公开仓库 | 免费 |
| 私人仓库 | $9/月 |

## 隐私

- 代码仅发送到 DeepSeek API 用于审查
- 不存储、不记录、不训练
