"""Pydantic models for API request/response"""

from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
from ..auth.rbac import Role


class ResumeRequest(BaseModel):
    """Request model for adding a resume"""
    resume_id: str = Field(..., description="Unique identifier for the resume")
    resume_text: str = Field(..., description="Full text content of the resume")


class ResumeResponse(BaseModel):
    """Response model for resume operations"""
    success: bool
    message: Optional[str] = None


class ScreenRequest(BaseModel):
    """Request model for screening resumes"""
    job_description: str = Field(..., description="Job description text")
    top_k: int = Field(5, ge=1, le=50, description="Number of top results to return")
    model: Optional[str] = Field(None, description="LLM model to use for evaluation")
    filter_job_id: Optional[str] = Field(None, description="Filter resumes by job ID")
    time_range: Optional[int] = Field(7, description="Time range in days (0 for all time)")
    only_unscreened: Optional[bool] = Field(False, description="Only screen unscreened resumes")


class ResumeResult(BaseModel):
    """Model for a single resume screening result"""
    resume_id: str
    rerank_score: float
    llm_evaluation: str


class ScreenResponse(BaseModel):
    """Response model for screening results"""
    results: List[ResumeResult]


class HealthResponse(BaseModel):
    """Response model for health check"""
    status: str
    version: str = "0.1.0"


# ===== 认证和用户相关模型 =====

class UserCreate(BaseModel):
    """用户注册模型"""
    username: str = Field(..., min_length=3, max_length=50, description="用户名")
    email: EmailStr = Field(..., description="邮箱")
    password: str = Field(..., min_length=6, max_length=100, description="密码")
    full_name: Optional[str] = Field(None, max_length=100, description="全名")
    role: Role = Field(Role.USER, description="角色")


class UserLogin(BaseModel):
    """用户登录模型"""
    username: str = Field(..., description="用户名或邮箱")
    password: str = Field(..., description="密码")


class TokenResponse(BaseModel):
    """令牌响应模型"""
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserResponse(BaseModel):
    """用户信息响应模型"""
    id: str
    username: str
    email: str
    full_name: Optional[str]
    role: str
    permissions: List[str]
    is_active: bool


# ===== 简历上传相关模型 =====

class ResumeUploadResponse(BaseModel):
    """简历上传响应模型"""
    success: bool
    message: str
    resume_id: Optional[str] = None
    resume_text: Optional[str] = None


class ResumeUploadRequest(BaseModel):
    """简历上传请求模型"""
    job_id: Optional[str] = Field(None, description="关联的岗位ID")


# ===== 岗位管理相关模型 =====

class JobCreate(BaseModel):
    """创建岗位模型"""
    title: str = Field(..., min_length=1, max_length=255, description="岗位标题")
    description: str = Field(..., min_length=10, description="岗位描述")
    requirements: Optional[str] = Field(None, description="岗位要求")
    salary_range: Optional[str] = Field(None, max_length=100, description="薪资范围")
    location: Optional[str] = Field(None, max_length=100, description="工作地点")


class JobUpdate(BaseModel):
    """更新岗位模型"""
    title: Optional[str] = Field(None, min_length=1, max_length=255, description="岗位标题")
    description: Optional[str] = Field(None, min_length=10, description="岗位描述")
    requirements: Optional[str] = Field(None, description="岗位要求")
    salary_range: Optional[str] = Field(None, max_length=100, description="薪资范围")
    location: Optional[str] = Field(None, max_length=100, description="工作地点")


class JobResponse(BaseModel):
    """岗位响应模型"""
    job_id: str
    title: str
    description: str
    requirements: Optional[str]
    salary_range: Optional[str]
    location: Optional[str]
    user_id: str
    created_at: int
    updated_at: Optional[int]


class JobListResponse(BaseModel):
    """岗位列表响应模型"""
    success: bool
    jobs: List[JobResponse]


class JobOperationResponse(BaseModel):
    """岗位操作响应模型"""
    success: bool
    message: str
    job_id: Optional[str] = None


class BatchDeleteRequest(BaseModel):
    """批量删除请求"""
    result_ids: list[str]
