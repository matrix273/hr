# Qwen3-Embedding-0.6B 本地部署指南

## 📋 模型信息

- **模型名称**: Qwen3-Embedding-0.6B
- **模型地址**: https://huggingface.co/Qwen/Qwen2.5-0.6B-Instruct
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

### 步骤 2：下载模型

```bash
# 使用 huggingface-cli 下载（推荐）
huggingface-cli download Qwen/Qwen2.5-0.6B-Instruct --local-dir backend/app/models/Qwen/Qwen3_Embedding_0.6B

# 或使用 git-lfs
cd backend/app/models/Qwen
git lfs install
git clone https://huggingface.co/Qwen/Qwen2.5-0.6B-Instruct Qwen3_Embedding_0.6B
```

### 步骤 3：启动服务

```bash
# 方式 1：使用启动脚本
chmod +x backend/start-embedding.sh
./backend/start-embedding.sh

# 方式 2：直接运行
python backend/start-embedding.py --host 0.0.0.0 --port 8010
```

### 步骤 4：验证服务

```bash
curl -X POST http://localhost:8010/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Qwen3-Embedding-0.6B",
    "input": ["机器学习工程师", "前端开发工程师"]
  }'
```

## ⚙️ 配置说明

### .env 配置

本地部署时，修改 `.env` 文件：

```bash
QWEN_EMBEDDING_URL=http://localhost:8010/v1/embeddings
QWEN_EMBEDDING_API_KEY=not_required
QWEN_EMBEDDING_MODEL=Qwen3-Embedding-0.6B
```

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| EMBEDDING_HOST | 0.0.0.0 | 绑定主机 |
| EMBEDDING_PORT | 8010 | 服务端口 |
| EMBEDDING_MODEL_PATH | backend/app/models/Qwen/Qwen3_Embedding_0.6B | 模型路径 |

## 🔧 高级配置

### 使用远程模型

```bash
EMBEDDING_MODEL_PATH=Qwen/Qwen2.5-0.6B-Instruct python backend/start-embedding.py
```

### 使用 GPU 加速

确保已安装 CUDA 版本的 PyTorch：

```bash
pip install torch --index-url https://download.pytorch.org/whl/cu118
```

### 调整模型精度

编辑 `backend/start-embedding.py`，修改精度设置：

```python
# FP16（推荐，显存占用低）
torch_dtype=torch.float16

# FP32（高精度，显存占用高）
torch_dtype=torch.float32

# BF16（如果硬件支持）
torch_dtype=torch.bfloat16
```

## 🧪 测试 API

### Python 测试脚本

```python
import requests

url = "http://localhost:8010/v1/embeddings"
payload = {
    "model": "Qwen3-Embedding-0.6B",
    "input": [
        "有 5 年机器学习经验",
        "Java 开发工程师",
        "熟悉深度学习框架"
    ]
}

response = requests.post(url, json=payload)
result = response.json()

print(f"Total embeddings: {len(result['data'])}")
for item in result['data']:
    print(f"Index {item['index']}: {len(item['embedding'])} dimensions")
```

### 健康检查

```bash
# 检查服务状态
curl http://localhost:8010/health

# 检查模型信息
curl http://localhost:8010/
```

## 🔍 故障排查

### 问题 1：模型下载慢

```bash
# 使用镜像站点
export HF_ENDPOINT=https://hf-mirror.com
python backend/start-embedding.py
```

### 问题 2：CUDA 内存不足

```bash
# 减小 batch size 或使用 CPU
# 在 backend/start-embedding.py 中修改
DEVICE = "cpu"  # 强制使用 CPU
```

### 问题 3：端口占用

```bash
# 检查端口占用
lsof -i :8010

# 使用其他端口
python backend/start-embedding.py --port 8011
```

### 问题 4：模型加载失败

```bash
# 清除缓存并重新下载
rm -rf ~/.cache/huggingface
python backend/start-embedding.py
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

   model = AutoModel.from_pretrained(
       MODEL_NAME,
       quantization_config=quantization_config
   )
   ```

### 吞吐量优化

1. **增加 workers**：
   ```bash
   python backend/start-embedding.py --workers 2
   ```

2. **批量处理**：
   API 已经支持批量输入，一次请求处理多个文本

## 🔄 和 Reranker 配合使用

### 同时启动两个服务

```bash
# 终端 1：启动 Embedding 服务
./backend/start-embedding.sh

# 终端 2：启动 Reranker 服务
./backend/start-reranker.sh
```

### 配置 .env

```bash
# Embedding 服务
QWEN_EMBEDDING_URL=http://localhost:8010/v1/embeddings
QWEN_EMBEDDING_API_KEY=not_required
QWEN_EMBEDDING_MODEL=Qwen3-Embedding-0.6B

# Reranker 服务
QWEN_RERANKER_URL=http://localhost:8001/v1/rerank
QWEN_RERANKER_API_KEY=not_required
QWEN_RERANKER_MODEL=Qwen3-Reranker-0.6B
```

## 📚 相关资源

- **Hugging Face 模型页面**: https://huggingface.co/Qwen/Qwen2.5-0.6B-Instruct
- **Qwen 文档**: https://qwen.readthedocs.io/
- **Transformers 文档**: https://huggingface.co/docs/transformers
