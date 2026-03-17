"""FastAPI application entry point"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from .core.system import ResumeScreeningSystem
from .models.schemas import (
    ResumeRequest,
    ResumeResponse,
    ScreenRequest,
    ScreenResponse,
    HealthResponse
)
from .config import CORS_ORIGINS, FASTAPI_HOST, FASTAPI_PORT
from .utils.logger import logger
from .utils.fastapi_logger import setup_fastapi_logger, log_exception
from .routes import auth_router
from .routes.auth_db import create_default_admin
from .auth import get_current_active_user, Permission, require_permission
from .database import AsyncSessionLocal, close_db

# Global system instance
system = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown"""
    global system

    # 初始化日志
    setup_fastapi_logger()
    logger.info("Starting Resume Screening System...")

    # 创建默认管理员
    try:
        async with AsyncSessionLocal() as db:
            await create_default_admin(db)
    except Exception as e:
        logger.error(f"创建默认管理员失败: {e}")
        # 继续启动，不阻止应用

    # Startup
    system = ResumeScreeningSystem()
    logger.info("Resume Screening System initialized")

    yield

    # Shutdown
    if system:
        system.close()
    await close_db()
    logger.info("Resume Screening System shutdown")


# Create FastAPI app
app = FastAPI(
    title="AI Resume Screening System",
    description="AI-powered resume screening using Qwen3-Embedding, Milvus, and DeepSeek/Qwen",
    version="0.1.0",
    lifespan=lifespan
)

# 异常处理器
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """全局异常处理器"""
    log_exception(request, exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS.split(",") if CORS_ORIGINS else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
from .routes.auth_db import router as auth_db_router
app.include_router(auth_db_router)
from .routes.resumes import router as resumes_router
app.include_router(resumes_router)
from .routes.jobs import router as jobs_router
app.include_router(jobs_router)
from .routes.screening import router as screening_router
app.include_router(screening_router)
from .routes.users import router as users_router
app.include_router(users_router)


@app.get("/", tags=["Root"])
async def root():
    """Root endpoint"""
    logger.info("Root endpoint called")
    return {
        "message": "AI Resume Screening System API",
        "version": "0.1.0",
        "docs": "/docs"
    }


@app.get("/api/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """Health check endpoint"""
    logger.debug("Health check called")
    return HealthResponse(status="healthy")


@app.post("/api/resumes", response_model=ResumeResponse, tags=["Resumes"])
async def add_resume(request: ResumeRequest):
    """Add a new resume to the system"""
    if not system:
        raise HTTPException(status_code=503, detail="System not initialized")

    logger.info(f"Adding resume: {request.resume_id}")
    success = system.add_resume(request.resume_id, request.resume_text)
    if success:
        logger.info(f"Resume {request.resume_id} added successfully")
        return ResumeResponse(success=True, message=f"Resume {request.resume_id} added successfully")
    else:
        logger.error(f"Failed to add resume {request.resume_id}")
        raise HTTPException(status_code=500, detail="Failed to add resume")


@app.post("/api/screen", response_model=ScreenResponse, tags=["Screening"])
async def screen_resumes(request: ScreenRequest):
    """Screen resumes based on job description"""
    if not system:
        raise HTTPException(status_code=503, detail="System not initialized")

    logger.info(f"Screening resumes with top_k={request.top_k}")
    results = system.screen_resumes(request.job_description, request.top_k)
    
    if not results:
        logger.warning("No results found")
        return ScreenResponse(results=[])

    logger.info(f"Found {len(results)} results")
    return ScreenResponse(results=results)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=FASTAPI_HOST,
        port=FASTAPI_PORT,
        reload=True
    )
