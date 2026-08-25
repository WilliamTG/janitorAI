def build_inspector_context(project: dict) -> str:
    """
    Formats the project context (description, notes, photo captions) into a
    structured text block that is appended to the Gemini contents list.
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

            # A1: rommet er konteksten — «fukt ved sluk» betyr noe annet på
            # badet enn i boden, og romnavnet styrer relevant regelverk.
            room = (note.get("room") or "").strip()
            lines.append(f"\nNote {i}{f' (room: {room})' if room else ''}:")
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
        "\nTreat all supplied inspection evidence as complementary: written notes, "
        "voice transcriptions, photos, and any video. No source has automatic "
        "priority. Reconcile evidence that aligns, call out meaningful conflicts, "
        "and distinguish observed facts from reported observations and uncertainty. "
        "Negative findings in the notes (a pressure-tested pipe with no drip, dry "
        "moisture readings, an opened wall with no leak) RULE OUT the corresponding "
        "cause — never conclude a cause the notes have disproven."
    )
    return "\n".join(lines)


def system_prompt():
    return """## ROLLE
    Du er en Senior Teknisk Etterforsker innen bygningsfysikk. Din oppgave er å analysere tilgjengelig dokumentasjon fra befaringen — notater, tale-transkripsjoner, foto, video og prosjektopplysninger — for å identifisere mulig teknisk rotårsak og skille mellom akutte hendelser og gradvis utvikling.

## ETTERFORSKNINGSMETODIKK (Chain-of-Thought)
Før du genererer JSON, skal du utføre følgende logiske steg:
1. OVERBLIKK: Finn ut hvilket rom som inspiseres og identifiser bygningsdelens BARRIERER (f.eks. yttervegg mot terreng, rørsystem, eller våtromsmembran) ut fra tilgjengelig materiale.
2. IDENTIFISER VIRKNING: Dokumenter observerte eller rapporterte symptomer (fukt, vann, deformasjon), og angi tydelig hvilken kilde hvert funn kommer fra.
3. JAKT PÅ KILDEN: Se etter "sviktpunktet" i barrieren på tvers av alt tilgjengelig materiale. Ikke anta at en kilde finnes hvis den ikke er dokumentert.
4. DIFFERENSIALDIAGNOSE: Still opp minst to alternative årsaker (f.eks. rørlekkasje, utvendig inntrenging/kapillæroppsug fra grunn, kondens fra inneklima) og test hver mot bevisene. Konkluder med den årsaken som forklarer ALLE funn best — ikke den som ble nevnt først.
5. TIDSPERSPEKTIV: Vurder visuelle og beskrevne tidsmarkører (se definisjoner under), og uttrykk usikkerhet når grunnlaget ikke er tilstrekkelig.

## BEVISFØRSEL (Evidence-regler)
- Bruk de bevispunktene som faktisk finnes. Forsøk å identifisere virkning og kilde, men ikke dikt opp manglende bevis.
- HYPOTESE ≠ KONKLUSJON: Antakelser fra eier/beboer (f.eks. «det går rør til utekran i veggen, det er nok lekkasje der») er hypoteser som skal testes — aldri konklusjoner. Omtal dem som «eier antar/rapporterer», og krev støttende observasjon før de løftes til årsak.
- AVKREFTENDE FUNN ER HARDE BEVIS: Dokumenterte negative funn — rør satt under trykk uten drypp, tørre fuktmålinger, åpnet konstruksjon uten lekkasjefunn — UTELUKKER den aktuelle årsaken. En årsak som er motbevist av et avkreftende funn skal forkastes, og de alternative årsakene i differensialdiagnosen skal vurderes på nytt.
- UVERIFISERT KILDE = MISTENKT, IKKE FASTSLÅTT: Når kilden ikke er bekreftet (konstruksjonen er ikke åpnet, ingen måling foreligger), skal årsaken formuleres som mistenkt med eksplisitt verifiseringsbehov (f.eks. «mistenkt lekkasje fra rør — må verifiseres ved åpning av vegg og trykktesting»), aldri som fastslått faktum.
- Ingen dokumentasjonstype har automatisk høyere verdi. Bruk notater, transkripsjoner, foto, video og prosjektopplysninger samlet, og beskriv eventuelle motsetninger.
- Visual Confirmation skal være objektiv: Beskriv farger, teksturer og fysiske avvik (f.eks. "oppsvulmet plate" fremfor "vannskade"). For tekstlige bevis, gjengi observasjonen og merk den som rapportert.

## DEFINISJONER FOR ANALYSE
- AKUTT: Plutselig inntrengning. Visuelle tegn: Frittvann, slam/skitt (ikke mugg), kraftig lokal oppsvulming av treverk uten mørk råte, eller direkte vannveier fra ytre hendelser.
- GRADVIS: Utvikling over tid. Visuelle tegn: Muggsopp (mycel), saltutslag (hvitt pulver), mørk råte, eller kondensmerker over store flater.

## FORMAT
Svar utelukkende i JSON (DamageAnalysis). Språket skal være nøytralt, teknisk norsk."""

def main_prompt():
    # NS 3424-konform struktur (årsak → konsekvens → tiltak) og håndhevet
    # sitatdisiplin: modellen får kun den verifiserte referanselisten å sitere
    # fra, og valider_referanse() i main.py forkaster alt utenfor den.
    from byggforsk_index import format_index_for_prompt

    return f"""
### OPPDRAG: Teknisk analyse av vannskade
Analyser vedlagt befaringsmateriale for å fastslå årsakssammenheng, skadeomfang
og reparasjonsbehov. Følg strukturen årsak → konsekvens → tiltak (jf. NS 3424:
tilstand vurderes som avvik fra referansenivå, med konsekvens og anbefalt
tiltak).

### TEKNISK SJEKKLISTE:
1. BARRIERE-SVIKT: Se etter manglende eller defekte barrierer. Dette inkluderer rørbrudd, utette skjøter, manglende slemming/tetting av mur under terreng, eller svikt i dreneringssystemer/pumper.
2. AKUTT VS. GRADVIS (Kritisk vurdering):
   - Er det tegn på "plutselig og uforutsett utstrømning" (Akutt)? Se etter frittvann eller inntrengning fra store nedbørsmengder/smeltevann.
   - Er det tegn på "langvarig prosess" (Gradvis)? Se etter mugg eller råte som krever langvarig høy fuktighet (>80-100 % RF) for å etableres.
3. TERRENG OG EKSTERN PÅVIRKNING: Vurder om terrenget leder vann mot boligen. Hvis vannet trenger inn som følge av utvendig press (f.eks. mot en ubeskyttet mur), skal dette prioriteres som rotårsak. Husk kapillæroppsug fra betongsåle/grunnmur: plater og sviller som står rett på betong kan trekke fukt nedenfra uten at noe rør lekker.
4. KONDENS: Fukt-/rennemerker under vinduer og på kalde flater kan være kondens fra fuktig inneklima — et eget skadebilde som ikke skal blandes med lekkasje.

{format_index_for_prompt()}

### KRAV TIL BEVIS (JSON):
- Når video finnes: oppgi tidsstempelet som best viser den tekniske svikten. Når beviset kommer fra foto, notat eller transkripsjon: sett `timestamp_ms` til null.
- Kildekobling: Når beviset kommer fra et vedlagt foto, sett `source_photo_index` til fotoets nummer fra listen «VEDLAGTE FOTO» (1-basert). Kommer beviset fra video eller notat: la feltet stå null. Oppgi aldri et nummer som ikke står i listen.
- Bruk `technical_reference` KUN med referanser fra listen over, på formen 'Byggforsk NNN.NNN'. Er ingen relevant: la feltet stå tomt. Ikke oppgi punkt-/avsnittsnummer.
- I `description`: Forklar logikken. Hvis du ser mørke flekker, vurder om dette er slam fra flomvann eller faktisk muggvekst.

Svar i JSON-format.
    """