# PostgreSQL 数据库配置

## 1. 启动 PostgreSQL

使用 Docker Compose 启动 PostgreSQL 数据库：

```bash
docker-compose up -d postgres
```

或者启动所有服务：

```bash
docker-compose up -d
```

## 2. 环境配置

确保 `.env` 文件包含以下配置：

```env
# PostgreSQL Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=hr_user
POSTGRES_PASSWORD=hr_password
POSTGRES_DB=hr
```

## 3. 数据库连接

应用启动时会自动：
- 连接到 PostgreSQL 数据库
- 创建所需的表（users 表）
- 创建默认管理员用户（如果不存在）

默认管理员账号：
- 用户名：`admin`
- 密码：`admin123`

## 4. 数据库配置

确保 `.env` 文件中的配置正确：

```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=pgadmin
POSTGRES_PASSWORD=pgadmin
POSTGRES_DB=hr
```

## 5. 数据库表结构

### users 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR(50) | 用户ID（主键） |
| username | VARCHAR(50) | 用户名（唯一） |
| email | VARCHAR(100) | 邮箱（唯一） |
| password_hash | VARCHAR(255) | 密码哈希 |
| full_name | VARCHAR(100) | 全名 |
| role | VARCHAR(20) | 角色（admin, manager, hr, recruiter, interviewer, user） |
| is_active | BOOLEAN | 是否激活 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

## 5. 数据管理

### 备份数据

```bash
docker exec hr-postgres pg_dump -U hr_user hr_db > backup.sql
```

### 恢复数据

```bash
cat backup.sql | docker exec -i hr-postgres psql -U hr_user -d hr
```

### 查看数据库

```bash
docker exec -it hr-postgres psql -U hr_user -d hr
```

### 常用 SQL 命令

```sql
-- 查看所有用户
SELECT id, username, email, role, is_active, created_at FROM users;

-- 查看特定用户
SELECT * FROM users WHERE username = 'admin';

-- 禁用用户
UPDATE users SET is_active = false WHERE username = 'test_user';

-- 删除用户
DELETE FROM users WHERE username = 'test_user';

-- 修改用户角色
UPDATE users SET role = 'manager' WHERE username = 'test_user';
```

## 6. 故障排查

### 检查 PostgreSQL 状态

```bash
docker-compose ps postgres
```

### 查看日志

```bash
docker-compose logs postgres
```

### 测试连接

```bash
docker exec hr-postgres psql -U hr_user -d hr_db -c "SELECT version();"
```

### 重置数据库

```bash
docker-compose down -v
docker-compose up -d postgres
```
