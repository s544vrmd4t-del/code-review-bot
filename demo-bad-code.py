"""
演示用 — 故意放一些代码问题让 AI 审查发现
"""
import os
import json

# 问题1: 密码硬编码
DB_PASSWORD = "admin123"

# 问题2: SQL注入风险
def get_user(username):
    query = f"SELECT * FROM users WHERE name = '{username}'"
    return query

# 问题3: 空 except
def read_config(path):
    try:
        with open(path) as f:
            return json.load(f)
    except:
        return {}

# 问题4: 不安全的反序列化
def load_data(data):
    return eval(data)

# 问题5: API key 暴露在代码中
API_KEY = "sk-abc123def456ghi789"

# 问题6: 无限循环风险
def retry_request(url, max_retries=10):
    for i in range(max_retries):
        try:
            return os.popen(f"curl {url}").read()
        except:
            pass  # 没有 sleep/backoff
