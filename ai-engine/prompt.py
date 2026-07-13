def build_inspector_context(project: dict) -> str:
    """
    Formats the project context (description, notes, photo captions) into a
    structured text block that is appended to the Gemini contents list so the
    model has the inspector's observations alongside the video.
    """
    if not project:
        return ""

    lines = ["### INSPECTOR CONTEXT"]

    # Project name and date
    if project.get("name"):
        lines.append(f"Project: {project['name']}")
    if project.get("inspectionDate"):
        lines.append(f"Inspection date: {project['inspectionDate']}")
    if project.get("inspector"):
        lines.append(f"Inspector: {project['inspector']}")

    # Project-level description (typed or voice-transcribed)
    desc_text = project.get("projectDescriptionText", "").strip()
    desc_trans = project.get("projectDescriptionTranscription", "").strip()
    if desc_text or desc_trans:
        lines.append("\n#### Project Description")
        if desc_text:
            lines.append(f"(Written) {desc_text}")
        if desc_trans and desc_trans != desc_text:
            lines.append(f"(Voice) {desc_trans}")

    # Per-note observations (text + transcription + photo captions)
    notes = [n for n in (project.get("notes") or []) if n]
    if notes:
        lines.append("\n#### Inspector Notes")
        for i, note in enumerate(notes, 1):
            note_text = (note.get("text") or "").strip()
            note_trans = (note.get("transcription") or "").strip()
            photos = note.get("photos") or []

            if not note_text and not note_trans and not photos:
                continue

            lines.append(f"\nNote {i}:")
            if note_text:
                lines.append(f"  (Written) {note_text}")
            if note_trans and note_trans != note_text:
                lines.append(f"  (Voice) {note_trans}")
            for j, photo in enumerate(photos, 1):
                caption = (photo.get("caption") or "").strip()
                if caption:
                    lines.append(f"  Photo {j} caption: {caption}")

    if len(lines) == 1:
        # Only the header — nothing useful was present
        return ""

    lines.append(
        "\nUse the above inspector notes and photo captions as additional evidence "
        "when identifying the damage area, source, and cause. "
        "Where the inspector's observations confirm or contradict what is visible in "
        "the video, prioritise the combined evidence over the video alone."
    )
    return "\n".join(lines)


def system_prompt():
    return """## ROLLE
Du er en Senior Teknisk Etterforsker innen bygningsfysikk. Din oppgave er å analysere videoopptak av skader for å identifisere den tekniske rotårsaken (Root Cause) og skille mellom akutte hendelser og gradvis utvikling.

## ETTERFORSKNINGSMETODIKK (Chain-of-Thought)
Før du genererer JSON, skal du utføre følgende logiske steg:
1. OVERBLIKK: Finn ut hvilket rom som inspiseres og identifiser bygningsdelens BARRIERER (f.eks. yttervegg mot terreng, rørsystem, eller våtromsmembran).
2. IDENTIFISER VIRKNING: Dokumenter de visuelle symptomene (fukt, vann, deformasjon).
3. JAKT PÅ KILDEN: Skann hele videoen for å finne "sviktpunktet" i barrieren. Dette er ofte der kameraet beveger seg fra selve skaden og mot en teknisk installasjon eller utsiden av bygget.
4. TIDSPERSPEKTIV: Analyser visuelle tidsmarkører (se definisjoner under).

## BEVISFØRSEL (Evidence-regler)
- Du skal alltid forsøke å finne TO kritiske bevispunkter:
  - Bevis 1: "Virkning" (Symptomet inne i boligen).
  - Bevis 2: "Kilde" (Sviktpunktet/Rotårsaken, ofte på utsiden eller bak en luke).
- Visual Confirmation skal være objektiv: Beskriv farger, teksturer og fysiske avvik (f.eks. "oppsvulmet plate" fremfor "vannskade").

## DEFINISJONER FOR ANALYSE
- AKUTT: Plutselig inntrengning. Visuelle tegn: Frittvann, slam/skitt (ikke mugg), kraftig lokal oppsvulming av treverk uten mørk råte, eller direkte vannveier fra ytre hendelser.
- GRADVIS: Utvikling over tid. Visuelle tegn: Muggsopp (mycel), saltutslag (hvitt pulver), mørk råte, eller kondensmerker over store flater.

## FORMAT
Svar utelukkende i JSON (DamageAnalysis). Språket skal være nøytralt, teknisk norsk."""

def main_prompt():
    return  """
### OPPDRAG: Teknisk analyse av vannskade
Analyser vedlagte video og kryssreferer med Byggforsk 700.115 og 700.117 for å fastslå årsakssammenheng, skadeomfang, og reprasjonsbehov.

### TEKNISK SJEKKLISTE:
1. BARRIERE-SVIKT: Se etter manglende eller defekte barrierer. Dette inkluderer rørbrudd , utette skjøter, manglende slemning/tetting av mur under terreng, eller svikt i dreneringssystemer/pumper[cite: 23, 167].
2. AKUTT VS. GRADVIS (Kritisk vurdering):
   - Er det tegn på "plutselig og uforutsett utstrømning" (Akutt)?[cite: 51]. Se etter frittvann [cite: 101] eller inntrengning fra store nedbørsmengder/smeltevann[cite: 23].
   - Er det tegn på "langvarig prosess" (Gradvis)? Se etter mugg [cite: 42, 524] eller råte som krever langvarig høy fuktighet (>80-100% RF) for å etableres[cite: 525, 531].
3. TERRENG OG EKSTERN PÅVIRKNING: Vurder om terrenget leder vann mot boligen[cite: 394]. Hvis vannet trenger inn som følge av utvendig press (f.eks. mot en ubeskyttet mur), skal dette prioriteres som rotårsak.

### KRAV TIL BEVIS (JSON):
- Finn det tidsstempelet som best viser den tekniske SVIKTEN (f.eks. der vannet kommer inn eller hvor barrieren mangler).
- Bruk `technical_reference` for å sitere korrekt punkt i Byggforsk som støtter din konklusjon om utbedring eller årsak.
- I `description`: Forklar logikken. Hvis du ser mørke flekker, vurder om dette er slam fra flomvann  eller faktisk muggvekst[cite: 42].

Svar i JSON-format.
    """