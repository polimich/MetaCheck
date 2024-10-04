import enum


class WorkState(str, enum.Enum):
    NEW = 'new'
    IN_PROGRESS = 'in_progress'
    DONE = 'done'
    FINAL = 'final'


class ProcessingState(str, enum.Enum):
    PRISTINE = 'pristine'
    QUEUED = 'queued'
    PROCESSING = 'processing'
    ERROR = 'error'
    DONE = 'done'
    CANCELLED = 'cancelled'