from pydantic import BaseModel, Field
from typing import List, Optional

class Evidence(BaseModel):
    timestamp_ms: int
    caption: str = Field(description="Kort tittel på bildet (f.eks. 'Nærbilde av rørkobling')")
    visual_confirmation: str = Field(description="Beskriv nøyaktig hva i bildet som beviser dette (f.eks. 'mørk fuktflekk i hjørnet' eller 'synlig vanndråpe')")
    technical_reference: Optional[str] = Field(description="Referanse til Byggforsk (f.eks. '700.115 pkt 4.2'), la stå tom hvis ikke relevant")

class DamageAnalysis(BaseModel):
    area: str = Field(description="Rommet som inspiseres")
    source: str = Field(description="Kilden til skaden")
    cause: str = Field(description="Den tekniske årsaken")
    description: str = Field(description="Fyldig faglig beskrivelse på norsk. Hold deg strengt til det som er synlig.")
    evidence_points: List[Evidence] = Field(description="Liste over 2-3 bevispunkter med tidsstempel")
    is_habitable: bool
    extent_description: str = Field(
        description="Beskrivelse til {{damage.extent.description}}. Fokus på fysisk spredning og materialer berørt."
    )
    repairs_description: str = Field(
        description="Beskrivelse til {{damage.repairs_needed.description}}. Liste over nødvendige tekniske tiltak for utbedring.")

class RepairAction(BaseModel):
    action: str = Field(description="Spesifikk handling, f.eks. 'Utskifting av bunnledningsmuffe'")
    priority: str = Field(description="Høy, Medium eller Lav")
    justification: str = Field(description="Hvorfor er dette nødvendig basert på skaden?")