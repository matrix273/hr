"""重建 Milvus 集合，修改维度为 1024"""

from pymilvus import connections, Collection, CollectionSchema, FieldSchema, DataType, utility

# 连接到 Milvus
connections.connect("default", host="localhost", port="19530")

COLLECTION_NAME = "resumes"

# 如果集合存在，先删除
if COLLECTION_NAME in utility.list_collections():
    print(f"删除现有集合: {COLLECTION_NAME}")
    utility.drop_collection(COLLECTION_NAME)

# 定义新的集合 schema，使用 1024 维度
fields = [
    FieldSchema(name="id", dtype=DataType.INT64, is_primary=True, auto_id=True),
    FieldSchema(name="resume_id", dtype=DataType.VARCHAR, max_length=255),
    FieldSchema(name="resume_text", dtype=DataType.VARCHAR, max_length=65535),
    FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=1024)  # 修改为 1024
]

schema = CollectionSchema(fields, "Resume embeddings collection")

# 创建新集合
print(f"创建新集合: {COLLECTION_NAME}, 维度: 1024")
collection = Collection(COLLECTION_NAME, schema)

# 创建索引
index_params = {
    "metric_type": "L2",
    "index_type": "IVF_FLAT",
    "params": {"nlist": 128}
}
collection.create_index("embedding", index_params)
print("索引创建成功")

# 加载集合到内存
collection.load()
print("集合已加载到内存")

# 断开连接
connections.disconnect("default")
print("\n✓ Milvus 集合重建完成！")
print("  集合名:", COLLECTION_NAME)
print("  维度: 1024")
print("  请重启 Celery worker 和后端服务")
