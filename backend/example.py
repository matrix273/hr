"""Example usage of the Resume Screening System"""

from app.core.system import ResumeScreeningSystem

# Sample resumes
resumes = [
    {
        "id": "resume_1",
        "text": "张三，30岁，计算机科学硕士，5年Python开发经验，熟悉Django、Flask等框架，有微服务开发经验，熟悉Docker和Kubernetes。"
    },
    {
        "id": "resume_2",
        "text": "李四，28岁，软件工程学士，3年前端开发经验，熟悉React、Vue等框架，有响应式设计经验，了解Node.js。"
    },
    {
        "id": "resume_3",
        "text": "王五，32岁，数据科学硕士，4年数据分析经验，熟悉Python、R、SQL，有机器学习项目经验，了解TensorFlow和PyTorch。"
    }
]

# Sample job description
job_description = "招聘Python后端开发工程师，要求：计算机相关专业，3年以上Python开发经验，熟悉Django或Flask框架，有微服务开发经验，了解Docker和Kubernetes。"

def main():
    # Initialize the system
    system = ResumeScreeningSystem()
    
    try:
        # Add resumes
        print("Adding resumes...")
        for resume in resumes:
            success = system.add_resume(resume["id"], resume["text"])
            print(f"Added {resume['id']}: {success}")
        
        # Screen resumes
        print("\nScreening resumes...")
        results = system.screen_resumes(job_description, top_k=3)
        
        # Display results
        print("\nScreening results:")
        for i, result in enumerate(results, 1):
            print(f"\nRank {i}:")
            print(f"Resume ID: {result['resume_id']}")
            print(f"Rerank Score: {result['rerank_score']}")
            print(f"LLM Evaluation: {result['llm_evaluation']}")
    finally:
        # Close resources
        system.close()

if __name__ == "__main__":
    main()