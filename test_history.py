from app.database import get_db
from app.models.user import ScreeningResult, Job
from sqlalchemy import select, func
import asyncio

async def test():
    async for session in get_db():
        # 检查数据库中的记录
        result = await session.execute(select(func.count(ScreeningResult.id)))
        count = result.scalar()
        print(f'数据库中的筛选记录数: {count}')

        if count > 0:
            result = await session.execute(
                select(ScreeningResult).order_by(ScreeningResult.created_at.desc()).limit(5)
            )
            records = result.scalars().all()
            print('\n最近的5条记录:')
            for r in records:
                print(f'  JobID: {r.job_id}, ResumeID: {r.resume_id}, Model: {r.model}, Rank: {r.rank}')

        # 检查岗位
        result = await session.execute(select(func.count(Job.job_id)))
        job_count = result.scalar()
        print(f'\n数据库中的岗位数: {job_count}')

        if job_count > 0:
            result = await session.execute(select(Job).limit(3))
            jobs = result.scalars().all()
            print('\n岗位列表:')
            for j in jobs:
                print(f'  JobID: {j.job_id}, Title: {j.title}')

        break

asyncio.run(test())
