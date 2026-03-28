"""智能文本切分工具"""

import re
from typing import List, Tuple
from fuzzywuzzy import fuzz
from ..utils.logger import logger


def expand_section_keywords() -> dict:
    """扩展段落关键词库"""
    return {
        "基本信息": ["个人信息", "个人资料", "基本信息", "基本情况", "身份信息", "个人情况"],
        "教育背景": ["教育经历", "学历背景", "教育情况", "学习经历", "毕业院校", "学历信息"],
        "工作经历": ["工作履历", "职业经历", "工作经验", "从业经历", "工作背景", "职业背景"],
        "项目经验": ["项目经历", "项目背景", "参与项目", "项目履历", "项目经验"],
        "专业技能": ["技术技能", "专业能力", "技术特长", "技能专长", "能力特长", "技术能力"],
        "语言能力": ["语言技能", "外语能力", "语言水平", "语言特长", "语言情况"],
        "自我评价": ["个人评价", "自我描述", "个人总结", "自我认知", "自我简介"]
    }


def exact_section_detection(text: str) -> List[Tuple[int, str, str]]:
    """精确匹配段落检测（高置信度）"""
    
    # 高置信度关键词（完全匹配）
    high_conf_keywords = [
        "基本信息", "个人信息", "教育背景", "教育经历", 
        "工作经历", "工作经验", "项目经验", "专业技能",
        "语言能力", "自我评价"
    ]
    
    lines = text.split('\n')
    sections = []
    
    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue
            
        # 检查是否包含高置信度关键词
        for keyword in high_conf_keywords:
            if keyword in line:
                sections.append((i, line, "high"))
                break
    
    return sections


def fuzzy_section_detection(text: str, threshold: int = 75) -> List[Tuple[int, str, str]]:
    """模糊匹配段落检测（中置信度）"""
    
    keyword_mapping = expand_section_keywords()
    all_keywords = []
    for keywords in keyword_mapping.values():
        all_keywords.extend(keywords)
    
    lines = text.split('\n')
    sections = []
    
    for i, line in enumerate(lines):
        line = line.strip()
        if not line or len(line) > 50:  # 跳过过长行（可能是内容）
            continue
            
        # 模糊匹配检测
        for keyword in all_keywords:
            similarity = fuzz.partial_ratio(line, keyword)
            if similarity > threshold:
                sections.append((i, line, "medium"))
                break
    
    return sections


def semantic_section_detection(text: str) -> List[Tuple[int, str, str]]:
    """语义段落检测（低置信度兜底）"""
    
    # 段落特征词
    section_indicators = ["信息", "背景", "经历", "经验", "技能", "能力", "评价", "情况"]
    
    lines = text.split('\n')
    sections = []
    
    for i, line in enumerate(lines):
        line = line.strip()
        if not line or len(line) > 30:  # 跳过过长行
            continue
            
        # 检查是否包含段落特征词且行长度适中
        if any(indicator in line for indicator in section_indicators) and 5 <= len(line) <= 30:
            sections.append((i, line, "low"))
    
    return sections


def hybrid_section_detection(text: str) -> List[Tuple[int, str, str]]:
    """混合段落检测 - 分层策略"""
    
    # 第一层：高置信度精确匹配
    high_sections = exact_section_detection(text)
    
    # 第二层：中置信度模糊匹配
    medium_sections = fuzzy_section_detection(text)
    
    # 第三层：低置信度语义检测
    low_sections = semantic_section_detection(text)
    
    # 合并结果，按优先级去重
    all_sections = []
    used_lines = set()
    
    # 按优先级添加
    for section_list in [high_sections, medium_sections, low_sections]:
        for line_num, line_text, confidence in section_list:
            if line_num not in used_lines:
                all_sections.append((line_num, line_text, confidence))
                used_lines.add(line_num)
    
    # 按行号排序
    all_sections.sort(key=lambda x: x[0])
    
    return all_sections


def chunk_resume_by_sections(text: str) -> List[str]:
    """基于检测到的段落切分简历文本"""
    
    sections = hybrid_section_detection(text)
    lines = text.split('\n')
    chunks = []
    
    if not sections:
        # 没有检测到段落，返回整个文本
        return [text]
    
    # 添加开始到第一个段落
    start_line = 0
    for i, (line_num, line_text, confidence) in enumerate(sections):
        # 当前段落的内容
        if i == len(sections) - 1:
            # 最后一个段落到文本结束
            chunk_lines = lines[start_line:]
        else:
            # 当前段落到下一个段落开始
            next_line_num = sections[i + 1][0]
            chunk_lines = lines[start_line:next_line_num]
        
        chunk_text = '\n'.join(chunk_lines).strip()
        if chunk_text:
            chunks.append(chunk_text)
        
        start_line = line_num
    
    logger.info(f"智能切分完成：检测到 {len(sections)} 个段落，切分为 {len(chunks)} 个块")
    
    return chunks


def intelligent_chunking(text: str, max_chunk_size: int = 600, min_chunk_size: int = 100) -> List[str]:
    """智能文本切分主函数"""
    
    if len(text) <= max_chunk_size:
        # 短文本不切分
        return [text]
    
    # 第一步：尝试基于段落结构切分
    section_chunks = chunk_resume_by_sections(text)
    
    if len(section_chunks) > 1:
        # 检查切分结果的质量
        valid_chunks = []
        for chunk in section_chunks:
            if len(chunk) >= min_chunk_size:
                valid_chunks.append(chunk)
        
        if len(valid_chunks) > 1:
            logger.info("使用段落结构切分")
            return valid_chunks
    
    # 第二步：如果没有合适的段落结构，使用固定长度切分
    if len(text) > max_chunk_size:
        logger.info("使用固定长度切分")
        return fixed_length_chunking(text, max_chunk_size, min_chunk_size)
    
    # 第三步：短文本不切分
    return [text]


def fixed_length_chunking(text: str, chunk_size: int = 400, overlap: int = 50) -> List[str]:
    """固定长度切分"""
    
    words = text.split()
    chunks = []
    
    for i in range(0, len(words), chunk_size - overlap):
        chunk_words = words[i:i + chunk_size]
        chunk = ' '.join(chunk_words)
        chunks.append(chunk)
        
        if i + chunk_size >= len(words):
            break
    
    return chunks


def test_chunking():
    """测试切分效果"""
    
    test_text = """个人信息
姓名：张三
年龄：25岁
联系电话：13800138000

教育背景
清华大学 计算机科学 硕士
2018-2021

工作经历
阿里巴巴 高级工程师
2021-至今
负责核心系统开发

专业技能
Python, Java, 机器学习
"""
    
    chunks = intelligent_chunking(test_text)
    
    print("切分结果：")
    for i, chunk in enumerate(chunks):
        print(f"\n--- 块 {i+1} ---")
        print(chunk[:200] + "..." if len(chunk) > 200 else chunk)


if __name__ == "__main__":
    test_chunking()