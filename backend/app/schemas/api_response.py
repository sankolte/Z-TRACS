from typing import Generic, TypeVar, Optional, Any
from datetime import datetime
from pydantic import BaseModel

T = TypeVar('T')

class ResponseMeta(BaseModel):
    timestamp: str = datetime.now().isoformat()
    page: Optional[int] = None
    pageSize: Optional[int] = None
    totalRecords: Optional[int] = None

class ErrorDetails(BaseModel):
    code: str
    message: str
    details: Optional[Any] = None

class ApiResponse(BaseModel, Generic[T]):
    success: bool
    data: Optional[T] = None
    error: Optional[ErrorDetails] = None
    meta: ResponseMeta = ResponseMeta()

    @classmethod
    def ok(cls, data: T, page: Optional[int] = None, page_size: Optional[int] = None, total_records: Optional[int] = None):
        return cls(
            success=True,
            data=data,
            meta=ResponseMeta(
                timestamp=datetime.now().isoformat(),
                page=page,
                pageSize=page_size,
                totalRecords=total_records
            )
        )

    @classmethod
    def fail(cls, code: str, message: str, details: Optional[Any] = None):
        return cls(
            success=False,
            error=ErrorDetails(code=code, message=message, details=details),
            meta=ResponseMeta(timestamp=datetime.now().isoformat())
        )
