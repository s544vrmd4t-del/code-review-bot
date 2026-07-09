标题：🤖 写了个免费的 AI 代码审查 GitHub Action，DeepSeek 驱动

## 它能干嘛
每次提 PR，自动用 AI 审查代码变更，发现的 bug 和隐患直接评论到 PR 里。

重点：
- 🔴 严重问题（SQL注入、密码硬编码、XSS...）
- 🟡 改进建议（命名、性能、最佳实践）
- 💡 一行总结
- 🇨🇳 中文输出，无语言障碍

## Demo
https://github.com/s544vrmd4t-del/code-review-bot/pull/1

## 接入方式
```yaml
- uses: s544vrmd4t-del/code-review-bot@v1
  with:
    api_key: ${{ secrets.DEEPSEEK_API_KEY }}
```

两行代码，公开仓库免费。

## 为什么不用 CodeRabbit
- CodeRabbit $12/月，这个公开仓库免费
- DeepSeek 审查质量不输 GPT-4
- 中文报告，国内团队友好
- MIT 开源，代码随便看

## 后续计划
- [ ] Inline comment（评论到具体代码行）
- [ ] 自定义审查规则
- [ ] 支持 Claude/GPT 模型

欢迎 star，提需求直接开 issue。
