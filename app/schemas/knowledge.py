from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


SplitterType = Literal["recursive_character"]


class DocumentSplitRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    chunkSize: int = Field(ge=100, le=4000)
    chunkOverlap: int = Field(ge=0, le=1000)
    splitterType: SplitterType = "recursive_character"

    @model_validator(mode="after")
    def validate_overlap(self) -> "DocumentSplitRequest":
        if self.chunkOverlap >= self.chunkSize:
            raise ValueError("chunkOverlap 必须小于 chunkSize")
        return self


class DocumentBatchDeleteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    documentIds: list[int] = Field(min_length=1, max_length=100)

    @field_validator("documentIds")
    @classmethod
    def validate_document_ids(cls, value: list[int]) -> list[int]:
        if any(document_id <= 0 for document_id in value):
            raise ValueError("documentIds 必须是正整数")
        if len(set(value)) != len(value):
            raise ValueError("documentIds 不能重复")
        return value
