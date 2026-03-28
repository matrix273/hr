"""PDF 解析工具"""

import io
import pdfplumber
from pypdf import PdfReader
from typing import Optional, List
from .text_chunker import intelligent_chunking
from ..utils.logger import logger


def parse_pdf(file_bytes: bytes) -> Optional[str]:
    """解析 PDF 文件内容

    Args:
        file_bytes: PDF 文件的字节数据

    Returns:
        解析后的文本内容，失败返回 None
    """
    try:
        # 优先使用 pdfplumber，能更好地处理复杂布局
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            text_parts = []
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    text_parts.append(text)

            if text_parts:
                full_text = '\n'.join(text_parts)
                logger.info(f"PDF 解析成功，共 {len(text_parts)} 页，文本长度 {len(full_text)}")
                return full_text

            # 如果 pdfplumber 没有提取到文本，尝试 pypdf
            logger.warning("pdfplumber 未提取到文本，尝试使用 pypdf")
            reader = PdfReader(io.BytesIO(file_bytes))
            text_parts = []
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    text_parts.append(text)

            if text_parts:
                full_text = '\n'.join(text_parts)
                logger.info(f"pypdf 解析成功，共 {len(text_parts)} 页，文本长度 {len(full_text)}")
                return full_text

        logger.error("PDF 解析失败：未提取到任何文本")
        return None

    except Exception as e:
        logger.error(f"PDF 解析错误: {e}")
        return None


def clean_text(text: str) -> str:
    """清理文本内容

    Args:
        text: 原始文本

    Returns:
        清理后的文本
    """
    if not text:
        return ""

    # 移除多余空白
    text = ' '.join(text.split())

    # 移除特殊字符（保留基本标点）
    text = ''.join(char for char in text if char.isprintable() or char in '\n\t')

    return text.strip()
