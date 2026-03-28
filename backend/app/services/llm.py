"""LLM module for resume evaluation with privacy protection"""

import httpx
import re
from typing import Dict, Any
from ..config import LLM_URL, LLM_API_KEY, LLM_MODEL, LLM_PROVIDERS

class LLMClient:
    """LLM client for resume evaluation with privacy protection"""

    def __init__(self):
        self.url = LLM_URL
        self.api_key = LLM_API_KEY
        self.model = LLM_MODEL
        self.client = httpx.Client(timeout=30.0)
    
    def _anonymize_resume(self, resume_text: str) -> str:
        """Anonymize sensitive information in resume"""
        # Remove personal contact information
        # Phone numbers
        resume_text = re.sub(r'\+?\d{1,4}?[-.\s]?\(?\d{1,4}?\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}', '[PHONE]', resume_text)
        
        # Email addresses
        resume_text = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '[EMAIL]', resume_text)
        
        # URLs
        resume_text = re.sub(r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+', '[URL]', resume_text)
        
        # ID numbers (身份证号、护照号等)
        resume_text = re.sub(r'\b\d{17}[\dXx]\b', '[ID_NUMBER]', resume_text)  # 身份证
        resume_text = re.sub(r'\b[A-Z]{1,2}\d{6,9}\b', '[PASSPORT]', resume_text)  # 护照
        
        # Address information
        address_patterns = [
            r'北京市|天津市|上海市|重庆市',
            r'河北省|山西省|辽宁省|吉林省|黑龙江省|江苏省|浙江省|安徽省|福建省|江西省|山东省|河南省',
            r'湖北省|湖南省|广东省|海南省|四川省|贵州省|云南省|陕西省|甘肃省|青海省|台湾省',
            r'内蒙古自治区|广西壮族自治区|西藏自治区|宁夏回族自治区|新疆维吾尔自治区',
            r'香港|澳门',
            r'市|区|县|街道|路|号|小区|大厦|单元'
        ]
        
        for pattern in address_patterns:
            resume_text = re.sub(pattern, '[LOCATION]', resume_text)
        
        # Remove specific names (保留姓氏，隐藏名字)
        # 匹配中文姓名（保留姓氏，名字用*代替）
        resume_text = re.sub(r'([\u4e00-\u9fa5]{1})([\u4e00-\u9fa5]{1,2})', r'\1*', resume_text)
        
        return resume_text
    
    def _extract_relevant_sections(self, resume_text: str, job_description: str) -> str:
        """Extract only relevant sections from resume for privacy protection"""
        # 定义简历章节
        sections = {
            'skills': ['技能', '技术', '能力', 'skills', 'technologies'],
            'experience': ['工作经历', '工作经验', '职业经历', 'experience', 'work'],
            'education': ['教育背景', '学历', '教育经历', 'education'],
            'projects': ['项目经历', '项目经验', 'projects']
        }
        
        # 分析职位描述关键词，确定需要哪些章节
        required_sections = []
        job_lower = job_description.lower()
        
        for section, keywords in sections.items():
            if any(keyword in job_lower for keyword in keywords):
                required_sections.append(section)
        
        # 如果没有匹配，默认包含所有相关章节
        if not required_sections:
            required_sections = ['skills', 'experience', 'education']
        
        # 提取相关章节内容
        relevant_content = []
        
        # 简单的章节分割（实际应用中可以使用更复杂的分割算法）
        lines = resume_text.split('\n')
        current_section = None
        section_content = []
        
        for line in lines:
            line_lower = line.lower()
            # 检查是否是章节标题
            for section, keywords in sections.items():
                if any(keyword in line_lower for keyword in keywords) and len(line.strip()) < 50:
                    if current_section and section_content:
                        relevant_content.append(f"{current_section}: {' '.join(section_content)}")
                    current_section = section
                    section_content = []
                    break
            else:
                if current_section and line.strip():
                    section_content.append(line.strip())
        
        if current_section and section_content:
            relevant_content.append(f"{current_section}: {' '.join(section_content)}")
        
        return '\n'.join(relevant_content) if relevant_content else resume_text[:2000]  # 限制长度

    def _get_model_config(self, model: str = None) -> Dict[str, str]:
        """Get configuration for the specified model"""
        if not model:
            return {"url": self.url, "api_key": self.api_key, "model": self.model}

        # 检查是否是多模型配置中的模型
        if model in LLM_PROVIDERS:
            return LLM_PROVIDERS[model]

        # 如果不是预配置模型,使用默认配置
        return {"url": self.url, "api_key": self.api_key, "model": model}
    
    def evaluate_resume(self, resume_text: str, job_description: str, model: str = None) -> Dict[str, Any]:
        """Evaluate resume against job description with privacy protection"""
        import time
        from ..utils.logger import logger

        start_time = time.time()

        # 隐私保护处理
        anonymized_resume = self._anonymize_resume(resume_text)
        relevant_content = self._extract_relevant_sections(anonymized_resume, job_description)

        prompt = f"""请评估以下简历是否符合职位描述，并提供详细分析。

## 职位描述
{job_description}

## 简历（已脱敏处理）
{relevant_content}

## 输出要求
请严格使用 **Markdown 格式** 输出，结构如下：

### 整体匹配度评分（0-100）
（请在此标题下方第一行输出：匹配度：XX分，其中XX为0-100的整数）

### 技能匹配分析

### 经验匹配分析

### 教育背景匹配分析

### 优势与劣势

### 建议

**格式规范（必须遵守）：**
- 使用 Markdown 语法（标题用 ###，加粗用 **text**，列表用 - 或 1.）
- 如需使用表格，使用标准 Markdown 表格语法（| 列1 | 列2 |）
- 不要使用 HTML 标签（如 <br>、<strong>、<p> 等）
- 不要对简历原文进行缩写、简称或自行造词，引用简历内容时必须保持原文表述
- 不要使用 emoji 表情符号（如 ✅❌⭐ 等）
- 不要使用特殊字符装饰

注意：简历中的个人身份信息已进行脱敏处理，请基于专业技能和经验进行评估。
简历文本由 PDF 自动解析提取，可能存在个别乱码或错位文字，请忽略这些解析错误，正常评估。
"""

        # 获取模型配置
        model_config = self._get_model_config(model)

        payload = {
            "model": model_config["model"],
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.3,  # 适当的随机性
            "stream": False,
            "max_tokens": 2000   # 增加输出长度限制，确保完整评估结果
        }

        headers = {
            "Content-Type": "application/json",
        }

        if model_config["api_key"] and model_config["api_key"] != "not_required":
            headers["Authorization"] = f"Bearer {model_config['api_key']}"

        # 记录请求数据大小
        payload_json = payload
        request_size = len(str(payload_json).encode('utf-8'))
        logger.info(f"LLM 请求: 模型={model_config['model']}, "
                    f"请求大小={request_size:,} 字节 ({request_size/1024:.2f} KB), "
                    f"prompt字符数={len(prompt):,}")

        # 添加重试机制
        max_retries = 2
        for attempt in range(max_retries + 1):
            try:
                request_start = time.time()
                # 使用合理的超时时间，给云端LLM服务足够的响应时间
                response = self.client.post(
                    model_config["url"],
                    json=payload,
                    headers=headers,
                    timeout=httpx.Timeout(
                        connect=15.0,   # 连接超时15秒
                        read=120.0,     # 读取超时120秒，给云端LLM足够时间
                        write=10.0,
                        pool=10.0
                    )
                )
                request_time = time.time() - request_start
                logger.info(f"LLM HTTP 请求耗时: {request_time:.2f} 秒")

                response.raise_for_status()
                result = response.json()

                response_size = len(str(result).encode('utf-8'))
                total_time = time.time() - start_time
                logger.info(f"LLM 响应: 大小={response_size:,} 字节 ({response_size/1024:.2f} KB), "
                            f"总耗时={total_time:.2f} 秒")

                return result
                
            except httpx.TimeoutException as e:
                total_time = time.time() - start_time
                if attempt < max_retries:
                    logger.warning(f"LLM API 请求超时，重试 {attempt + 1}/{max_retries} (已耗时 {total_time:.2f} 秒)")
                    time.sleep(2)  # 等待2秒后重试
                    continue
                else:
                    logger.error(f"LLM API 请求超时 (已耗时 {total_time:.2f} 秒): {model_config['url']}, 错误: {e}")
                    raise Exception(f"LLM API 请求超时: {model_config['url']}, 错误: {e}")
                    
            except httpx.HTTPStatusError as e:
                total_time = time.time() - start_time
                logger.error(f"LLM API 返回错误 (已耗时 {total_time:.2f} 秒): {e.response.status_code}, 响应: {e.response.text}")
                raise Exception(f"LLM API 返回错误: {e.response.status_code}, 响应: {e.response.text}")
                
            except httpx.RequestError as e:
                total_time = time.time() - start_time
                error_str = str(e)
                
                # 针对云端LLM服务的不稳定连接进行特殊处理
                if attempt < max_retries:
                    if "peer closed connection" in error_str:
                        logger.warning(f"LLM API 连接被对端关闭，重试 {attempt + 1}/{max_retries} (已耗时 {total_time:.2f} 秒)")
                        time.sleep(3)  # 等待3秒后重试
                        continue
                    elif "connection" in error_str.lower():
                        logger.warning(f"LLM API 连接问题，重试 {attempt + 1}/{max_retries} (已耗时 {total_time:.2f} 秒)")
                        time.sleep(2)  # 等待2秒后重试
                        continue
                
                logger.error(f"LLM API 请求失败 (已耗时 {total_time:.2f} 秒): {error_str}")
                raise Exception(f"LLM API 请求失败: {error_str}")

    def parse_evaluation_result(self, llm_result: Dict[str, Any]) -> Dict[str, Any]:
        """解析 LLM 评估结果
        
        Args:
            llm_result: LLM API 返回的原始结果
            
        Returns:
            解析后的评估结果
        """
        try:
            # 获取 LLM 返回的内容
            content = llm_result.get("choices", [{}])[0].get("message", {}).get("content", "")
            
            # 初始化默认结果
            evaluation_result = {
                "matching_score": 0,
                "skills_analysis": "",
                "experience_analysis": "",
                "education_analysis": "",
                "strengths": "",
                "weaknesses": "",
                "suggestions": "",
                "overall_evaluation": content
            }
            
            # 解析匹配度评分（覆盖：匹配度：85分 / 85分 / 85/100 / 85% 等）
            import re
            score_match = re.search(
                r'(?:匹配度|评分|score)[：:\s]*([0-9]{1,3})\s*[分%/]?',
                content, re.IGNORECASE
            )
            if not score_match:
                # 备用：标题行下方独立数字（如 "### 整体匹配度评分\n\n85"）
                score_match = re.search(
                    r'(?:整体匹配度评分|匹配度)[^\n]*\n+\s*([0-9]{1,3})\b',
                    content
                )
            if not score_match:
                # 备用：独立出现的 "XX分" 或 "XX/100"
                score_match = re.search(r'\b([0-9]{1,3})\s*[分/]\s*(?:100|分)?\b', content)
            if score_match:
                evaluation_result["matching_score"] = int(score_match.group(1))
            
            # 解析技能匹配分析
            skills_match = re.search(r'(?:技能匹配|技能分析|技能)[：:\s]*(.+?)(?=\n\d|\.\s*$|\n\s*\d|$)', content, re.DOTALL)
            if skills_match:
                evaluation_result["skills_analysis"] = skills_match.group(1).strip()
            
            # 解析经验匹配分析
            experience_match = re.search(r'(?:经验匹配|经验分析|经验)[：:\s]*(.+?)(?=\n\d|\.\s*$|\n\s*\d|$)', content, re.DOTALL)
            if experience_match:
                evaluation_result["experience_analysis"] = experience_match.group(1).strip()
            
            # 解析教育背景分析
            education_match = re.search(r'(?:教育背景|教育分析|教育)[：:\s]*(.+?)(?=\n\d|\.\s*$|\n\s*\d|$)', content, re.DOTALL)
            if education_match:
                evaluation_result["education_analysis"] = education_match.group(1).strip()
            
            # 解析优势
            strengths_match = re.search(r'(?:优势|优点)[：:\s]*(.+?)(?=\n\d|\.\s*$|\n\s*\d|$)', content, re.DOTALL)
            if strengths_match:
                evaluation_result["strengths"] = strengths_match.group(1).strip()
            
            # 解析劣势
            weaknesses_match = re.search(r'(?:劣势|缺点|不足)[：:\s]*(.+?)(?=\n\d|\.\s*$|\n\s*\d|$)', content, re.DOTALL)
            if weaknesses_match:
                evaluation_result["weaknesses"] = weaknesses_match.group(1).strip()
            
            # 解析建议
            suggestions_match = re.search(r'(?:建议|改进)[：:\s]*(.+?)(?=\n\d|\.\s*$|\n\s*\d|$)', content, re.DOTALL)
            if suggestions_match:
                evaluation_result["suggestions"] = suggestions_match.group(1).strip()
            
            return evaluation_result
            
        except Exception as e:
            from ..utils.logger import logger
            logger.error(f"解析 LLM 评估结果失败: {e}")
            
            # 返回默认结果
            return {
                "matching_score": 0,
                "skills_analysis": "解析失败",
                "experience_analysis": "解析失败",
                "education_analysis": "解析失败",
                "strengths": "",
                "weaknesses": "",
                "suggestions": "",
                "overall_evaluation": "评估结果解析失败，请查看原始响应"
            }