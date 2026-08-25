# Byggforsk-referanseindeks — KUN metadata (nummer + tittel + egne emneord).
#
# Lisensgrense (viktig): Ingen tekst fra Byggforskserien gjengis her eller
# mates inn i modellen. Nummer og titler er faktaopplysninger fra seriens
# offentlige katalog (kryssjekket mot Byggforvaltning 700.305, tabell 55 a/b,
# som lister anvisningene for tilstandsanalyse). Emneordene er våre egne
# rutingshint. Fulltekst-RAG krever SINTEF-avtale — bevisst utsatt; frem til
# da siterer rapporten kun verifiserte datablad-numre, og takstpersonen slår
# opp innholdet i eget Byggforsk-abonnement.
#
# Håndhevelse: modellen instrueres til å sitere KUN fra denne listen, og
# valider_referanse() stripper alt som ikke kan verifiseres — det er denne
# porten som gjør løftet «Byggforsk-henvisninger vises kun med verifisert
# punktnummer» sant i praksis.

import re

# nummer -> (tittel, emneord for ruting)
BYGGFORSK_INDEX = {
    # Metode og fukt generelt
    "700.305": ("Tilstandsanalyse av bygninger og bygningsdeler",
                "metode tilstandsgrad referansenivå"),
    "700.117": ("Undersøkelse av fuktskader i bygninger",
                "fukt fuktskade undersøkelse måling"),
    "720.612": ("Oppbygning av konstruksjoner. Kartlegging og undersøkelse",
                "konstruksjon oppbygning kartlegging"),
    "474.642": ("Termografering av bygninger",
                "termografering varmetap fukt"),
    # Levetider og vedlikehold
    "700.307": ("Definisjoner, etablering og bruk av levetidsdata for bygg og bygningsdeler",
                "levetid elde slitasje"),
    "700.320": ("Intervaller for vedlikehold og utskifting av bygningsdeler",
                "vedlikehold utskifting intervall levetid"),
    "700.330": ("Levetider for sanitærinstallasjoner i boliger",
                "sanitær rør bereder levetid vvs"),
    # Spesielle analyser
    "622.017": ("Utbedring og ombygging i boligselskaper",
                "boligselskap borettslag utbedring"),
    "720.306": ("Brannteknisk tilstandsanalyse",
                "brann brannsikkerhet"),
    # Våtrom og bad
    "727.813": ("Feil og skader i baderom",
                "bad baderom våtrom membran sluk lekkasje"),
    "727.815": ("Tilstandsanalyse av våtrom. Tilstandsregistrering på nivå 2 og 3",
                "våtrom bad tilstandsanalyse"),
    "727.817": ("Tilstandsanalyse av våtrom. Tilstandsregistrering nivå 1",
                "våtrom bad tilstandsanalyse"),
    # Grunn og fundamenter / rom under terreng
    "711.401": ("Grunnforhold. Skader på småhus",
                "grunn fundament setning terreng kjeller"),
    "721.211": ("Fuktskader i kryperom. Årsaker og utbedringsmetoder",
                "kryperom fukt kjeller under terreng"),
    # Yttervegger
    "720.111": ("Tilstandsanalyse av betongkonstruksjoner",
                "betong yttervegg konstruksjon"),
    "720.112": ("Skader på betongkonstruksjoner. Skadesymptomer, tilstandsgrader og utbedringsmåter",
                "betong skade armering riss"),
    "720.114": ("Betongkonstruksjoner i driftsbygninger. Skader og utbedring",
                "betong driftsbygning landbruk"),
    "720.115": ("Tilstandsanalyse av utvendig trevirke. Registrering og vurdering",
                "trevirke kledning råte utvendig"),
    "720.116": ("Tilstandsanalyse av utvendig trevirke. Bildekatalog, symptomliste og typiske skadesteder",
                "trevirke kledning råte symptomer"),
    "720.415": ("Skader i tilknytning til beslag mot nedbør. Årsaker og utbedring",
                "beslag nedbør vindu takfot inntrengning"),
    "723.235": ("Murte fasader. Skader og utbedringsalternativer",
                "mur fasade teglstein frostsprengning"),
    "742.302": ("Ettersyn av murte og pussede fasader. Generelt",
                "mur puss fasade ettersyn"),
    "742.864": ("Fasadepuss. Skader og utbedringsalternativer",
                "puss fasade avskalling"),
    # Dekker og golv
    "722.403": ("Skader på betongdekker i garasjeanlegg",
                "garasje betongdekke kloridskade"),
    "740.215": ("Skader på innvendig flisbelegg. Årsaker og utbedring",
                "flis flisbelegg bad golv vegg"),
    "741.401": ("Skader på myke og halvharde golvbelegg. Årsaker og utbedringsmetoder",
                "golvbelegg vinyl belegg fukt"),
    "741.402": ("Skader på parkett- og bordgolv. Årsaker og utbedringsmåter",
                "parkett bordgolv tregolv svelling kuving"),
    # Tak
    "725.116": ("Utbedring av skader i skrå tretak uten kaldt loft",
                "tak skrått tretak"),
    "725.117": ("Utbedring av skader i skrå tretak med kaldt loft",
                "tak loft kaldloft kondens"),
    "725.118": ("Skader i kompakte tak. Årsaker og utbedring",
                "kompakt tak flatt tak membran"),
    "725.121": ("Skader på terrasser over oppvarmede rom. Årsaker og utbedring",
                "terrasse takterrasse lekkasje membran"),
    "744.202": ("Skader på profilerte takplater og båndtekning. Årsaker og utbedringsmåter",
                "takplater båndtekning tekking"),
    # Fast inventar
    "752.410": ("Skader på skorsteiner. Årsaker og utbedring",
                "skorstein pipe"),
}

_NUM_RE = re.compile(r"\b(\d{3}\.\d{3})\b")


def format_index_for_prompt() -> str:
    """Kompakt liste til prompten: modellen får kun nummer + tittel å sitere fra."""
    lines = ["### GODKJENTE BYGGFORSK-REFERANSER (siter KUN fra denne listen)"]
    for nummer, (tittel, _emneord) in BYGGFORSK_INDEX.items():
        lines.append(f"- {nummer} {tittel}")
    lines.append(
        "Siter på formen 'Byggforsk NNN.NNN'. Passer ingen av referansene, "
        "la technical_reference stå tom. Siter ALDRI et nummer som ikke står i listen."
    )
    return "\n".join(lines)


def valider_referanse(ref):
    """
    Normaliser en modell-generert referanse mot indeksen.
    Returnerer 'Byggforsk NNN.NNN <tittel>' når nummeret er verifisert,
    ellers None (referansen forkastes). Punkt-nivå («pkt 4.2») kan ikke
    verifiseres uten fulltekst-lisens og strippes bevisst.
    """
    if not ref:
        return None
    match = _NUM_RE.search(str(ref))
    if not match:
        return None
    nummer = match.group(1)
    entry = BYGGFORSK_INDEX.get(nummer)
    if not entry:
        return None
    tittel, _ = entry
    return f"Byggforsk {nummer} {tittel}"
