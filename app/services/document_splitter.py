from __future__ import annotations

from dataclasses import dataclass

from langchain_text_splitters import RecursiveCharacterTextSplitter


RECURSIVE_CHARACTER = "recursive_character"
MIN_CHUNK_SIZE = 100
MAX_CHUNK_SIZE = 4000
MIN_CHUNK_OVERLAP = 0
MAX_CHUNK_OVERLAP = 1000

MARKDOWN_CJK_SEPARATORS = [
    "\n# ",
    "\n## ",
    "\n### ",
    "\n#### ",
    "\n##### ",
    "\n###### ",
    "\n\n",
    "\n",
    "。",
    "？",
    "！",
    "；",
    ". ",
    "? ",
    "! ",
    "; ",
    " ",
    "",
]


class SplitterConfigError(ValueError):
    pass


@dataclass(frozen=True)
class SplitterConfig:
    chunk_size: int
    chunk_overlap: int
    splitter_type: str = RECURSIVE_CHARACTER


def validate_splitter_config(
    chunk_size: int,
    chunk_overlap: int,
    splitter_type: str = RECURSIVE_CHARACTER,
) -> SplitterConfig:
    if isinstance(chunk_size, bool) or not isinstance(chunk_size, int):
        raise SplitterConfigError("chunk_size 必须是整数")
    if not MIN_CHUNK_SIZE <= chunk_size <= MAX_CHUNK_SIZE:
        raise SplitterConfigError(
            f"chunk_size 必须在 {MIN_CHUNK_SIZE}～{MAX_CHUNK_SIZE} 字符之间"
        )
    if isinstance(chunk_overlap, bool) or not isinstance(chunk_overlap, int):
        raise SplitterConfigError("chunk_overlap 必须是整数")
    if not MIN_CHUNK_OVERLAP <= chunk_overlap <= MAX_CHUNK_OVERLAP:
        raise SplitterConfigError(
            f"chunk_overlap 必须在 {MIN_CHUNK_OVERLAP}～{MAX_CHUNK_OVERLAP} 字符之间"
        )
    if chunk_overlap >= chunk_size:
        raise SplitterConfigError("chunk_overlap 必须小于 chunk_size")
    if splitter_type != RECURSIVE_CHARACTER:
        raise SplitterConfigError("splitter_type 当前仅支持 recursive_character")
    return SplitterConfig(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        splitter_type=splitter_type,
    )


def split_text(text: str, config: SplitterConfig) -> list[str]:
    """Split structured text by character count, preserving separators."""

    validated = validate_splitter_config(
        config.chunk_size,
        config.chunk_overlap,
        config.splitter_type,
    )
    if not isinstance(text, str):
        raise SplitterConfigError("待拆分内容必须是字符串")
    if not text.strip():
        return []

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=validated.chunk_size,
        chunk_overlap=validated.chunk_overlap,
        length_function=len,
        separators=MARKDOWN_CJK_SEPARATORS,
        keep_separator=True,
        is_separator_regex=False,
    )
    return [chunk for chunk in splitter.split_text(text) if chunk.strip()]
