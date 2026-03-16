# Qwen3-Reranker-0.6B 本地部署指南

## 📋 模型信息

- **模型名称**: Qwen3-Reranker-0.6B
- **模型地址**: https://huggingface.co/Qwen/Qwen3-Reranker-0.6B
- **模型大小**: ~1.2GB
- **显存需求**: ~2-4GB（FP16）或 ~4-8GB（FP32）

## 🚀 快速部署

### 步骤 1：安装依赖

```bash
cd /Users/matrix273/PycharmProjects/hr

# 激活虚拟环境（uv）
source .venv/bin/activate

# 安装必要依赖
uv pip install transformers torch fastapi uvicorn
```

### 步骤 2：启动服务

```bash
# 方式 1：使用启动脚本
chmod +x backend/start-reranker.sh
./backend/start-reranker.sh

# 方式 2：直接运行
python backend/start-reranker.py --host 0.0.0.0 --port 8001
```

### 步骤 3：验证服务

```bash
curl -X POST http://localhost:8001/v1/rerank \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Qwen3-Reranker-0.6B",
    "query": "机器学习工程师",
    "documents": [
      "有 5 年机器学习经验",
      "前端开发工程师",
      "熟悉深度学习框架"
    ],
    "top_k": 2
  }'
```

## ⚙️ 配置说明

### .env 配置

本地部署时，修改 `.env` 文件：

```bash
QWEN_RERANKER_URL=http://localhost:8001/v1/rerank
QWEN_RERANKER_API_KEY=not_required
QWEN_RERANKER_MODEL=Qwen3-Reranker-0.6B
```

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| RERANKER_HOST | 0.0.0.0 | 绑定主机 |
| RERANKER_PORT | 8001 | 服务端口 |

## 🔧 高级配置

### 使用 GPU 加速

确保已安装 CUDA 版本的 PyTorch：

```bash
pip install torch --index-url https://download.pytorch.org/whl/cu118
```

### 调整模型精度

编辑 `start-reranker.py`，修改精度设置：

```python
# FP16（推荐，显存占用低）
torch_dtype=torch.float16

# FP32（高精度，显存占用高）
torch_dtype=torch.float32

# BF16（如果硬件支持）
torch_dtype=torch.bfloat16
```

### 批量处理

如果需要批量处理，可以修改模型配置：

```python
model = AutoModelForSequenceClassification.from_pretrained(
    MODEL_NAME,
    trust_remote_code=True,
    torch_dtype=torch.float16 if DEVICE == "cuda" else torch.float32
).to(DEVICE)

# 批量推理时使用
with torch.no_grad():
    outputs = model(**inputs)
```

## 📊 性能优化

### 显存优化

1. **使用 FP16**：
   - 显存需求减少约 50%
   - 精度损失极小

2. **量化模型**：
   ```python
   from transformers import BitsAndBytesConfig

   quantization_config = BitsAndBytesConfig(
       load_in_8bit=True,
       bnb_4bit_compute_dtype=torch.float16
   )

   model = AutoModelForSequenceClassification.from_pretrained(
       MODEL_NAME,
       quantization_config=quantization_config
   )
   ```

### 吞吐量优化

1. **增加 workers**：
   ```bash
   python start-reranker.py --workers 2
   ```

2. **使用缓存**：
   ```python
   from functools import lru_cache

   @lru_cache(maxsize=1000)
   def cached_rerank(query_hash, docs_hash):
       # 实现缓存逻辑
       pass
   ```

## 🧪 测试 API

### Python 测试脚本

```python
import requests

url = "http://localhost:8001/v1/rerank"
payload = {
    "model": "Qwen3-Reranker-0.6B",
    "query": "Python 开发工程师",
    "documents": [
        "有 3 年 Python 开发经验",
        "Java 开发工程师",
        "熟悉 Django 和 Flask 框架",
        "React 前端开发"
    ],
    "top_k": 3
}

response = requests.post(url, json=payload)
results = response.json()

for i, result in enumerate(results["results"], 1):
    print(f"{i}. Score: {result['relevance_score']:.4f}")
    print(f"   {result['document']}")
```

### 健康检查

```bash
# 检查服务状态
curl http://localhost:8001/health

# 检查模型信息
curl http://localhost:8001/
```

## 🔍 故障排查

### 问题 1：模型下载慢

```bash
# 使用镜像站点
export HF_ENDPOINT=https://hf-mirror.com
python start-reranker.py
```

### 问题 2：CUDA 内存不足

```bash
# 减小 batch size 或使用 CPU
# 在 start-reranker.py 中修改
DEVICE = "cpu"  # 强制使用 CPU
```

### 问题 3：端口占用

```bash
# 检查端口占用
lsof -i :8001

# 使用其他端口
python start-reranker.py --port 8002
```

### 问题 4：模型加载失败

```bash
# 清除缓存并重新下载
rm -rf ~/.cache/huggingface
python start-reranker.py
```

## 📈 监控和日志

### 查看日志

```bash
# 启动时查看日志
./start-reranker.sh 2>&1 | tee reranker.log

# 实时查看日志
tail -f reranker.log
```

### 性能监控

```bash
# GPU 监控
watch -n 1 nvidia-smi

# 系统资源监控
htop
```

## 🔐 安全配置

### 添加认证（可选）

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import APIKeyHeader

API_KEY = "your-secret-key"
api_key_header = APIKeyHeader(name="X-API-Key")

async def verify_api_key(api_key: str = Depends(api_key_header)):
    if api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API Key")
    return api_key

@app.post("/v1/rerank", dependencies=[Depends(verify_api_key)])
async def rerank(request: RerankRequest):
    # ...
```

## 📚 相关资源

- **Hugging Face 模型页面**: https://huggingface.co/Qwen/Qwen3-Reranker-0.6B
- **Qwen 文档**: https://qwen.readthedocs.io/
- **Transformers 文档**: https://huggingface.co/docs/transformers

## 💡 最佳实践

1. **首次部署**：先用 CPU 测试，确认服务正常运行后再使用 GPU
2. **生产环境**：使用 Docker 部署，便于管理和扩展
3. **监控**：设置健康检查和日志监控
4. **备份**：定期备份模型权重和配置

## 🔄 更新模型

```bash
# 删除旧模型缓存
rm -rf ~/.cache/huggingface/hub/models--Qwen--Qwen3-Reranker-0.6B

# 重新下载最新版本
python start-reranker.py
```
