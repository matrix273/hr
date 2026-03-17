"""用户模型"""

import uuid
from sqlalchemy import Column, String, Boolean, DateTime, Text, Integer, Float
from sqlalchemy.sql import func
from ..database import Base


class User(Base):
    """用户模型"""
    __tablename__ = "users"

    id = Column(String(50), primary_key=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100))
    role = Column(String(20), nullable=False, default="user")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def to_dict(self):
        """转换为字典"""
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "full_name": self.full_name,
            "role": self.role,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class Resume(Base):
    """简历模型"""
    __tablename__ = "resumes"

    resume_id = Column(String(50), primary_key=True)
    original_filename = Column(String(255), nullable=False)
    file_size = Column(Integer, nullable=False)
    resume_text = Column(Text, nullable=False)
    user_id = Column(String(50), nullable=False)
    embedding_status = Column(String(20), default="pending", comment="embedding 处理状态: pending, processing, completed, failed")
    embedding_error = Column(Text, comment="embedding 处理错误信息")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def to_dict(self):
        """转换为字典"""
        return {
            "resume_id": self.resume_id,
            "filename": self.original_filename,
            "size": self.file_size,
            "resume_text": self.resume_text,
            "embedding_status": self.embedding_status,
            "embedding_error": self.embedding_error,
            "created_at": int(self.created_at.timestamp()) if self.created_at else None,
            "updated_at": int(self.updated_at.timestamp()) if self.updated_at else None,
            "user_id": self.user_id
        }


class Job(Base):
    """岗位模型"""
    __tablename__ = "jobs"

    job_id = Column(String(50), primary_key=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    requirements = Column(Text)
    experience_years = Column(Integer, comment="工作经验要求（年）")
    education = Column(String(50), comment="学历要求")
    certifications = Column(Text, comment="资格证书要求")
    salary_range = Column(String(100))
    location = Column(String(100))
    user_id = Column(String(50), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def to_dict(self):
        """转换为字典"""
        return {
            "job_id": self.job_id,
            "title": self.title,
            "description": self.description,
            "requirements": self.requirements,
            "experience_years": self.experience_years,
            "education": self.education,
            "certifications": self.certifications,
            "salary_range": self.salary_range,
            "location": self.location,
            "user_id": self.user_id,
            "created_at": int(self.created_at.timestamp()) if self.created_at else None,
            "updated_at": int(self.updated_at.timestamp()) if self.updated_at else None
        }


class ScreeningResult(Base):
    """筛选结果模型"""
    __tablename__ = "screening_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    result_id = Column(String(50), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
    job_id = Column(String(50), nullable=False)
    resume_id = Column(String(50), nullable=False)
    model = Column(String(100), nullable=False, comment="使用的LLM模型")
    screening_type = Column(String(20), nullable=False, default="job", comment="筛选方式: job-岗位筛选, custom-自定义描述筛选")
    rerank_score = Column(Float, nullable=False, comment="Rerank得分")
    raw_score = Column(Float, nullable=False, comment="原始Rerank得分")
    rank = Column(Integer, nullable=False, comment="排名")
    llm_evaluation = Column(Text, nullable=False, comment="LLM评估内容")
    user_id = Column(String(50), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Contact(Base):
    """联系表单模型"""
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, comment="联系人姓名")
    email = Column(String(100), nullable=False, comment="联系人邮箱")
    message = Column(Text, nullable=False, comment="留言内容")
    status = Column(String(20), default="pending", comment="处理状态: pending-待处理, processed-已处理")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def to_dict(self):
        """转换为字典"""
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "message": self.message,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
