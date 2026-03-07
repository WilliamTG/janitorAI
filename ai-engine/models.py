from pydantic import BaseModel, Field

class DamageAnalysis(BaseModel):
    area: str = Field(description="The room or zone in Norwegian (e.g., 'Bad')")
    source: str = Field(description="The specific component that failed")
    cause: str = Field(description="The technical reason for failure")
    description: str = Field(description="A detailed narrative of the damage")
    evidence_timestamp_ms: int = Field(description="The timestamp in milliseconds for the evidence photo")
    is_habitable: bool = Field(description="Whether the home is livable")

# Future models like FireDamage or TheftReport will be added here