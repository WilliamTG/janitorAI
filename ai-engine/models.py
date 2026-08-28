from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum


class WaterDamageSource(str, Enum):
    """
    De fem hovedkildene til vannskade (docs/fagkunnskap-vannskadeaarsaker.md),
    pluss USIKKER. Modellen dekker ~98 % av sakene — resten skal falle ut som
    USIKKER, ALDRI tvinges inn i en av de fem kategoriene (falsk sikkerhet er
    farligere enn usikkerhet).
    """
    NEDBOR = "NEDBØR"
    TRYKKSATT_ROR = "TRYKKSATT_RØR"
    AVLOPSROR = "AVLØPSRØR"
    KONDENS = "KONDENS"
    UTETT_BAD = "UTETT_BAD"
    USIKKER = "USIKKER"


class AcuteOrGradual(str, Enum):
    """Forsikringsgrensen akutt vs. gradvis. USIKKER er et fullverdig svar."""
    AKUTT = "AKUTT"
    GRADVIS = "GRADVIS"
    USIKKER = "USIKKER"


class Evidence(BaseModel):
    timestamp_ms: Optional[int] = Field(
        default=None,
        description="Videotidspunkt i millisekunder når beviset kommer fra video; null når beviset kommer fra notat eller foto."
    )
    caption: str = Field(description="Kort tittel på bildet (f.eks. 'Nærbilde av rørkobling')")
    visual_confirmation: str = Field(description="Beskriv nøyaktig hva i bildet som beviser dette (f.eks. 'mørk fuktflekk i hjørnet' eller 'synlig vanndråpe')")
    source_photo_index: Optional[int] = Field(
        default=None,
        description="Når beviset kommer fra et vedlagt foto: fotoets nummer (1-basert, i den rekkefølgen fotoene er vedlagt). Null når beviset kommer fra video eller notat."
    )
    technical_reference: Optional[str] = Field(description="Byggforsk-referanse på formen 'Byggforsk NNN.NNN' — KUN numre fra den godkjente referanselisten i oppdraget. La stå tom hvis ingen passer. Aldri punkt-/avsnittsnummer, aldri numre utenfor listen.")

class DamageAnalysis(BaseModel):
    area: str = Field(description="Rommet som inspiseres")
    source: str = Field(description="Kilden til skaden, i fritekst (fyldig beskrivelse)")
    source_category: WaterDamageSource = Field(
        description="Kildekategori for vannskaden — én av de fem hovedkildene (NEDBØR, "
                     "TRYKKSATT_RØR, AVLØPSRØR, KONDENS, UTETT_BAD), eller USIKKER. Velg kun én "
                     "av de fem når bevisene utvetydig peker dit; tving ALDRI frem en kategori — "
                     "USIKKER er et fullverdig og forventet svar."
    )
    cause: str = Field(description="Den tekniske årsaken")
    acute_or_gradual: AcuteOrGradual = Field(
        description="AKUTT (plutselig, uforutsett utstrømning) vs. GRADVIS (utvikling over tid) — "
                     "avgjør forsikringsdekning. Bruk USIKKER når de visuelle tegnene ikke er "
                     "entydige. Begrunnelsen skal alltid fremgå av `cause`/`description`."
    )
    description: str = Field(description="Fyldig faglig beskrivelse på norsk. Hold deg strengt til det som er synlig.")
    evidence_points: List[Evidence] = Field(description="Liste over 2-3 bevispunkter med tidsstempel")
    is_habitable: bool
    extent_description: str = Field(
        description="Beskrivelse til {{damage.extent.description}}. Fokus på fysisk spredning og materialer berørt."
    )
    repairs_description: str = Field(
        description="Beskrivelse til {{damage.repairs_needed.description}}. Liste over nødvendige tekniske tiltak for utbedring."
    )

class RepairAction(BaseModel):
    action: str = Field(description="Spesifikk handling, f.eks. 'Utskifting av bunnledningsmuffe'")
    priority: str = Field(description="Høy, Medium eller Lav")
    justification: str = Field(description="Hvorfor er dette nødvendig basert på skaden?")