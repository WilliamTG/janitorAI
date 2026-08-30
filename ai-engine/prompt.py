import re
from datetime import datetime

# Proveniens: hvilken promptgenerasjon som produserte et utkast. Lagres med
# reportDraft i appen og returneres av /api/report, slik at valideringsbatteriet
# (docs/valideringscaser.md) kan skåre per versjon og draft-vs-godkjent-diffen
# kan knyttes til riktig promptgenerasjon. Bump ved enhver substansendring i
# system-/hovedprompt, sjekklistene eller bevisreglene.
PROMPT_VERSION = "2026-08-28.1"


def _parse_building_year(report_meta: dict) -> int | None:
    """
    Best-effort byggeår fra report_meta.buildings[].buildingYear (fritekstfelt,
    ingen DB-validering — se docs/ARCHITECTURE_WATER_DAMAGE_TREE.md §2). En
    manglende/ugyldig verdi skal aldri feile pipelinen — bare gi et manglende
    signal.
    """
    for building in (report_meta or {}).get("buildings") or []:
        if not isinstance(building, dict):
            continue
        raw = building.get("buildingYear")
        if raw in (None, "", "-"):
            continue
        try:
            year = int(str(raw).strip())
        except (TypeError, ValueError):
            continue
        if 1800 <= year <= 2100:
            return year
    return None


def _parse_inspection_month(date_str: str | None) -> int | None:
    """Best-effort månedsutrekk fra en ISO-dato eller dd.mm.yyyy-streng."""
    if not date_str:
        return None
    s = str(date_str).strip()
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).month
    except ValueError:
        pass
    match = re.match(r"^(\d{1,2})\.(\d{1,2})\.(\d{4})$", s)
    if match:
        return int(match.group(2))
    return None


def _building_year_signals(building_year: int | None) -> list[str]:
    """
    Deterministiske forhåndssignaler fra byggeår (docs/fagkunnskap-vannskadeaarsaker.md):
    før 1970 = avløpsrør i støpejern (korrosjonsrisiko), før 1979 (selvbyggere
    til 1983) = dampsperre under betongplate kan mangle (kapillæroppsug). Et
    bygg fra før 1970 kan gi begge signalene samtidig.
    """
    if building_year is None:
        return []
    signals = []
    if building_year < 1970:
        signals.append(
            f"- Byggeår {building_year} (før 1970): avløpsrør i støpejern er en kjent "
            "korrosjonsrisiko dersom de ikke er byttet/fornyet."
        )
    if building_year < 1979:
        signals.append(
            f"- Byggeår {building_year} (før 1979, selvbyggere til 1983): dampsperre under "
            "betongplate kan mangle, noe som gir konstant kapillæroppsug — misfarging/mugg "
            "nederst på materialer i direkte kontakt med betongen."
        )
    return signals


def _season_signal(inspection_month: int | None) -> str | None:
    """Sesongsignal for kondens (nesten aldri om sommeren, jf. kunnskapsgrunnlaget)."""
    if inspection_month is None:
        return None
    if inspection_month in (10, 11, 12, 1, 2, 3):
        return (
            "- Befaring i vinterhalvåret: kondensskader er hovedsakelig et vinterfenomen og "
            "bør vurderes som en aktuell kilde ved fuktfunn uten tydelig lekkasjepunkt."
        )
    return (
        "- Befaring i sommerhalvåret: kondensskader forekommer nesten aldri om sommeren "
        "(unntak: rom under bakken) — et funn som ligner kondens bør derfor vurderes "
        "ekstra kritisk mot de andre kildene."
    )


def build_case_signals(report_meta: dict, project: dict | None = None) -> str:
    """
    Deterministiske, kode-beregnede signaler fra saksunderlaget (byggeår,
    befaringssesong) — ALDRI utledet av Gemini selv. Dette er statistiske
    FORHÅNDSSIGNALER, ikke bevis for én bestemt kilde: de forteller hvilke av
    de fem vannskadekildene som fortjener ekstra oppmerksomhet, men konklusjonen
    skal alltid bygge på faktiske observasjoner (jf. BEVISFØRSEL-reglene).
    Returnerer "" når ingen signaler kan beregnes.
    """
    report_meta = report_meta or {}
    project = project or {}
    building_year = _parse_building_year(report_meta)
    inspection_month = _parse_inspection_month(
        report_meta.get("inspectionDate") or project.get("inspectionDate")
    )

    lines = _building_year_signals(building_year)
    season_line = _season_signal(inspection_month)
    if season_line:
        lines.append(season_line)

    if not lines:
        return ""

    return (
        "\n#### Kjente forhåndssignaler (fra saksunderlaget, ikke fra bildeanalyse)\n"
        + "\n".join(lines)
        + "\nDisse er forhåndssignaler basert på saksdata, ikke bevis for en bestemt kilde — "
        "bruk dem til å prioritere hvilke av de fem kildene som fortjener ekstra "
        "oppmerksomhet, men konkluder alltid ut fra faktiske observasjoner i materialet."
    )


def build_inspector_context(project: dict, report_meta: dict | None = None) -> str:
    """
    Formats the project context (description, notes, photo captions) plus
    deterministic case signals (building year, season — see build_case_signals)
    into a structured text block that is appended to the Gemini contents list.
    """
    project = project or {}
    case_signals = build_case_signals(report_meta or {}, project)

    if not project and not case_signals:
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

    if len(lines) == 1 and not case_signals:
        # Only the header — nothing useful was present
        return ""

    if case_signals:
        lines.append(case_signals)

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
4. DIFFERENSIALDIAGNOSE: Gå eksplisitt gjennom de fem vannskadekildene (se TEKNISK SJEKKLISTE) én etter én mot bevisene — still opp minst to alternative årsaker og test hver, vekt eventuelle forhåndssignaler fra saksunderlaget (byggeår, sesong — se INSPECTOR CONTEXT) som prioritering, ikke som fasit. Konkluder med den kilden som forklarer ALLE funn best — ikke den som ble nevnt først. Sett `source_category` FØRST etter denne gjennomgangen, aldri før. Uten utvetydig støtte i bevisene: bruk USIKKER.
5. TIDSPERSPEKTIV: Vurder visuelle og beskrevne tidsmarkører (se definisjoner under), og uttrykk usikkerhet når grunnlaget ikke er tilstrekkelig. Sett `acute_or_gradual` ut fra denne vurderingen; bruk USIKKER når tegnene ikke er entydige.

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

### TEKNISK SJEKKLISTE — DE FEM VANNSKADEKILDENE (kunnskapsgrunnlag v1):
Enhver vannskade har i ~98 % av tilfellene én av disse fem kildene. Gå gjennom
alle fem mot bevisene før du velger `source_category` — bruk USIKKER for de
resterende ~2 % fremfor å tvinge frem en kategori uten dekning i bevisene.

1. NEDBØR: Klimaskjermen — himling/yttertak og loft, rundt vinduer/dører, balkong (tett sluk), eller yttervegg under terreng. Spor: drypp i materialskjøter, svelling, malingslipp/utposing i himling av gips; under terreng: saltutslag eller fuktmerker (kapillærbrytende sjikt svikter), evt. kapillæroppsug via grunn ved manglende dampsperre (se byggeårsignal under).
2. TRYKKSATT_RØR: KONSTANT lekkasje, uavhengig av bruk. Nesten aldri i yttervegg — se etter etasjeskillere og delevegger. Jevnt utviklende lekkasjepunkt; mugg utvikler seg raskere ved varmtvannslekkasje. Rørbrudd = brudd i fast rørstrekk, koblinger, fordelerkolbe eller overgang til sanitærutstyr.
3. AVLØPSRØR: Lekkasje VED BRUK av sanitærutstyr — diffus, "tilfeldig" (ikke konstant). Byggeårsignal: støpejern før 1970 = korrosjonsrisiko (se byggeårsignal under). Fraglidning i skjøter = håndverkerfeil (manglende klamring). Tilbakeslag i kjeller ved styrtregn; vann opp av sluk/vask = blokkasje lenger nede i systemet. På bad: brudd i/mellom rørdeler = rørbrudd; lekkasje mellom membran og rørdel = utett våtrom (egen forsikringsgrense — krever egen dokumentasjon).
4. KONDENS: Fukt uten lekkasjepunkt, mot kalde flater — vinduer, kuldebroer, kalde loft/krypkjellere, uisolerte rør, eller skjult i vegg bak utett dampsperre. Drives av høy inneluftfuktighet + svak ventilasjon. Sesongsignal: nesten aldri om sommeren (se sesongsignal under).
5. UTETT_BAD: Dusjsonen — høyest vannbelastning på membranen. Lekkasjepunktet er ofte lite; gir avgrenset oppfukting rundt våtsonen snarere enn rennende vann.

### BRUK AV FORHÅNDSSIGNALER:
INSPECTOR CONTEXT kan inneholde en seksjon «Kjente forhåndssignaler» —
kode-beregnet fra byggeår og befaringssesong (aldri fra bildeanalyse). Bruk
disse til å PRIORITERE hvilke av de fem kildene over som fortjener ekstra
oppmerksomhet, men de er aldri i seg selv bevis: en konklusjon skal alltid
kunne begrunnes i faktiske observasjoner fra video/foto/notater.

### KAPILLÆROPPSUG OG TERRENG (utdyper kilde 1 og saksunderlagets byggeårsignal):
Vurder om terrenget leder vann mot boligen. Trenger vannet inn som følge av
utvendig press (f.eks. mot en ubeskyttet mur), skal dette prioriteres som
rotårsak. Plater og sviller som står rett på betong uten dampsperre kan trekke
fukt nedenfra som konstant kapillæroppsug — uten at noe rør lekker.

{format_index_for_prompt()}

### KRAV TIL BEVIS (JSON):
- Når video finnes: oppgi tidsstempelet som best viser den tekniske svikten. Når beviset kommer fra foto, notat eller transkripsjon: sett `timestamp_ms` til null.
- Kildekobling: Når beviset kommer fra et vedlagt foto, sett `source_photo_index` til fotoets nummer fra listen «VEDLAGTE FOTO» (1-basert). Kommer beviset fra video eller notat: la feltet stå null. Oppgi aldri et nummer som ikke står i listen.
- Bruk `technical_reference` KUN med referanser fra listen over, på formen 'Byggforsk NNN.NNN'. Er ingen relevant: la feltet stå tomt. Ikke oppgi punkt-/avsnittsnummer.
- I `description`: Forklar logikken — hvilke av de fem kildene ble vurdert, og hvorfor de andre ble forkastet. Hvis du ser mørke flekker, vurder om dette er slam fra flomvann eller faktisk muggvekst.
- `source_category` og `acute_or_gradual` skal alltid være satt (bruk USIKKER fremfor å gjette), og begrunnelsen skal fremgå av `cause`/`description`.

Svar i JSON-format.
    """